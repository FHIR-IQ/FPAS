#!/usr/bin/env node

import { Worker } from 'bullmq';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { pasProcessingWorker } from './queues/pas-processing-worker';

/**
 * Standalone worker process for processing PAS requests
 * Can be run separately from the main API server for scaling
 */

logger.info('Starting PAS Worker Process');

// Create worker
const worker = new Worker('pas-processing', pasProcessingWorker, {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
  concurrency: config.queue.concurrency || 5,
  stalledInterval: 30000,
  maxStalledCount: 1,
});

// Worker event handlers
worker.on('ready', () => {
  logger.info('=€ PAS Worker ready - waiting for jobs');
});

worker.on('error', (error) => {
  logger.error('Worker error:', error);
});

worker.on('completed', (job, returnvalue) => {
  logger.info('Job completed:', {
    jobId: job.id,
    claimId: job.data.claimId,
    disposition: returnvalue.disposition,
    processingTime: returnvalue.processingTime
  });
});

worker.on('failed', (job, err) => {
  logger.error('Job failed:', {
    jobId: job?.id,
    claimId: job?.data?.claimId,
    error: err.message,
    attemptsMade: job?.attemptsMade
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('=Ñ Shutting down PAS Worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('=Ñ Shutting down PAS Worker...');
  await worker.close();
  process.exit(0);
});

logger.info('=Ë PAS Worker process started successfully');
logger.info(`=' Worker configuration: concurrency=${config.queue.concurrency || 5}`);