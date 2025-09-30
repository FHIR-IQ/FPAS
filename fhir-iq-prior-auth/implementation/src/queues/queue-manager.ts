import { Queue, Worker, Job, QueueOptions, WorkerOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { pasProcessingWorker } from './pas-processing-worker';

export interface PASJobData {
  taskId: string;
  claimId: string;
  bundleId: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  submittedAt: string;
  context: {
    userId?: string;
    correlationId: string;
  };
}

/**
 * Queue Manager for handling background processing of PAS requests
 */
export class QueueManager {
  private redis: Redis;
  private pasQueue: Queue<PASJobData>;
  private pasWorker: Worker<PASJobData>;

  constructor() {
    // Initialize Redis connection
    this.redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true
    }) as any;

    // Initialize PAS processing queue
    const queueOptions: QueueOptions = {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50,      // Keep last 50 failed jobs
        attempts: 3,           // Retry failed jobs up to 3 times
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    };

    this.pasQueue = new Queue('pas-processing', queueOptions);

    // Initialize worker
    const workerOptions: WorkerOptions = {
      connection: this.redis,
      concurrency: config.queue.concurrency || 5,
      stalledInterval: 30000,  // Check for stalled jobs every 30 seconds
      maxStalledCount: 1,      // Max times a job can be stalled before failing
    };

    this.pasWorker = new Worker('pas-processing', pasProcessingWorker, workerOptions);

    this.setupEventListeners();
  }

  /**
   * Initialize queues and workers
   */
  async initialize(): Promise<void> {
    try {
      await this.redis.ping();
      logger.info('Redis connection established');

      // Start processing
      logger.info('Queue manager initialized successfully', {
        queueName: 'pas-processing',
        concurrency: config.queue.concurrency || 5
      });

    } catch (error) {
      logger.error('Failed to initialize queue manager', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Add a PAS processing job to the queue
   */
  async addPASProcessingJob(data: PASJobData): Promise<Job<PASJobData>> {
    try {
      const jobOptions = {
        priority: this.getPriorityValue(data.priority),
        delay: 0, // Process immediately
        jobId: `pas-${data.claimId}-${Date.now()}`, // Unique job ID
      };

      const job = await this.pasQueue.add('process-pa-request', data, jobOptions);

      logger.info('PAS processing job added to queue', {
        jobId: job.id,
        claimId: data.claimId,
        taskId: data.taskId,
        priority: data.priority,
        correlationId: data.context.correlationId
      });

      return job;

    } catch (error) {
      logger.error('Failed to add PAS processing job', {
        error: error.message,
        claimId: data.claimId,
        correlationId: data.context.correlationId
      });
      throw error;
    }
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId: string): Promise<any> {
    try {
      const job = await this.pasQueue.getJob(jobId);
      if (!job) {
        return null;
      }

      return {
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        returnvalue: job.returnvalue,
        failedReason: job.failedReason,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        timestamp: job.timestamp,
        attemptsMade: job.attemptsMade,
        opts: job.opts
      };
    } catch (error) {
      logger.error('Failed to get job status', {
        error: error.message,
        jobId
      });
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<any> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.pasQueue.getWaiting(),
        this.pasQueue.getActive(),
        this.pasQueue.getCompleted(),
        this.pasQueue.getFailed(),
        this.pasQueue.getDelayed()
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total: waiting.length + active.length + completed.length + failed.length + delayed.length
      };
    } catch (error) {
      logger.error('Failed to get queue statistics', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Clean up old jobs
   */
  async cleanQueue(olderThan: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      await this.pasQueue.clean(olderThan, 100, 'completed');
      await this.pasQueue.clean(olderThan, 50, 'failed');

      logger.info('Queue cleanup completed', {
        olderThanMs: olderThan
      });
    } catch (error) {
      logger.error('Queue cleanup failed', {
        error: error.message
      });
    }
  }

  /**
   * Gracefully shutdown queue and worker
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down queue manager...');

      await this.pasWorker.close();
      await this.pasQueue.close();
      await this.redis.disconnect();

      logger.info('Queue manager shutdown completed');
    } catch (error) {
      logger.error('Queue manager shutdown failed', {
        error: error.message
      });
    }
  }

  /**
   * Setup event listeners for monitoring
   */
  private setupEventListeners(): void {
    // Queue events
    this.pasQueue.on('error', (error) => {
      logger.error('Queue error', { error: error.message });
    });

    // Worker events
    this.pasWorker.on('ready', () => {
      logger.info('PAS worker ready');
    });

    this.pasWorker.on('error', (error) => {
      logger.error('Worker error', { error: error.message });
    });

    this.pasWorker.on('stalled', (jobId, prev) => {
      logger.warn('Job stalled', { jobId, prev });
    });

    this.pasWorker.on('progress', (job, progress) => {
      logger.debug('Job progress', {
        jobId: job.id,
        progress: progress,
        claimId: job.data.claimId
      });
    });

    this.pasWorker.on('completed', (job, _returnvalue) => {
      logger.info('Job completed successfully', {
        jobId: job.id,
        claimId: job.data.claimId,
        taskId: job.data.taskId,
        processingTime: job.finishedOn ? job.finishedOn - job.processedOn! : 0,
        correlationId: job.data.context.correlationId
      });
    });

    this.pasWorker.on('failed', (job, err) => {
      logger.error('Job failed', {
        jobId: job?.id,
        claimId: job?.data?.claimId,
        taskId: job?.data?.taskId,
        error: err.message,
        attemptsMade: job?.attemptsMade,
        correlationId: job?.data?.context?.correlationId
      });
    });

    // Process termination handlers
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Convert priority string to numeric value for BullMQ
   */
  private getPriorityValue(priority: string): number {
    const priorityMap = {
      'urgent': 1,
      'high': 2,
      'normal': 3,
      'low': 4
    };
    return priorityMap[priority as keyof typeof priorityMap] || 3;
  }
}

// Export singleton instance
export const queueManager = new QueueManager();

/**
 * Initialize queues - called from app startup
 */
export async function initializeQueues(): Promise<void> {
  await queueManager.initialize();
}

/**
 * Shutdown queues - called during app shutdown
 */
export async function shutdownQueues(): Promise<void> {
  await queueManager.shutdown();
}