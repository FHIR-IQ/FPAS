import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../utils/logger';

// Ensure this file is treated as a module
export {};

/**
 * Global error handler for Fastify
 * Converts errors to FHIR OperationOutcome format
 */
export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Log the error
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    statusCode: error.statusCode || 500,
    method: request.method,
    url: request.url,
    correlationId: request.headers['x-correlation-id'],
  });

  // Determine status code
  const statusCode = error.statusCode || error.validation ? 400 : 500;

  // Handle validation errors
  if (error.validation) {
    return reply.code(statusCode).send({
      resourceType: 'OperationOutcome',
      issue: error.validation.map((validationError) => ({
        severity: 'error',
        code: 'invalid',
        details: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/operation-outcome',
              code: 'MSG_PARAM_INVALID',
              display: 'Parameter invalid',
            },
          ],
        },
        diagnostics: `${validationError.instancePath} ${validationError.message}`,
        expression: [validationError.instancePath],
      })),
    });
  }

  // Handle FHIR errors (errors that already have OperationOutcome)
  if ((error as any).operationOutcome) {
    return reply.code(statusCode).send((error as any).operationOutcome);
  }

  // Build generic OperationOutcome
  const operationOutcome = {
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity: statusCode >= 500 ? 'error' : 'warning',
        code: statusCode >= 500 ? 'exception' : 'processing',
        details: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/operation-outcome',
              code: error.code || 'EXCEPTION',
              display: error.name || 'Error',
            },
          ],
        },
        diagnostics:
          process.env.NODE_ENV === 'production'
            ? 'An error occurred processing your request'
            : error.message,
      },
    ],
  };

  return reply.code(statusCode).send(operationOutcome);
}