import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { dtrLauncherHandler } from '../handlers/dtr-launcher-handler';
import { requireAuth } from '../middleware/auth-middleware';
import { logger } from '../utils/logger';

/**
 * DTR SMART Launcher routes for prepopulation workflow
 */
export async function dtrLauncherRoutes(app: FastifyInstance) {

  // SMART App Launch endpoint for DTR
  app.get('/smart/launch', {
    schema: {
      description: 'SMART App Launch endpoint for DTR workflow',
      tags: ['DTR', 'SMART'],
      summary: 'Launch DTR questionnaire with SMART context',
      querystring: Type.Object({
        iss: Type.String({
          description: 'FHIR server issuer URL'
        }),
        launch: Type.String({
          description: 'Launch context token'
        }),
        patient: Type.Optional(Type.String({
          description: 'Patient ID for context'
        })),
        encounter: Type.Optional(Type.String({
          description: 'Encounter ID for context'
        })),
        questionnaire: Type.Optional(Type.String({
          description: 'Questionnaire canonical URL or ID'
        })),
        service: Type.Optional(Type.String({
          description: 'Service type for questionnaire selection'
        }))
      }),
      response: {
        200: Type.Object({
          questionnaire: Type.Object({
            resourceType: Type.Literal('Questionnaire')
          }, { additionalProperties: true }),
          context: Type.Object({
            patient: Type.String(),
            encounter: Type.Optional(Type.String()),
            practitioner: Type.Optional(Type.String()),
            organization: Type.Optional(Type.String())
          }),
          launchUrl: Type.String()
        }),
        400: Type.Object({
          resourceType: Type.Literal('OperationOutcome'),
          issue: Type.Array(Type.Object({
            severity: Type.Literal('error'),
            code: Type.String(),
            diagnostics: Type.String()
          }))
        })
      }
    },
    handler: smartLaunchHandler
  });

  // DTR Questionnaire retrieval with context
  app.get('/dtr/questionnaire', {
    schema: {
      description: 'Retrieve DTR questionnaire for specific service',
      tags: ['DTR'],
      summary: 'Get questionnaire by service type or canonical URL',
      querystring: Type.Object({
        service: Type.Optional(Type.String({
          description: 'Service type (e.g., lumbar-mri, cardiac-catheterization)'
        })),
        url: Type.Optional(Type.String({
          description: 'Questionnaire canonical URL'
        })),
        version: Type.Optional(Type.String({
          description: 'Questionnaire version'
        }))
      }),
      response: {
        200: Type.Object({
          resourceType: Type.Literal('Questionnaire')
        }, { additionalProperties: true }),
        404: Type.Object({
          resourceType: Type.Literal('OperationOutcome'),
          issue: Type.Array(Type.Object({
            severity: Type.Literal('error'),
            code: Type.Literal('not-found')
          }))
        })
      }
    },
    handler: getQuestionnaireHandler
  });

  // DTR Prepopulation endpoint
  app.post('/dtr/prepopulate', {
    schema: {
      description: 'Prepopulate questionnaire with patient clinical data',
      tags: ['DTR'],
      summary: 'Execute naive prepopulation using FHIR queries',
      security: [{ bearerAuth: [] }],
      body: Type.Object({
        questionnaire: Type.Union([
          Type.String({ description: 'Questionnaire ID or canonical URL' }),
          Type.Object({
            resourceType: Type.Literal('Questionnaire')
          }, { additionalProperties: true })
        ]),
        context: Type.Object({
          patient: Type.String({ description: 'Patient ID' }),
          encounter: Type.Optional(Type.String({ description: 'Encounter ID' })),
          practitioner: Type.Optional(Type.String({ description: 'Practitioner ID' })),
          organization: Type.Optional(Type.String({ description: 'Organization ID' }))
        })
      }),
      response: {
        200: Type.Object({
          resourceType: Type.Literal('QuestionnaireResponse'),
          status: Type.Literal('in-progress'),
          questionnaire: Type.String(),
          subject: Type.Object({
            reference: Type.String()
          }),
          item: Type.Array(Type.Object({}, { additionalProperties: true }))
        }, { additionalProperties: true }),
        400: Type.Object({
          resourceType: Type.Literal('OperationOutcome'),
          issue: Type.Array(Type.Object({
            severity: Type.Literal('error'),
            code: Type.String(),
            diagnostics: Type.String()
          }))
        })
      }
    },
    preHandler: [requireAuth(['user/Questionnaire.read', 'system/Questionnaire.read'])],
    handler: prepopulateQuestionnaireHandler
  });

  // Complete DTR workflow endpoint (questionnaire + prepopulation)
  app.post('/dtr/launch-and-prepopulate', {
    schema: {
      description: 'Complete DTR workflow: get questionnaire and prepopulate',
      tags: ['DTR'],
      summary: 'End-to-end DTR workflow for PAS integration',
      security: [{ bearerAuth: [] }],
      body: Type.Object({
        service: Type.String({
          description: 'Service type for questionnaire selection'
        }),
        context: Type.Object({
          patient: Type.String(),
          encounter: Type.Optional(Type.String()),
          practitioner: Type.Optional(Type.String()),
          organization: Type.Optional(Type.String())
        })
      }),
      response: {
        200: Type.Object({
          questionnaire: Type.Object({
            resourceType: Type.Literal('Questionnaire')
          }, { additionalProperties: true }),
          questionnaireResponse: Type.Object({
            resourceType: Type.Literal('QuestionnaireResponse')
          }, { additionalProperties: true }),
          prepopulationSummary: Type.Object({
            itemsPopulated: Type.Number(),
            itemsTotal: Type.Number(),
            dataSourcesQueried: Type.Array(Type.String()),
            populationSuccess: Type.Boolean()
          })
        }),
        404: Type.Object({
          resourceType: Type.Literal('OperationOutcome'),
          issue: Type.Array(Type.Object({
            severity: Type.Literal('error'),
            code: Type.Literal('not-found'),
            diagnostics: Type.String()
          }))
        })
      }
    },
    preHandler: [requireAuth(['user/Questionnaire.read', 'system/Questionnaire.read'])],
    handler: launchAndPrepopulateHandler
  });
}

