import pino from 'pino';

// Load config inline to avoid circular dependencies
const logLevel = process.env.LOG_LEVEL || 'info';
const prettyPrint = process.env.LOG_PRETTY_PRINT === 'true' || process.env.NODE_ENV === 'development';

/**
 * Logger instance using Pino for structured logging
 * Compatible with Fastify's logger interface
 */
export const logger = pino({
  level: logLevel,
  transport: prettyPrint
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
}) as any; // Cast to any for Fastify compatibility

export default logger;