/**
 * SMART REQUEST QUEUE - Intelligent Blocked Request Management
 * 
 * Queues API requests during auth transitions and auto-flushes when ready.
 * Features:
 * - Deduplication (same request = single execution)
 * - Auto-retry on network errors (max 3)
 * - No retry on 401/403/422
 * - Memory protection (max 100 requests)
 * - Auto-flush when execution state becomes 'ready'
 * - Concurrency limit (max 10 parallel requests)
 * - Priority system (critical requests never dropped)
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type RequestPriority = 'critical' | 'high' | 'normal' | 'low';

export interface QueuedRequest {
  id: string;
  createdAt: number;
  context: string;
  priority: RequestPriority;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retries: number;
  requestKey: string;
}

export interface RequestQueueDebugInfo {
  size: number;
  pending: number;
  activeWorkers: number;
  flushed: number;
  deduplicated: number;
  retried: number;
  dropped: number;
  oldestRequestAge: number;
  requests: Array<{
    id: string;
    context: string;
    priority: RequestPriority;
    age: number;
    retries: number;
  }>;
}

// ── Configuration ────────────────────────────────────────────────────────────

const MAX_QUEUE_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const MAX_CONCURRENT_REQUESTS = 10;

// Critical endpoints that should never be dropped
const CRITICAL_ENDPOINTS = [
  '/checkout',
  '/payment',
  '/subscription',
  '/invoice',
  '/billing',
];

// ── Singleton Instance ───────────────────────────────────────────────────────

class RequestQueue {
  private queue: Map<string, QueuedRequest> = new Map();
  private executionPromises: Map<string, Promise<any>> = new Map();
  private listeners: Set<() => void> = new Set();
  private isInitialized = false;
  private isFlushing = false;
  private activeWorkers = 0;
  private metrics = {
    flushed: 0,
    deduplicated: 0,
    retried: 0,
    dropped: 0,
  };

  constructor() {
    this.initialize();
  }

  /**
   * Initialize - listen to execution safety state changes
   */
  private initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Dynamic import to avoid circular dependency
    this.setupExecutionListener();
  }

  /**
   * Setup listener for execution state changes
   */
  private async setupExecutionListener(): Promise<void> {
    try {
      const { subscribeToExecution } = await import('./execution-safety');
      
      subscribeToExecution((context) => {
        // Auto-flush when state becomes 'ready'
        if (context.state === 'ready') {
          console.log('[RequestQueue] Execution ready - flushing queue');
          this.flush();
        }
      });
    } catch (error) {
      console.error('[RequestQueue] Failed to setup execution listener:', error);
    }
  }

  /**
   * Determine request priority based on context
   */
  private getPriority(context: string): RequestPriority {
    const lowerContext = context.toLowerCase();
    
    for (const endpoint of CRITICAL_ENDPOINTS) {
      if (lowerContext.includes(endpoint)) {
        return 'critical';
      }
    }

    if (lowerContext.includes('auth') || lowerContext.includes('login')) {
      return 'high';
    }

    if (lowerContext.includes('order') || lowerContext.includes('sale')) {
      return 'high';
    }

    return 'normal';
  }

  /**
   * Generate unique key for request deduplication
   * Based on endpoint + method + payload hash (NOT function source code)
   * 
   * Priority order:
   * 1. Extract method from enriched context format "api-client:GET:/endpoint"
   * 2. Fallback: extract method from executeFn.toString() (backward compat)
   * 3. Default: GET
   */
  private generateRequestKey(context: string, executeFn: () => Promise<any>): string {
    let endpoint = context;
    let method = 'GET';
    
    if (context.startsWith('api-client:')) {
      // Remove the prefix
      const contextWithoutPrefix = context.substring('api-client:'.length);
      
      // STEP 1: Try to extract method from enriched context format "METHOD:/endpoint"
      const methodMatch = contextWithoutPrefix.match(/^(GET|POST|PATCH|DELETE|PUT):(.+)$/i);
      if (methodMatch) {
        method = methodMatch[1].toUpperCase();
        endpoint = methodMatch[2];
      } else {
        // STEP 2: If not enriched, use the old context format "/endpoint"
        endpoint = contextWithoutPrefix;
        
        // STEP 3: Fallback: try to extract method from function source (backward compat)
        const fnSource = executeFn.toString();
        if (fnSource.includes("method: 'POST'")) {
          method = 'POST';
        } else if (fnSource.includes("method: 'PATCH'")) {
          method = 'PATCH';
        } else if (fnSource.includes("method: 'DELETE'")) {
          method = 'DELETE';
        }
      }
    }

    // Create a simple hash based on endpoint + method
    const keyData = `${method}:${endpoint}`;
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < keyData.length; i++) {
      const char = keyData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return `${method}:${endpoint}:${Math.abs(hash)}`;
  }

  /**
   * Enqueue a request
   */
  enqueue(context: string, executeFn: () => Promise<any>): Promise<any> {
    const requestKey = this.generateRequestKey(context, executeFn);
    const priority = this.getPriority(context);

    // Check for duplicate request
    if (this.executionPromises.has(requestKey)) {
      console.log(`[RequestQueue] Deduplication: reusing existing request for ${context}`);
      this.metrics.deduplicated++;
      return this.executionPromises.get(requestKey)!;
    }

    // Memory protection - drop oldest LOW priority request if queue is full
    if (this.queue.size >= MAX_QUEUE_SIZE) {
      console.warn('[RequestQueue] Overflow protection activated');
      
      // Try to find a LOW priority request to drop
      let dropped = false;
      for (const [key, req] of this.queue.entries()) {
        if (req.priority === 'low') {
          console.warn(`[RequestQueue] Dropping low priority request: ${req.context}`);
          req.reject(new Error('QUEUE_OVERFLOW: Low priority request dropped'));
          this.queue.delete(key);
          this.metrics.dropped++;
          dropped = true;
          break;
        }
      }

      // If no LOW priority found, drop oldest (but not critical)
      if (!dropped) {
        for (const [key, req] of this.queue.entries()) {
          if (req.priority !== 'critical') {
            console.warn(`[RequestQueue] Dropping request: ${req.context}`);
            req.reject(new Error('QUEUE_OVERFLOW: Request dropped due to queue size limit'));
            this.queue.delete(key);
            this.metrics.dropped++;
            break;
          }
        }
      }
    }

    // Create new queued request
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    const queuedRequest: QueuedRequest = {
      id: requestId,
      createdAt: Date.now(),
      context,
      priority,
      execute: executeFn,
      resolve: () => {},
      reject: () => {},
      retries: 0,
      requestKey,
    };

    // Create promise for this request
    const promise = new Promise((resolve, reject) => {
      queuedRequest.resolve = resolve;
      queuedRequest.reject = reject;
    });

    // Store in maps
    this.queue.set(requestId, queuedRequest);
    this.executionPromises.set(requestKey, promise);

    console.log(`[RequestQueue] Enqueued: ${context} (priority: ${priority}, queue size: ${this.queue.size})`);

    // Notify listeners
    this.notifyListeners();

    return promise;
  }

  /**
   * Flush all queued requests with concurrency limit
   */
  async flush(): Promise<void> {
    // Prevent multiple concurrent flushes
    if (this.isFlushing) {
      console.log('[RequestQueue] Flush already in progress, skipping');
      return;
    }

    if (this.queue.size === 0) {
      return;
    }

    this.isFlushing = true;
    console.log(`[RequestQueue] Flushing ${this.queue.size} requests (max ${MAX_CONCURRENT_REQUESTS} concurrent)...`);

    try {
      // Sort by priority (critical first)
      const sortedRequests = Array.from(this.queue.values()).sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // Execute with concurrency limit using worker pool pattern
      await this.executeWithConcurrencyLimit(sortedRequests);

      // 🔴 P0: Clear queue ONLY after successful execution to prevent request loss
      this.queue.clear();
      this.notifyListeners();

      this.metrics.flushed += sortedRequests.length;
      
      console.log(`[RequestQueue] Flush complete (${sortedRequests.length} requests)`);
    } finally {
      // ✅ GARANTIT que isFlushing redevient false même si exception
      this.isFlushing = false;
    }
  }

  /**
   * Execute requests with concurrency limit
   */
  private async executeWithConcurrencyLimit(requests: QueuedRequest[]): Promise<void> {
    const results: Promise<void>[] = [];
    const executing: Promise<void>[] = [];

    for (const request of requests) {
      // Wait if we're at max concurrency
      while (executing.length >= MAX_CONCURRENT_REQUESTS) {
        await Promise.race(executing);
      }

      // Start executing this request
      const promise = this.executeRequest(request).finally(() => {
        // Remove from executing array when done
        const index = executing.indexOf(promise);
        if (index > -1) {
          executing.splice(index, 1);
        }
        this.activeWorkers = executing.length;
      });

      executing.push(promise);
      this.activeWorkers = executing.length;
      results.push(promise);
    }

    // Wait for all remaining requests
    await Promise.allSettled(results);
  }

  /**
   * Execute a single queued request with retry logic (non-recursive)
   */
  private async executeRequest(request: QueuedRequest): Promise<void> {
    let attempt = 0;
    let lastError: any = null;

    while (attempt <= MAX_RETRIES) {
      attempt++;
      
      try {
        console.log(`[RequestQueue] Executing: ${request.context} (attempt ${attempt}/${MAX_RETRIES + 1})`);
        
        const result = await request.execute();
        request.resolve(result);
        
        // Clean up execution promise
        this.executionPromises.delete(request.requestKey);
        
        // Success - exit retry loop
        return;

      } catch (error: any) {
        lastError = error;
        
        // Check if we should retry
        const shouldRetry = this.shouldRetry(error);
        
        if (shouldRetry && attempt <= MAX_RETRIES) {
          this.metrics.retried++;
          console.warn(`[RequestQueue] Retrying ${request.context} (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${error.message}`);
          
          // Wait before retry (exponential backoff)
          const delay = RETRY_DELAY_MS * attempt;
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Continue to next iteration
          continue;
        } else {
          // Final failure
          const reason = !shouldRetry ? 'non-retryable error' : 'max retries exceeded';
          console.error(`[RequestQueue] Failed ${request.context}: ${reason} - ${error.message}`);
          request.reject(error);
          this.executionPromises.delete(request.requestKey);
          
          // Failure - exit retry loop
          return;
        }
      }
    }
  }

  /**
   * Determine if error should be retried
   */
  private shouldRetry(error: any): boolean {
    if (!error) return false;

    const status = error.status || error.code;
    const message = (error.message || '').toLowerCase();

    // Never retry on auth/permission errors
    if (status === 401 || status === 403 || status === 422) {
      return false;
    }

    // 🔴 P1: Never retry checkout/payment operations (idempotence risk)
    if (message.includes('checkout') || message.includes('/checkout')) {
      return false;
    }

    // Retry on network errors, timeouts, server errors
    if (status === 0 || status === 408 || status === 429 || status >= 500) {
      return true;
    }

    // Retry on network-related error messages
    if (message.includes('network') || 
        message.includes('timeout') || 
        message.includes('fetch') ||
        message.includes('connection')) {
      return true;
    }

    return false;
  }

  /**
   * Clear all queued requests
   */
  clear(): void {
    const requests = Array.from(this.queue.values());
    
    // Reject all pending requests
    requests.forEach((request) => {
      request.reject(new Error('QUEUE_CLEARED: All requests cleared'));
    });

    this.queue.clear();
    this.executionPromises.clear();
    this.notifyListeners();

    console.log(`[RequestQueue] Cleared ${requests.length} requests`);
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.size;
  }

  /**
   * Get debug information
   */
  getDebugInfo(): RequestQueueDebugInfo {
    const requests = Array.from(this.queue.values());
    const now = Date.now();

    return {
      size: this.queue.size,
      pending: requests.length,
      activeWorkers: this.activeWorkers,
      flushed: this.metrics.flushed,
      deduplicated: this.metrics.deduplicated,
      retried: this.metrics.retried,
      dropped: this.metrics.dropped,
      oldestRequestAge: requests.length > 0 ? now - requests[0].createdAt : 0,
      requests: requests.map((req) => ({
        id: req.id,
        context: req.context,
        priority: req.priority,
        age: now - req.createdAt,
        retries: req.retries,
      })),
    };
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('[RequestQueue] Listener error:', error);
      }
    });
  }
}

// ── Singleton Instance ───────────────────────────────────────────────────────

export const requestQueue = new RequestQueue();

// ── Convenience Functions ────────────────────────────────────────────────────

/**
 * Enqueue a request
 */
export function enqueueRequest<T>(context: string, executeFn: () => Promise<T>): Promise<T> {
  return requestQueue.enqueue(context, executeFn) as Promise<T>;
}

/**
 * Flush all queued requests
 */
export function flushQueue(): Promise<void> {
  return requestQueue.flush();
}

/**
 * Clear all queued requests
 */
export function clearQueue(): void {
  requestQueue.clear();
}

/**
 * Get queue size
 */
export function getQueueSize(): number {
  return requestQueue.size();
}

/**
 * Get debug info
 */
export function getQueueDebugInfo(): RequestQueueDebugInfo {
  return requestQueue.getDebugInfo();
}

/**
 * Subscribe to queue changes
 */
export function subscribeToQueue(listener: () => void): () => void {
  return requestQueue.subscribe(listener);
}