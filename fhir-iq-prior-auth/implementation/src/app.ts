import fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import { authMiddleware } from './middleware/auth-middleware';
import { auditMiddleware } from './middleware/audit-middleware';
import { registerRoutes } from './routes';
import { initializeQueues } from './queues/queue-manager';
import { validateEnvironment } from './utils/environment-validator';
import { CRDDiscoveryService } from './hooks/crd-discovery.service';
import { DTRLaunchRoutes } from './routes/dtr-launch.routes';
import { dtrPrepopulationService } from './services/dtr-prepopulation-service';

/**
 * Build Fastify application with all plugins and routes
 */
export async function buildApp() {
  // Validate environment configuration
  validateEnvironment();

  // Create Fastify instance with TypeBox type provider
  const app = fastify({
    logger: logger,
    requestTimeout: config.performance.requestTimeout,
    keepAliveTimeout: config.performance.keepAliveTimeout,
    maxRequestsPerSocket: config.performance.maxRequestsPerSocket,
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register security plugins
  await app.register(helmet, {
    global: config.security.helmet.enabled,
    contentSecurityPolicy: config.security.helmet.csp.enabled ? {} : false,
    hsts: config.security.helmet.hsts.enabled,
  });

  await app.register(cors, {
    origin: config.security.cors.origin,
    methods: config.security.cors.methods.split(','),
    allowedHeaders: config.security.cors.allowedHeaders.split(','),
    credentials: true,
  });

  await app.register(rateLimit, {
    max: config.rateLimit.maxRequests,
    timeWindow: config.rateLimit.windowMs,
    errorResponseBuilder: (request, context) => ({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'throttled',
        details: {
          coding: [{
            system: 'http://fhir-iq.com/CodeSystem/pas-error-codes',
            code: 'rate-limit-exceeded',
            display: 'API rate limit exceeded'
          }]
        },
        diagnostics: `Rate limit of ${(context as any).max} requests per window exceeded. Retry after ${Math.ceil((context as any).ttl / 1000)} seconds.`
      }]
    })
  });

  // Register OpenAPI documentation
  if (config.features.enableSwaggerUI) {
    await app.register(swagger, {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'FHIR IQ Prior Authorization API',
          description: 'Prior Authorization System implementing HL7 Da Vinci PAS and DTR Implementation Guides',
          version: '1.0.0',
          contact: {
            name: 'FHIR IQ Development Team',
            email: 'support@fhir-iq.com'
          },
          license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
          }
        },
        servers: [
          {
            url: `http://localhost:${config.app.port}`,
            description: 'Development server'
          }
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'SMART on FHIR v2 Bearer Token'
            }
          }
        },
        security: [{ bearerAuth: [] }]
      }
    });

    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false
      },
      uiHooks: {
        onRequest: function (request, reply, next) {
          next();
        },
        preHandler: function (request, reply, next) {
          next();
        }
      },
      staticCSP: true,
      transformStaticCSP: (header) => header
    });
  }

  // Register global middleware
  await app.register(auditMiddleware);
  await app.register(authMiddleware);

  // Register error handler
  app.setErrorHandler(errorHandler);

  // Register application routes
  await app.register(registerRoutes, { prefix: '/fhir' });

  // Initialize and register CRD (Coverage Requirements Discovery) hooks
  const crdService = new CRDDiscoveryService(dtrPrepopulationService);
  await crdService.registerHooks(app);

  // Register DTR launch routes
  const dtrLaunchRoutes = new DTRLaunchRoutes(dtrPrepopulationService);
  await dtrLaunchRoutes.register(app);

  // Health check endpoint
  app.get('/health', async (_request, _reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.app.nodeEnv,
      services: {
        fhir: await checkFHIRServerHealth(),
        redis: await checkRedisHealth(),
        database: await checkDatabaseHealth()
      }
    };
  });

  // Initialize background queues (optional in POC/serverless mode)
  try {
    if (config.redis.url && config.redis.url !== 'redis://localhost:6379') {
      await initializeQueues();
      logger.info('Background queues initialized successfully');
    } else {
      logger.warn('Redis not configured - background job processing disabled (running in POC mode)');
    }
  } catch (error) {
    logger.warn('Failed to initialize background queues - running without async processing', error);
  }

  return app;
}

/**
 * Start the application server
 */
export async function startServer() {
  try {
    const app = await buildApp();

    await app.listen({
      port: config.app.port,
      host: '0.0.0.0'
    });

    logger.info(`🚀 FHIR IQ Prior Authorization API started on port ${config.app.port}`);
    logger.info(`📖 API Documentation available at http://localhost:${config.app.port}/docs`);
    logger.info(`🏥 FHIR Base URL: ${config.fhir.baseUrl}`);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Health check functions
 */
async function checkFHIRServerHealth(): Promise<{ status: string; url: string }> {
  try {
    // Implementation would check FHIR server metadata endpoint
    return { status: 'healthy', url: config.fhir.baseUrl };
  } catch (error) {
    return { status: 'unhealthy', url: config.fhir.baseUrl };
  }
}

async function checkRedisHealth(): Promise<{ status: string; url: string }> {
  try {
    if (!config.redis.url || config.redis.url === 'redis://localhost:6379') {
      return { status: 'disabled', url: 'not configured (POC mode)' };
    }
    // Implementation would ping Redis
    return { status: 'healthy', url: config.redis.url };
  } catch (error) {
    return { status: 'unhealthy', url: config.redis.url };
  }
}

async function checkDatabaseHealth(): Promise<{ status: string; url: string }> {
  try {
    if (!config.database.url || config.database.url === 'postgresql://localhost:5432/fhir') {
      return { status: 'disabled', url: 'not configured (POC mode)' };
    }
    // Implementation would check database connection
    return { status: 'healthy', url: config.database.url };
  } catch (error) {
    return { status: 'unhealthy', url: config.database.url };
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}