import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { claimResponseSearchHandler } from '../handlers/claim-response-search-handler';
import { requireAuth } from '../middleware/auth-middleware';
import { logger } from '../utils/logger';

/**
 * FHIR ClaimResponse resource routes for Prior Authorization responses
 */
export async function claimResponseRoutes(app: FastifyInstance) {

  // GET /ClaimResponse - Search prior authorization responses
  app.get('/ClaimResponse', {
    schema: {
      description: 'Search ClaimResponse resources for prior authorization responses',
      tags: ['Prior Authorization'],
      summary: 'Search authorization responses with filtering support',
      security: [{ bearerAuth: [] }],
      querystring: Type.Object({
        patient: Type.Optional(Type.String({
          description: 'Patient reference for filtering responses'
        })),
        request: Type.Optional(Type.String({
          description: 'Reference to the original Claim request'
        })),
        outcome: Type.Optional(Type.Union([
          Type.Literal('complete'),
          Type.Literal('error'),
          Type.Literal('partial')
        ], {
          description: 'Authorization outcome filter'
        })),
        status: Type.Optional(Type.Union([
          Type.Literal('active'),
          Type.Literal('cancelled'),
          Type.Literal('draft'),
          Type.Literal('entered-in-error')
        ], {
          description: 'ClaimResponse status filter'
        })),
        created: Type.Optional(Type.String({
          description: 'Created date range (ISO 8601 format or date range)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}(T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2}))?$'
        })),
        _count: Type.Optional(Type.Integer({
          description: 'Number of results per page',
          minimum: 1,
          maximum: 100,
          default: 20
        })),
        _offset: Type.Optional(Type.Integer({
          description: 'Offset for pagination',
          minimum: 0,
          default: 0
        })),
        _sort: Type.Optional(Type.Union([
          Type.Literal('created'),
          Type.Literal('-created'),
          Type.Literal('patient'),
          Type.Literal('-patient')
        ], {
          description: 'Sort order for results'
        }))
      }),
      response: {
        200: Type.Object({
          resourceType: Type.Literal('Bundle'),
          type: Type.Literal('searchset'),
          total: Type.Number(),
          link: Type.Optional(Type.Array(Type.Object({
            relation: Type.Union([
              Type.Literal('self'),
              Type.Literal('next'),
              Type.Literal('previous'),
              Type.Literal('first'),
              Type.Literal('last')
            ]),
            url: Type.String()
          }))),
          entry: Type.Array(Type.Object({
            fullUrl: Type.String(),
            resource: Type.Object({
              resourceType: Type.Literal('ClaimResponse'),
              id: Type.String(),
              status: Type.String(),
              outcome: Type.String(),
              patient: Type.Object({
                reference: Type.String()
              }),
              request: Type.Optional(Type.Object({
                reference: Type.String()
              })),
              created: Type.String(),
              disposition: Type.Optional(Type.String())
            }, { additionalProperties: true }),
            search: Type.Optional(Type.Object({
              mode: Type.Literal('match'),
              score: Type.Optional(Type.Number())
            }))
          }))
        }),
        400: Type.Object({
          resourceType: Type.Literal('OperationOutcome'),
          issue: Type.Array(Type.Object({
            severity: Type.Literal('error'),
            code: Type.String(),
            details: Type.Object({
              coding: Type.Array(Type.Object({
                system: Type.String(),
                code: Type.String(),
                display: Type.String()
              }))
            }),
            diagnostics: Type.Optional(Type.String())
          }))
        }),
        403: Type.Object({
          resourceType: Type.Literal('OperationOutcome'),
          issue: Type.Array(Type.Object({
            severity: Type.Literal('error'),
            code: Type.Literal('forbidden'),
            details: Type.Object({
              coding: Type.Array(Type.Object({
                system: Type.String(),
                code: Type.String(),
                display: Type.String()
              }))
            })
          }))
        })
      }
    },
    preHandler: [requireAuth(['user/ClaimResponse.read', 'patient/ClaimResponse.read', 'system/ClaimResponse.read'])],
    handler: searchClaimResponsesHandler
  });

  // GET /ClaimResponse/{id} - Read specific ClaimResponse
  app.get('/ClaimResponse/:id', {
    schema: {
      description: 'Read a specific ClaimResponse resource by ID',
      tags: ['Prior Authorization'],
      summary: 'Retrieve prior authorization response by ID',
      security: [{ bearerAuth: [] }],
      params: Type.Object({
        id: Type.String({
          description: 'ClaimResponse resource ID'
        })
      }),
      response: {
        200: Type.Object({
          resourceType: Type.Literal('ClaimResponse'),
          id: Type.String()
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
    preHandler: [requireAuth(['user/ClaimResponse.read', 'patient/ClaimResponse.read', 'system/ClaimResponse.read'])],
    handler: readClaimResponseHandler
  });
}

/**
 * Handler for ClaimResponse search requests
 */
async function searchClaimResponsesHandler(
  request: FastifyRequest<{
    Querystring: {
      patient?: string;
      request?: string;
      outcome?: 'complete' | 'error' | 'partial';
      status?: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
      created?: string;
      _count?: number;
      _offset?: number;
      _sort?: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    logger.info('Processing ClaimResponse search request', {
      queryParams: request.query,
      userScopes: request.user?.scopes,
      correlationId: request.id
    });

    // Validate patient scoping for patient/ClaimResponse.read scope
    if (request.user?.scopes?.includes('patient/ClaimResponse.read')) {
      if (!request.query.patient) {
        return reply.code(400).send({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'invalid',
            details: {
              coding: [{
                system: 'http://fhir-iq.com/CodeSystem/pas-error-codes',
                code: 'patient-scope-requires-patient-param',
                display: 'Patient scope requires patient parameter'
              }]
            },
            diagnostics: 'When using patient/ClaimResponse.read scope, patient parameter is required'
          }]
        });
      }

      // Validate patient context matches token
      const tokenPatient = request.user?.patient;
      if (tokenPatient && request.query.patient !== tokenPatient) {
        return reply.code(403).send({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'forbidden',
            details: {
              coding: [{
                system: 'http://fhir-iq.com/CodeSystem/pas-error-codes',
                code: 'patient-context-mismatch',
                display: 'Patient parameter does not match token context'
              }]
            },
            diagnostics: `Cannot access data for patient ${request.query.patient} with current token context`
          }]
        });
      }
    }

    // Build search parameters
    const searchParams = {
      patient: request.query.patient,
      request: request.query.request,
      outcome: request.query.outcome,
      status: request.query.status,
      created: request.query.created,
      _count: request.query._count || 20,
      _offset: request.query._offset || 0,
      _sort: request.query._sort || '-created'
    };

    // Delegate to search handler
    const result = await claimResponseSearchHandler.search(searchParams, {
      user: request.user,
      correlationId: request.id as string,
      baseUrl: `${request.protocol}://${request.hostname}${request.url.split('?')[0]}`
    });

    reply.code(200).send(result);

  } catch (error) {
    logger.error('ClaimResponse search failed', {
      error: error.message,
      queryParams: request.query,
      correlationId: request.id,
      stack: error.stack
    });

    reply.code(400).send({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'processing',
        details: {
          coding: [{
            system: 'http://fhir-iq.com/CodeSystem/pas-error-codes',
            code: 'search-failed',
            display: 'ClaimResponse search failed'
          }]
        },
        diagnostics: error.message
      }]
    });
  }
}

