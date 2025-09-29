import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { pasRequestHandler } from '../handlers/pas-request-handler';
import { pasInquiryHandler } from '../handlers/pas-inquiry-handler';
import { requireAuth } from '../middleware/auth-middleware';
import { logger } from '../utils/logger';

/**
 * FHIR Claim resource routes for Prior Authorization Support (PAS)
 */
export async function claimRoutes(app: FastifyInstance) {

  // Claim/$submit Operation - Submit Prior Authorization Request
  app.post('/Claim/$submit', {
    schema: {
      description: 'Submit a prior authorization request Bundle',
      tags: ['Prior Authorization'],
      summary: 'Submit PAS request Bundle containing Claim and supporting documentation',
      security: [{ bearerAuth: [] }],
      body: Type.Object({
        resourceType: Type.Literal('Bundle'),
        type: Type.Union([
          Type.Literal('collection'),
          Type.Literal('document')
        ]),
        entry: Type.Array(Type.Object({
          fullUrl: Type.Optional(Type.String()),
          resource: Type.Object({}, { additionalProperties: true })
        }))
      }),
      response: {
        200: Type.Object({
          resourceType: Type.Literal('Bundle'),
          type: Type.Literal('collection'),
          entry: Type.Array(Type.Object({
            resource: Type.Object({}, { additionalProperties: true })
          }))
        }),
        202: Type.Object({
          resourceType: Type.Literal('Task'),
          status: Type.Literal('accepted'),
          focus: Type.Object({
            reference: Type.String()
          })
        }),
        400: Type.Object({
          resourceType: Type.Literal('OperationOutcome'),
          issue: Type.Array(Type.Object({
            severity: Type.Union([
              Type.Literal('error'),
              Type.Literal('warning'),
              Type.Literal('information')
            ]),
            code: Type.String(),
            details: Type.Optional(Type.Object({
              coding: Type.Array(Type.Object({
                system: Type.String(),
                code: Type.String(),
                display: Type.String()
              }))
            })),
            diagnostics: Type.Optional(Type.String())
          }))
        })
      }
    },
    preHandler: [requireAuth(['system/Claim.write', 'user/Claim.write'])],
    handler: submitPriorAuthHandler
  });

  // Claim/$inquire Operation - Inquire About Authorization Status
  app.post('/Claim/$inquire', {
    schema: {
      description: 'Inquire about the status of a prior authorization request',
      tags: ['Prior Authorization'],
      summary: 'Check status of existing prior authorization by identifier or patient',
      security: [{ bearerAuth: [] }],
      body: Type.Object({
        resourceType: Type.Literal('Parameters'),
        parameter: Type.Array(Type.Object({
          name: Type.Union([
            Type.Literal('identifier'),
            Type.Literal('patient'),
            Type.Literal('provider'),
            Type.Literal('authorizationNumber')
          ]),
          valueIdentifier: Type.Optional(Type.Object({
            system: Type.String(),
            value: Type.String()
          })),
          valueReference: Type.Optional(Type.Object({
            reference: Type.String()
          })),
          valueString: Type.Optional(Type.String())
        }))
      }),
      response: {
        200: Type.Object({
          resourceType: Type.Literal('Bundle'),
          type: Type.Literal('searchset'),
          total: Type.Number(),
          entry: Type.Array(Type.Object({
            resource: Type.Object({}, { additionalProperties: true })
          }))
        }),
        404: Type.Object({
          resourceType: Type.Literal('OperationOutcome'),
          issue: Type.Array(Type.Object({
            severity: Type.Literal('error'),
            code: Type.Literal('not-found'),
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
    preHandler: [requireAuth(['system/Claim.read', 'user/Claim.read', 'patient/Claim.read'])],
    handler: inquirePriorAuthHandler
  });
}

/**
 * Handler for Claim/$submit operation
 */
async function submitPriorAuthHandler(
  request: FastifyRequest<{
    Body: {
      resourceType: 'Bundle';
      type: 'collection' | 'document';
      entry: Array<{
        fullUrl?: string;
        resource: any;
      }>;
    };
  }>,
  reply: FastifyReply
) {
  try {
    logger.info('Processing PAS submission request', {
      bundleType: request.body.type,
      entryCount: request.body.entry.length,
      userScopes: request.user?.scopes,
      correlationId: request.id
    });

    // Delegate to PAS request handler
    const result = await pasRequestHandler.submitRequest(request.body, {
      user: request.user,
      correlationId: request.id as string,
      clientIp: request.ip
    });

    if (result.isAsync) {
      reply.code(202).send(result.task);
    } else {
      reply.code(200).send(result.response);
    }
  } catch (error) {
    logger.error('PAS submission failed', {
      error: error.message,
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
            code: 'submission-failed',
            display: 'Prior authorization submission failed'
          }]
        },
        diagnostics: error.message
      }]
    });
  }
}

/**
 * Handler for Claim/$inquire operation
 */
async function inquirePriorAuthHandler(
  request: FastifyRequest<{
    Body: {
      resourceType: 'Parameters';
      parameter: Array<{
        name: string;
        valueIdentifier?: { system: string; value: string };
        valueReference?: { reference: string };
        valueString?: string;
      }>;
    };
  }>,
  reply: FastifyReply
) {
  try {
    logger.info('Processing PAS inquiry request', {
      parameterCount: request.body.parameter.length,
      userScopes: request.user?.scopes,
      correlationId: request.id
    });

    // Extract search parameters
    const searchParams: Record<string, any> = {};
    for (const param of request.body.parameter) {
      if (param.valueIdentifier) {
        searchParams[param.name] = param.valueIdentifier;
      } else if (param.valueReference) {
        searchParams[param.name] = param.valueReference.reference;
      } else if (param.valueString) {
        searchParams[param.name] = param.valueString;
      }
    }

    // Delegate to PAS inquiry handler
    const result = await pasInquiryHandler.searchAuthorizations(searchParams, {
      user: request.user,
      correlationId: request.id as string
    });

    if (result.total === 0) {
      reply.code(404).send({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'not-found',
          details: {
            coding: [{
              system: 'http://fhir-iq.com/CodeSystem/pas-error-codes',
              code: 'authorization-not-found',
              display: 'No matching prior authorization found'
            }]
          },
          diagnostics: 'No prior authorization requests match the provided search criteria'
        }]
      });
    } else {
      reply.code(200).send(result);
    }
  } catch (error) {
    logger.error('PAS inquiry failed', {
      error: error.message,
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
            code: 'inquiry-failed',
            display: 'Prior authorization inquiry failed'
          }]
        },
        diagnostics: error.message
      }]
    });
  }
}