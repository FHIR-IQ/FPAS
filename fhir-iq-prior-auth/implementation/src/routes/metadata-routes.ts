import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { logger } from '../utils/logger';

/**
 * FHIR metadata and capability routes
 */
export async function metadataRoutes(app: FastifyInstance) {

  // GET /metadata - Server CapabilityStatement
  app.get('/metadata', {
    schema: {
      description: 'Server capability statement describing supported FHIR operations',
      tags: ['System'],
      summary: 'Retrieve FHIR CapabilityStatement for this server',
      response: {
        200: Type.Object({
          resourceType: Type.Literal('CapabilityStatement'),
          status: Type.String(),
          fhirVersion: Type.String(),
          format: Type.Array(Type.String()),
          rest: Type.Array(Type.Object({}, { additionalProperties: true }))
        }, { additionalProperties: true })
      }
    },
    handler: getCapabilityStatementHandler
  });
}

/**
 * Handler for FHIR CapabilityStatement endpoint
 */
async function getCapabilityStatementHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    logger.info('Serving CapabilityStatement', {
      correlationId: request.id,
      userAgent: request.headers['user-agent']
    });

    // Return the server's capability statement
    const capabilityStatement = {
      resourceType: 'CapabilityStatement',
      id: 'payer-pas-server',
      url: 'http://fhir-iq.com/CapabilityStatement/payer-pas-server',
      version: '1.0.0',
      name: 'PayerPASServerCapabilityStatement',
      title: 'Payer Prior Authorization Support Server Capability Statement',
      status: 'draft',
      experimental: true,
      date: new Date().toISOString().split('T')[0],
      publisher: 'FHIR IQ Prior Authorization POC',
      contact: [{
        name: 'FHIR IQ Integration Team',
        telecom: [{
          system: 'email',
          value: 'integration@fhir-iq.com'
        }]
      }],
      description: 'Capability Statement for FHIR IQ Prior Authorization Support (PAS) server implementing Da Vinci PAS and DTR IGs for CMS-0057-F compliance demonstration',
      jurisdiction: [{
        coding: [{
          system: 'urn:iso:std:iso:3166',
          code: 'US',
          display: 'United States of America'
        }]
      }],
      kind: 'instance',
      software: {
        name: 'FHIR IQ PAS Server',
        version: '1.0.0-poc',
        releaseDate: new Date().toISOString().split('T')[0]
      },
      implementation: {
        description: 'FHIR IQ POC Prior Authorization Support server',
        url: `${request.protocol}://${request.hostname}/fhir`
      },
      fhirVersion: '4.0.1',
      format: ['application/fhir+json'],
      patchFormat: ['application/json-patch+json'],
      implementationGuide: [
        'http://hl7.org/fhir/us/davinci-pas/ImplementationGuide/hl7.fhir.us.davinci-pas',
        'http://hl7.org/fhir/us/davinci-dtr/ImplementationGuide/hl7.fhir.us.davinci-dtr',
        'http://hl7.org/fhir/us/davinci-hrex/ImplementationGuide/hl7.fhir.us.davinci-hrex',
        'http://hl7.org/fhir/us/core/ImplementationGuide/hl7.fhir.us.core'
      ],
      rest: [{
        mode: 'server',
        documentation: 'FHIR IQ Prior Authorization Support Server with DTR integration',
        security: {
          cors: true,
          service: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
              code: 'OAuth',
              display: 'OAuth2'
            }],
            text: 'OAuth2 with SMART on FHIR v2 scopes'
          }],
          description: 'OAuth2 implementation with SMART backend services and patient/provider access'
        },
        resource: [
          {
            type: 'Claim',
            profile: 'http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claim',
            documentation: 'Prior authorization requests submitted as Claim resources',
            interaction: [
              { code: 'read', documentation: 'Read prior authorization request' },
              { code: 'search-type', documentation: 'Search prior authorization requests' }
            ],
            searchParam: [
              {
                name: 'patient',
                definition: 'http://hl7.org/fhir/SearchParameter/Claim-patient',
                type: 'reference',
                documentation: 'Patient receiving the services'
              },
              {
                name: 'status',
                definition: 'http://hl7.org/fhir/SearchParameter/Claim-status',
                type: 'token',
                documentation: 'The status of the claim'
              }
            ]
          },
          {
            type: 'ClaimResponse',
            profile: 'http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claimresponse',
            documentation: 'Prior authorization responses',
            interaction: [
              { code: 'read', documentation: 'Read prior authorization response' },
              { code: 'search-type', documentation: 'Search prior authorization responses' }
            ],
            searchParam: [
              {
                name: 'request',
                definition: 'http://hl7.org/fhir/SearchParameter/ClaimResponse-request',
                type: 'reference',
                documentation: 'The claim reference'
              },
              {
                name: 'outcome',
                definition: 'http://hl7.org/fhir/SearchParameter/ClaimResponse-outcome',
                type: 'token',
                documentation: 'The processing outcome'
              }
            ]
          },
          {
            type: 'Questionnaire',
            documentation: 'DTR questionnaires for documentation requirements',
            interaction: [
              { code: 'read', documentation: 'Read questionnaire' },
              { code: 'search-type', documentation: 'Search questionnaires' }
            ],
            searchParam: [
              {
                name: 'url',
                definition: 'http://hl7.org/fhir/SearchParameter/Questionnaire-url',
                type: 'uri',
                documentation: 'The uri that identifies the questionnaire'
              },
              {
                name: 'context',
                definition: 'http://hl7.org/fhir/SearchParameter/Questionnaire-context',
                type: 'token',
                documentation: 'A use context assigned to the questionnaire'
              }
            ]
          },
          {
            type: 'QuestionnaireResponse',
            documentation: 'Completed DTR questionnaire responses',
            interaction: [
              { code: 'create', documentation: 'Create questionnaire response' },
              { code: 'read', documentation: 'Read questionnaire response' },
              { code: 'search-type', documentation: 'Search questionnaire responses' }
            ]
          }
        ],
        operation: [
          {
            name: 'submit',
            definition: 'http://hl7.org/fhir/us/davinci-pas/OperationDefinition/Claim-submit',
            documentation: 'Submit a PAS request Bundle; returns ClaimResponse Bundle.'
          },
          {
            name: 'inquire',
            definition: 'http://hl7.org/fhir/us/davinci-pas/OperationDefinition/Claim-inquire',
            documentation: 'Check status of existing PA.'
          },
          {
            name: 'populate',
            definition: 'http://hl7.org/fhir/uv/sdc/OperationDefinition/Questionnaire-populate',
            documentation: 'Prepopulate questionnaire with patient data via CQL'
          }
        ]
      }]
    };

    reply.code(200).send(capabilityStatement);

  } catch (error) {
    logger.error('Failed to serve CapabilityStatement', {
      error: error.message,
      correlationId: request.id,
      stack: error.stack
    });

    reply.code(500).send({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        details: {
          coding: [{
            system: 'http://fhir-iq.com/CodeSystem/pas-error-codes',
            code: 'internal-server-error',
            display: 'Internal server error'
          }]
        },
        diagnostics: 'Failed to retrieve server capability statement'
      }]
    });
  }
}