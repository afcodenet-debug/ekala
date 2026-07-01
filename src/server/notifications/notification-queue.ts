// Notification Queue - Increment 1: Foundations
// In-memory queue for notifications with retry logic

export interface NotificationJob {
  id: string;
  eventType: string;
  notificationType: string;
  tenantId: number;
  recipients: string[];
  subject: string;
  htmlContent: string;
  metadata?: Record<string, any>;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'dead_letter';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  avgProcessingTime: number;
}

export class NotificationQueue {
  private jobs: Map<string, NotificationJob> = new Map();
  private processing = false;
  private maxRetries = 3;
  private backoffMs = [1000, 5000, 15000]; // 1s, 5s, 15s

  constructor() {
    // No database dependency - in-memory queue
  }

  /**
   * Enqueue a new notification job
   */
  async enqueue(job: Omit<NotificationJob, 'id' | 'retryCount' | 'status' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newJob: NotificationJob = {
        ...job,
        id: jobId,
        retryCount: 0,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.jobs.set(jobId, newJob);

      // Log if logger available
      if (global.notificationLogger && typeof global.notificationLogger.logEventProcessed === 'function') {
        global.notificationLogger.logEventProcessed(job.eventType, 0);
      }
      
      // Log enqueued
      if (global.notificationLogger && typeof global.notificationLogger.logEnqueued === 'function') {
        global.notificationLogger.logEnqueued(parseInt(jobId.split('-').pop() || '0'), job.eventType, job.recipients);
      }

      return jobId;
    } catch (error) {
      console.error('[NotificationQueue] Error enqueuing job:', error);
      throw error;
    }
  }

  /**
   * Get next pending job
   */
  async getNextPending(): Promise<NotificationJob | null> {
    for (const job of this.jobs.values()) {
      if (job.status === 'pending') {
        return job;
      }
    }
    return null;
  }

  /**
   * Mark job as processing
   */
  async markProcessing(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'processing';
      job.updatedAt = new Date();
    }
  }

  /**
   * Mark job as completed
   */
  async markCompleted(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'sent';
      job.processedAt = new Date();
      job.updatedAt = new Date();

      // Log if logger available
      if (global.notificationLogger && typeof global.notificationLogger.logSent === 'function') {
        global.notificationLogger.logSent(parseInt(jobId.split('-').pop() || '0'), job.recipients.join(', '));
      }
    }
  }

  /**
   * Mark job as failed and schedule retry
   */
  async markFailed(jobId: string, error: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.retryCount++;
      job.error = error;
      job.updatedAt = new Date();

      // Log if logger available
      if (global.notificationLogger && typeof global.notificationLogger.logRetry === 'function') {
        const isDeadLetter = job.retryCount >= job.maxRetries;
        global.notificationLogger.logRetry(parseInt(jobId.split('-').pop() || '0'), job.retryCount, isDeadLetter);
      }

      if (job.retryCount >= job.maxRetries) {
        job.status = 'dead_letter';
      } else {
        job.status = 'pending';
        // Schedule retry with backoff
        setTimeout(() => {
          if (job.status === 'pending') {
            this.retryJob(jobId);
          }
        }, this.backoffMs[job.retryCount - 1] || 15000);
      }
    }
  }

  /**
   * Retry a failed job
   */
  private async retryJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'pending') {
      // Log retry
      if (global.notificationLogger && typeof global.notificationLogger.logRetried === 'function') {
        global.notificationLogger.logRetried(parseInt(jobId.split('-').pop() || '0'));
      }
    }
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): NotificationJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): NotificationJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: NotificationJob['status']): NotificationJob[] {
    return this.getAllJobs().filter(job => job.status === status);
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const jobs = this.getAllJobs();
    const pending = jobs.filter(j => j.status === 'pending').length;
    const processing = jobs.filter(j => j.status === 'processing').length;
    const completed = jobs.filter(j => j.status === 'sent').length;
    const failed = jobs.filter(j => j.status === 'dead_letter').length;
    const totalProcessed = completed + failed;

    // Calculate average processing time
    const processedJobs = jobs.filter(j => j.processedAt);
    const avgProcessingTime = processedJobs.length > 0
      ? processedJobs.reduce((sum, job) => {
          const processingTime = job.processedAt!.getTime() - job.createdAt.getTime();
          return sum + processingTime;
        }, 0) / processedJobs.length
      : 0;

    return {
      pending,
      processing,
      completed,
      failed,
      totalProcessed,
      avgProcessingTime,
    };
  }

  /**
   * Clear completed jobs
   */
  clearCompleted(): void {
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'sent' || job.status === 'dead_letter') {
        this.jobs.delete(jobId);
      }
    }
  }

  /**
   * Clear all jobs
   */
  clear(): void {
    this.jobs.clear();
  }

  /**
   * Get queue size
   */
  getSize(): number {
    return this.jobs.size;
  }

  /**
   * Start processing queue
   */
  startProcessing(): void {
    if (this.processing) return;
    this.processing = true;
    this.processLoop();
  }

  /**
   * Stop processing queue
   */
  stopProcessing(): void {
    this.processing = false;
  }

  /**
   * Processing loop
   */
  private async processLoop(): Promise<void> {
    while (this.processing) {
      try {
        const job = await this.getNextPending();
        if (job) {
          await this.markProcessing(job.id);
          // Job will be processed by the handler
          // The handler should call markCompleted or markFailed
        }
      } catch (error) {
        console.error('[NotificationQueue] Error in process loop:', error);
      }

      // Sleep before next iteration
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Singleton instance
let queueInstance: NotificationQueue | null = null;

export function getNotificationQueue(): NotificationQueue {
  if (!queueInstance) {
    queueInstance = new NotificationQueue();
  }
  return queueInstance;
}

export function setNotificationQueue(queue: NotificationQueue): void {
  queueInstance = queue;
}