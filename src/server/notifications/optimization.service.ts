// Notification Optimization Service - Increment 6: Optimisations
// Cache, batch processing, compression, sampling

import { getNotificationLogger } from './notification-logger';

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // milliseconds
  maxSize: number; // max items
}

export interface BatchConfig {
  enabled: boolean;
  maxBatchSize: number;
  flushInterval: number; // milliseconds
}

export interface CompressionConfig {
  enabled: boolean;
  algorithm: 'gzip' | 'deflate' | 'none';
  threshold: number; // bytes - compress only if larger
}

export interface SamplingConfig {
  enabled: boolean;
  rate: number; // 0-1, sample every X%
  minInterval: number; // minimum ms between samples
}

export interface OptimizationConfig {
  cache?: CacheConfig;
  batch?: BatchConfig;
  compression?: CompressionConfig;
  sampling?: SamplingConfig;
}

export interface CachedItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface BatchJob<T> {
  data: T;
  timestamp: number;
}

export class NotificationOptimizationService {
  private cache: Map<string, CachedItem<any>> = new Map();
  private batchQueue: Map<string, BatchJob<any>[]> = new Map();
  private config: Required<OptimizationConfig>;
  private logger = getNotificationLogger();
  private batchIntervalId: NodeJS.Timeout | null = null;

  constructor(config?: OptimizationConfig) {
    this.config = {
      cache: {
        enabled: config?.cache?.enabled ?? true,
        ttl: config?.cache?.ttl ?? 300000, // 5 minutes
        maxSize: config?.cache?.maxSize ?? 1000,
      },
      batch: {
        enabled: config?.batch?.enabled ?? true,
        maxBatchSize: config?.batch?.maxBatchSize ?? 50,
        flushInterval: config?.batch?.flushInterval ?? 5000, // 5 seconds
      },
      compression: {
        enabled: config?.compression?.enabled ?? true,
        algorithm: config?.compression?.algorithm ?? 'none',
        threshold: config?.compression?.threshold ?? 1024, // 1 KB
      },
      sampling: {
        enabled: config?.sampling?.enabled ?? false,
        rate: config?.sampling?.rate ?? 0.1, // 10%
        minInterval: config?.sampling?.minInterval ?? 60000, // 1 minute
      },
    };

    if (this.config.batch.enabled) {
      this.startBatchProcessor();
    }

    console.log('[NotificationOptimization] Initialized with config:', this.config);
  }

  // ==================== CACHE ====================

  /**
   * Get item from cache
   */
  get<T>(key: string): T | null {
    if (!this.config.cache.enabled) {
      return null;
    }

    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    this.logger.log({
      eventType: 'cache_hit',
      level: 'info',
      category: 'optimization',
      message: `Cache hit: ${key}`,
      data: { key, age: Date.now() - item.timestamp },
    });

    return item.data;
  }

