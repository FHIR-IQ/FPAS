import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { questionnaireHandler } from '../handlers/questionnaire-handler';
import { requireAuth } from '../middleware/auth-middleware';
import { logger } from '../utils/logger';

/**
 * FHIR Questionnaire and QuestionnaireResponse routes for DTR support
 */
export async function questionnaireRoutes(app: FastifyInstance) {

  // GET /Questionnaire - Search questionnaires for DTR
  app.get('/Questionnaire', {
    schema: {
      description: 'Search Questionnaire resources for documentation requirements',
      tags: ['Documentation'],
      summary: 'Retrieve questionnaires for DTR documentation collection',
      security: [{ bearerAuth: [] }],
      querystring: Type.Object({
        url: Type.Optional(Type.String({
          description: 'Canonical URL of the questionnaire',
          format: 'uri'
        })),
        context: Type.Optional(Type.String({
          description: 'Use context (service type) for questionnaire selection'
        })),
        _count: Type.Optional(Type.Integer({
          minimum: 1,
          maximum: 100,
          default: 20
        }))
      }),
      response: {
        200: Type.Object({
          resourceType: Type.Literal('Bundle'),
          type: Type.Literal('searchset'),
          total: Type.Number(),
          entry: Type.Array(Type.Object({
            resource: Type.Object({
              resourceType: Type.Literal('Questionnaire')
            }, { additionalProperties: true })
          }))
        })
      }
    },
    preHandler: [requireAuth(['user/Questionnaire.read', 'system/Questionnaire.read'])],
    handler: searchQuestionnairesHandler
  });

  // GET /Questionnaire/{id} - Read specific questionnaire
  app.get('/Questionnaire/:id', {
    schema: {
      description: 'Read a specific Questionnaire resource by ID',
      tags: ['Documentation'],
      params: Type.Object({
        id: Type.String()
      }),
      response: {
        200: Type.Object({
          resourceType: Type.Literal('Questionnaire')
        }, { additionalProperties: true })
      }
    },
    preHandler: [requireAuth(['user/Questionnaire.read', 'system/Questionnaire.read'])],
    handler: readQuestionnaireHandler
  });

  // POST /Questionnaire/{id}/$populate - Prepopulate questionnaire with patient data
  app.post('/Questionnaire/:id/$populate', {
    schema: {
      description: 'Prepopulate questionnaire with patient data using CQL',
      tags: ['Documentation'],
      summary: 'Execute CQL expressions to prepopulate questionnaire with patient clinical data',
      security: [{ bearerAuth: [] }],
      params: Type.Object({
        id: Type.String({
          description: 'Questionnaire resource ID'
        })
      }),
      body: Type.Object({
        resourceType: Type.Literal('Parameters'),
        parameter: Type.Array(Type.Object({
          name: Type.Union([
            Type.Literal('subject'),
            Type.Literal('practitioner'),
            Type.Literal('organization')
          ]),
          valueReference: Type.Object({
            reference: Type.String()
          })
        }))
      }),
      response: {
        200: Type.Object({
          resourceType: Type.Literal('QuestionnaireResponse')
        }, { additionalProperties: true })
      }
    },
    preHandler: [requireAuth(['user/Questionnaire.read', 'system/Questionnaire.read'])],
    handler: populateQuestionnaireHandler
  });

  // POST /QuestionnaireResponse - Create questionnaire response
  app.post('/QuestionnaireResponse', {
    schema: {
      description: 'Submit completed DTR questionnaire response',
      tags: ['Documentation'],
      summary: 'Create a completed questionnaire response for DTR documentation',
      security: [{ bearerAuth: [] }],
      body: Type.Object({
        resourceType: Type.Literal('QuestionnaireResponse'),
        status: Type.Union([
          Type.Literal('in-progress'),
          Type.Literal('completed')
        ]),
        questionnaire: Type.String(),
        subject: Type.Object({
          reference: Type.String()
        }),
        item: Type.Array(Type.Object({}, { additionalProperties: true }))
      }),
      response: {
        201: Type.Object({
          resourceType: Type.Literal('QuestionnaireResponse')
        }, { additionalProperties: true })
      }
    },
    preHandler: [requireAuth(['user/QuestionnaireResponse.write', 'system/QuestionnaireResponse.write'])],
    handler: createQuestionnaireResponseHandler
  });
}

async function searchQuestionnairesHandler(
  request: FastifyRequest<{
    Querystring: {
      url?: string;
      context?: string;
      _count?: number;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const result = await questionnaireHandler.search(request.query, {
      user: request.user,
      correlationId: request.id as string
    });
    reply.code(200).send(result);
  } catch (error) {
    logger.error('Questionnaire search failed', { error: error.message });
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

async function readQuestionnaireHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const result = await questionnaireHandler.readById(request.params.id, {
      user: request.user,
      correlationId: request.id as string
    });
    if (!result) {
      return reply.code(404).send({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'not-found',
          diagnostics: `Questionnaire ${request.params.id} not found`
        }]
      });
    }
    reply.code(200).send(result);
  } catch (error) {
    logger.error('Questionnaire read failed', { error: error.message });
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

async function populateQuestionnaireHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      resourceType: 'Parameters';
      parameter: Array<{
        name: string;
        valueReference: { reference: string };
      }>;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const result = await questionnaireHandler.populate(request.params.id, request.body, {
      user: request.user,
      correlationId: request.id as string
    });
    reply.code(200).send(result);
  } catch (error) {
    logger.error('Questionnaire populate failed', { error: error.message });
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

async function createQuestionnaireResponseHandler(
  request: FastifyRequest<{
    Body: {
      resourceType: 'QuestionnaireResponse';
      status: string;
      questionnaire: string;
      subject: { reference: string };
      item: any[];
    };
  }>,
  reply: FastifyReply
) {
  try {
    const result = await questionnaireHandler.createResponse(request.body, {
      user: request.user,
      correlationId: request.id as string
    });
    reply.code(201).send(result);
  } catch (error) {
    logger.error('QuestionnaireResponse creation failed', { error: error.message });
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