/**
 * SMART App Launch handler
 */
async function smartLaunchHandler(
  request: FastifyRequest<{
    Querystring: {
      iss: string;
      launch: string;
      patient?: string;
      encounter?: string;
      questionnaire?: string;
      service?: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    logger.info('Processing SMART DTR launch', {
      iss: request.query.iss,
      launch: request.query.launch,
      patient: request.query.patient,
      service: request.query.service,
      correlationId: request.id
    });

    const result = await dtrLauncherHandler.handleSmartLaunch(request.query, {
      correlationId: request.id as string,
      userAgent: request.headers['user-agent']
    });

    reply.code(200).send(result);

  } catch (error) {
    logger.error('SMART DTR launch failed', {
      error: error.message,
      query: request.query,
      correlationId: request.id
    });

    reply.code(400).send({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'invalid',
        diagnostics: error.message
      }]
    });
  }
}

/**
 * Get questionnaire handler
 */
async function getQuestionnaireHandler(
  request: FastifyRequest<{
    Querystring: {
      service?: string;
      url?: string;
      version?: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    logger.info('Retrieving DTR questionnaire', {
      service: request.query.service,
      url: request.query.url,
      correlationId: request.id
    });

    const questionnaire = await dtrLauncherHandler.getQuestionnaire(request.query, {
      correlationId: request.id as string
    });

    if (!questionnaire) {
      return reply.code(404).send({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'not-found',
          diagnostics: `Questionnaire not found for service: ${request.query.service || 'unknown'}`
        }]
      });
    }

    reply.code(200).send(questionnaire);

  } catch (error) {
    logger.error('Failed to retrieve questionnaire', {
      error: error.message,
      query: request.query,
      correlationId: request.id
    });

    reply.code(400).send({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'processing',
        diagnostics: error.message
      }]
    });
  }
}

/**
 * Prepopulate questionnaire handler
 */
async function prepopulateQuestionnaireHandler(
  request: FastifyRequest<{
    Body: {
      questionnaire: string | any;
      context: {
        patient: string;
        encounter?: string;
        practitioner?: string;
        organization?: string;
      };
    };
  }>,
  reply: FastifyReply
) {
  try {
    logger.info('Prepopulating questionnaire', {
      questionnaireId: typeof request.body.questionnaire === 'string' ? request.body.questionnaire : request.body.questionnaire.id,
      patient: request.body.context.patient,
      correlationId: request.id
    });

    const result = await dtrLauncherHandler.prepopulateQuestionnaire(
      request.body.questionnaire,
      request.body.context,
      {
        user: request.user,
        correlationId: request.id as string
      }
    );

    reply.code(200).send(result);

  } catch (error) {
    logger.error('Questionnaire prepopulation failed', {
      error: error.message,
      patient: request.body.context.patient,
      correlationId: request.id
    });

    reply.code(400).send({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'processing',
        diagnostics: error.message
      }]
    });
  }
}

/**
 * Launch and prepopulate handler (complete workflow)
 */
async function launchAndPrepopulateHandler(
  request: FastifyRequest<{
    Body: {
      service: string;
      context: {
        patient: string;
        encounter?: string;
        practitioner?: string;
        organization?: string;
      };
    };
  }>,
  reply: FastifyReply
) {
  try {
    logger.info('Executing complete DTR workflow', {
      service: request.body.service,
      patient: request.body.context.patient,
      correlationId: request.id
    });

    const result = await dtrLauncherHandler.launchAndPrepopulate(
      request.body.service,
      request.body.context,
      {
        user: request.user,
        correlationId: request.id as string
      }
    );

    reply.code(200).send(result);

  } catch (error) {
    logger.error('Complete DTR workflow failed', {
      error: error.message,
      service: request.body.service,
      patient: request.body.context.patient,
      correlationId: request.id
    });

    if (error.message.includes('not found')) {
      reply.code(404).send({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'not-found',
          diagnostics: error.message
        }]
      });
    } else {
      reply.code(400).send({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'processing',
          diagnostics: error.message
        }]
      });
    }
  }
}