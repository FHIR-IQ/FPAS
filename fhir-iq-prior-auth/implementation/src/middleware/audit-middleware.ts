import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Ensure this file is treated as a module
export {};

// Extend FastifyRequest to include user property (defined in auth-middleware.ts)
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      sub: string;
      scopes: string[];
      patient?: string;
      practitioner?: string;
      organization?: string;
      iss?: string;
      aud?: string;
      exp?: number;
    };
  }
}

/**
 * Audit logging middleware for Fastify
 * Logs all incoming requests and outgoing responses for compliance and debugging
 */
export async function auditMiddleware(app: FastifyInstance): Promise<void> {
  // Add correlation ID to requests
  app.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Generate or extract correlation ID
    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      (request.headers['x-request-id'] as string) ||
      uuidv4();

    // Store correlation ID for use in response
    (request as any).correlationId = correlationId;

    // Log incoming request
    logger.info('Incoming request', {
      correlationId,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId: request.user?.sub,
      organization: request.user?.organization,
    });
  });

  // Log responses
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const correlationId = (request as any).correlationId;
    const responseTime = reply.getResponseTime();

    logger.info('Outgoing response', {
      correlationId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: `${responseTime.toFixed(2)}ms`,
      userId: request.user?.sub,
    });
  });

  // Log errors
  app.addHook('onError', async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
    const correlationId = (request as any).correlationId;

    logger.error('Request error', {
      correlationId,
      method: request.method,
      url: request.url,
      error: error.message,
      stack: error.stack,
      userId: request.user?.sub,
    });
  });
}