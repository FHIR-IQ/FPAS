import { FastifyInstance } from 'fastify';
import { claimRoutes } from './claim-routes';
import { claimResponseRoutes } from './claim-response-routes';
import { questionnaireRoutes } from './questionnaire-routes';
import { metadataRoutes } from './metadata-routes';
import { dtrLauncherRoutes } from './dtr-launcher-routes';

/**
 * Register all FHIR API routes
 */
export async function registerRoutes(app: FastifyInstance) {
  // FHIR Core Operations
  await app.register(claimRoutes);
  await app.register(claimResponseRoutes);
  await app.register(questionnaireRoutes);
  await app.register(metadataRoutes);

  // DTR Integration
  await app.register(dtrLauncherRoutes);

  // Default route for unsupported operations
  app.all('*', async (request, reply) => {
    reply.code(404).send({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'not-found',
        details: {
          coding: [{
            system: 'http://fhir-iq.com/CodeSystem/pas-error-codes',
            code: 'unsupported-operation',
            display: 'Operation not supported'
          }]
        },
        diagnostics: `Operation ${request.method} ${request.url} is not supported by this server`,
        location: [request.url]
      }]
    });
  });
}