/**
 * Handler for reading specific ClaimResponse by ID
 */
async function readClaimResponseHandler(
  request: FastifyRequest<{
    Params: {
      id: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    logger.info('Processing ClaimResponse read request', {
      resourceId: request.params.id,
      userScopes: request.user?.scopes,
      correlationId: request.id
    });

    // Delegate to search handler to read by ID
    const result = await claimResponseSearchHandler.readById(request.params.id, {
      user: request.user,
      correlationId: request.id as string
    });

    if (!result) {
      return reply.code(404).send({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'not-found',
          details: {
            coding: [{
              system: 'http://fhir-iq.com/CodeSystem/pas-error-codes',
              code: 'resource-not-found',
              display: 'ClaimResponse not found'
            }]
          },
          diagnostics: `ClaimResponse with ID ${request.params.id} was not found`
        }]
      });
    }

    reply.code(200).send(result);

  } catch (error) {
    logger.error('ClaimResponse read failed', {
      error: error.message,
      resourceId: request.params.id,
      correlationId: request.id,
      stack: error.stack
    });

    reply.code(400).send({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'processing',
        details: {
          coding: [{
            system: 'http://fhir-iq.com/CodeSystem/pas-error-codes',
            code: 'read-failed',
            display: 'ClaimResponse read failed'
          }]
        },
        diagnostics: error.message
      }]
    });
  }
}