  /**
   * Set item in cache
   */
  set<T>(key: string, data: T): void {
    if (!this.config.cache.enabled) {
      return;
    }

    // Check cache size limit
    if (this.cache.size >= this.config.cache.maxSize) {
      this.evictOldest();
    }

    const now = Date.now();
    const item: CachedItem<T> = {
      data,
      timestamp: now,
      expiresAt: now + this.config.cache.ttl,
    };

    this.cache.set(key, item);

    this.logger.log({
      eventType: 'cache_set',
      level: 'info',
      category: 'optimization',
      message: `Cache set: ${key}`,
      data: { key, ttl: this.config.cache.ttl },
    });
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    return existed;
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Evict oldest items when cache is full
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.logger.log({
        eventType: 'cache_evict',
        level: 'info',
        category: 'optimization',
        message: `Cache evicted: ${oldestKey}`,
      });
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[NotificationOptimization] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    misses: number;
    hits: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.cache.maxSize,
      hitRate: 0, // TODO: Implement hit/miss tracking
      misses: 0,
      hits: 0,
    };
  }

  // ==================== BATCH PROCESSING ====================

  /**
   * Add item to batch queue
   */
  addToBatch<T>(batchKey: string, data: T): void {
    if (!this.config.batch.enabled) {
      return;
    }

    const batch = this.batchQueue.get(batchKey) || [];
    const job: BatchJob<T> = {
      data,
      timestamp: Date.now(),
    };

    batch.push(job);

    // Check if batch is full
    if (batch.length >= this.config.batch.maxBatchSize) {
      this.flushBatch(batchKey);
    } else {
      this.batchQueue.set(batchKey, batch);
    }
  }

  /**
   * Flush a specific batch
   */
  async flushBatch<T>(batchKey: string): Promise<T[]> {
    const batch = this.batchQueue.get(batchKey);
    
    if (!batch || batch.length === 0) {
      return [];
    }

    const items = batch.map(job => job.data);
    this.batchQueue.delete(batchKey);

    this.logger.log({
      eventType: 'batch_flush',
      level: 'info',
      category: 'optimization',
      message: `Batch flushed: ${batchKey}`,
      data: { batchKey, count: items.length },
    });

    return items;
  }

  /**
   * Start batch processor (auto-flush)
   */
  private startBatchProcessor(): void {
    if (this.batchIntervalId) {
      return;
    }

    this.batchIntervalId = setInterval(() => {
      this.flushAllBatches();
    }, this.config.batch.flushInterval);

    console.log(`[NotificationOptimization] Batch processor started (interval: ${this.config.batch.flushInterval}ms)`);
  }

  /**
   * Stop batch processor
   */
  stopBatchProcessor(): void {
    if (this.batchIntervalId) {
      clearInterval(this.batchIntervalId);
      this.batchIntervalId = null;
      console.log('[NotificationOptimization] Batch processor stopped');
    }
  }

  /**
   * Flush all batches
   */
  async flushAllBatches(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const batchKey of this.batchQueue.keys()) {
      promises.push(
        this.flushBatch(batchKey).then(items => {
          // Process items (user-defined)
          this.processBatchItems(batchKey, items);
        })
      );
    }

    await Promise.all(promises);
  }

  /**
   * Process batch items (override this method)
   */
  private processBatchItems<T>(batchKey: string, items: T[]): void {
    // Default: just log
    this.logger.log({
      eventType: 'batch_processed',
      level: 'info',
      category: 'optimization',
      message: `Batch processed: ${batchKey}`,
      data: { batchKey, count: items.length },
    });
  }

  // ==================== COMPRESSION ====================

  /**
   * Compress data if needed
   */
  compress(data: string): string {
    if (!this.config.compression.enabled) {
      return data;
    }

    // Check threshold
    if (data.length < this.config.compression.threshold) {
      return data;
    }

    // TODO: Implement actual compression
    // For now, just return as-is
    return data;
  }

  /**
   * Decompress data
   */
  decompress(data: string): string {
    if (!this.config.compression.enabled) {
      return data;
    }

    // TODO: Implement actual decompression
    return data;
  }

  // ==================== SAMPLING ====================

  /**
   * Should we sample this event?
   */
  shouldSample(lastSampleTime: number | null): boolean {
    if (!this.config.sampling.enabled) {
      return true; // Always process if sampling disabled
    }

    // Random check
    if (Math.random() > this.config.sampling.rate) {
      return false;
    }

    // Check minimum interval
    if (lastSampleTime && (Date.now() - lastSampleTime) < this.config.sampling.minInterval) {
      return false;
    }

    return true;
  }

  // ==================== UTILITIES ====================

  /**
   * Get batch queue size
   */
  getBatchQueueSize(): number {
    let total = 0;
    for (const batch of this.batchQueue.values()) {
      total += batch.length;
    }
    return total;
  }

  /**
   * Get batch queue statistics
   */
  getBatchStats(): {
    queueSize: number;
    batchCount: number;
    batches: Array<{ key: string; count: number }>;
  } {
    const batches: Array<{ key: string; count: number }> = [];
    
    for (const [key, batch] of this.batchQueue.entries()) {
      batches.push({ key, count: batch.length });
    }

    return {
      queueSize: this.getBatchQueueSize(),
      batchCount: this.batchQueue.size,
      batches,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OptimizationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      cache: { ...this.config.cache, ...config.cache },
      batch: { ...this.config.batch, ...config.batch },
      compression: { ...this.config.compression, ...config.compression },
      sampling: { ...this.config.sampling, ...config.sampling },
    };

    // Restart batch processor if needed
    if (this.config.batch.enabled && !this.batchIntervalId) {
      this.startBatchProcessor();
    } else if (!this.config.batch.enabled && this.batchIntervalId) {
      this.stopBatchProcessor();
    }

    console.log('[NotificationOptimization] Config updated:', this.config);
  }

  /**
   * Get statistics
   */
  getStats(): {
    cache: { size: number; maxSize: number; hitRate: number; misses: number; hits: number };
    batch: { queueSize: number; batchCount: number; batches: Array<{ key: string; count: number }> };
    config: Required<OptimizationConfig>;
  } {
    return {
      cache: this.getCacheStats(),
      batch: this.getBatchStats(),
      config: this.config,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.clearCache();
    this.batchQueue.clear();
    console.log('[NotificationOptimization] All data cleared');
  }
}

// Singleton instance
let optimizationInstance: NotificationOptimizationService | null = null;

/**
 * Create notification optimization service instance
 */
export function createNotificationOptimizationService(config?: OptimizationConfig): NotificationOptimizationService {
  if (!optimizationInstance) {
    optimizationInstance = new NotificationOptimizationService(config);
  }
  return optimizationInstance;
}

/**
 * Get existing notification optimization service instance
 */
export function getNotificationOptimizationService(): NotificationOptimizationService | null {
  return optimizationInstance;
}