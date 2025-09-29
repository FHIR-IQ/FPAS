import { logger } from '../utils/logger';

/**
 * Audit Logger service for HIPAA-compliant audit logging
 */
export class AuditLogger {
  async logEvent(event: any): Promise<void> {
    logger.info('Audit event', {
      eventType: event.eventType,
      timestamp: event.timestamp,
      userId: event.userId,
      result: event.result,
      correlationId: event.correlationId
    });

    // In real implementation, would store in dedicated audit database
  }
}

export const auditLogger = new AuditLogger();
