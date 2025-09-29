/**
 * Patient Access API Routes
 *
 * Implements CMS Patient Access API requirements for January 1, 2027 compliance.
 * Provides patients access to their claims, coverage, and prior authorization data.
 *
 * Follows Da Vinci PDex IG v2.1.0 and US Core v6.1.0 specifications.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Bundle, Patient, Coverage, Claim, ClaimResponse, ExplanationOfBenefit } from 'fhir/r4';
import { logger } from '../../utils/logger';

interface PatientAccessRequest extends FastifyRequest {
  params: {
    id?: string;
  };
  query: {
    _since?: string;
    _count?: string;
    _offset?: string;
    patient?: string;
    status?: string;
    date?: string;
    type?: string;
  };
}

/**
 * Patient Access API Routes Handler
 *
 * Implements required endpoints for CMS Patient Access API compliance:
 * - Patient/$everything
 * - Coverage (active and historical)
 * - Claim (submitted prior authorizations)
 * - ClaimResponse (PA decisions)
 * - ExplanationOfBenefit (claims processing results)
 */
export class PatientAccessRoutes {

  /**
   * Register Patient Access API routes
   */
  async register(server: FastifyInstance): Promise<void> {
    // Patient $everything operation
    server.get('/Patient/:id/$everything', async (request: PatientAccessRequest, reply: FastifyReply) => {
      return await this.getPatientEverything(request, reply);
    });

    // Patient bulk export (for member attribution)
    server.get('/Patient/$export', async (request: PatientAccessRequest, reply: FastifyReply) => {
      return await this.initiateBulkExport(request, reply, 'Patient');
    });

    // Coverage resources
    server.get('/Coverage', async (request: PatientAccessRequest, reply: FastifyReply) => {
      return await this.getCoverage(request, reply);
    });

    server.get('/Coverage/:id', async (request: PatientAccessRequest, reply: FastifyReply) => {
      return await this.getCoverageById(request, reply);
    });

    // Claim resources (prior authorization requests)
    server.get('/Claim', async (request: PatientAccessRequest, reply: FastifyReply) => {
      return await this.getClaims(request, reply);
    });

    server.get('/Claim/:id', async (request: PatientAccessRequest, reply: FastifyReply) => {
      return await this.getClaimById(request, reply);
    });

    // ClaimResponse resources (PA decisions)
    server.get('/ClaimResponse', async (request: PatientAccessRequest, reply: FastifyReply) => {
      return await this.getClaimResponses(request, reply);
    });

    server.get('/ClaimResponse/:id', async (request: PatientAccessRequest, reply: FastifyReply) => {
      return await this.getClaimResponseById(request, reply);
    });

    // ExplanationOfBenefit resources
    server.get('/ExplanationOfBenefit', async (request: PatientAccessRequest, reply: FastifyReply) => {
      return await this.getExplanationOfBenefits(request, reply);
    });

    server.get('/ExplanationOfBenefit/:id', async (request: PatientAccessRequest, reply: FastifyReply) => {
      return await this.getExplanationOfBenefitById(request, reply);
    });

    logger.info('Patient Access API routes registered');
  }

  /**
   * Get all patient data ($everything operation)
   */
  private async getPatientEverything(request: PatientAccessRequest, reply: FastifyReply): Promise<Bundle> {
    const patientId = request.params.id;
    const since = request.query._since;

    logger.info('Patient $everything request', {
      patientId,
      since,
      userAgent: request.headers['user-agent']
    });

    try {
      // Validate patient access
      await this.validatePatientAccess(request, patientId);

      // Build comprehensive patient bundle
      const bundle = await this.buildPatientEverythingBundle(patientId, since);

      logger.info('Patient $everything response generated', {
        patientId,
        entryCount: bundle.entry?.length || 0,
        totalSize: JSON.stringify(bundle).length
      });

      return bundle;

    } catch (error) {
      logger.error('Patient $everything failed', {
        error: error.message,
        patientId
      });
      throw error;
    }
  }

  /**
   * Get coverage information for patient
   */
  private async getCoverage(request: PatientAccessRequest, reply: FastifyReply): Promise<Bundle> {
    const patientParam = request.query.patient;
    const status = request.query.status;

    logger.info('Coverage search request', {
      patient: patientParam,
      status
    });

    try {
      // Validate patient parameter
      if (!patientParam) {
        return reply.code(400).send({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            details: { text: 'Patient parameter is required' }
          }]
        });
      }

      await this.validatePatientAccess(request, patientParam);

      // Generate sample coverage data
      const coverage = this.generateSampleCoverage(patientParam, status);

      const bundle: Bundle = {
        resourceType: 'Bundle',
        id: `coverage-search-${Date.now()}`,
        type: 'searchset',
        timestamp: new Date().toISOString(),
        total: coverage.length,
        entry: coverage.map(cov => ({
          resource: cov,
          search: { mode: 'match' }
        }))
      };

      return bundle;

    } catch (error) {
      logger.error('Coverage search failed', {
        error: error.message,
        patient: patientParam
      });
      throw error;
    }
  }

  /**
   * Get specific coverage by ID
   */
  private async getCoverageById(request: PatientAccessRequest, reply: FastifyReply): Promise<Coverage> {
    const coverageId = request.params.id;

    logger.info('Coverage read request', { coverageId });

    try {
      const coverage = this.generateSampleCoverage('patient-123')[0];
      coverage.id = coverageId;

      return coverage;

    } catch (error) {
      logger.error('Coverage read failed', {
        error: error.message,
        coverageId
      });
      throw error;
    }
  }

  /**
   * Get claims (prior authorization requests) for patient
   */
  private async getClaims(request: PatientAccessRequest, reply: FastifyReply): Promise<Bundle> {
    const patientParam = request.query.patient;
    const status = request.query.status;
    const dateParam = request.query.date;

    logger.info('Claim search request', {
      patient: patientParam,
      status,
      date: dateParam
    });

    try {
      if (!patientParam) {
        return reply.code(400).send({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            details: { text: 'Patient parameter is required' }
          }]
        });
      }

      await this.validatePatientAccess(request, patientParam);

      // Generate sample claims
      const claims = this.generateSampleClaims(patientParam, status, dateParam);

      const bundle: Bundle = {
        resourceType: 'Bundle',
        id: `claim-search-${Date.now()}`,
        type: 'searchset',
        timestamp: new Date().toISOString(),
        total: claims.length,
        entry: claims.map(claim => ({
          resource: claim,
          search: { mode: 'match' }
        }))
      };

      return bundle;

    } catch (error) {
      logger.error('Claim search failed', {
        error: error.message,
        patient: patientParam
      });
      throw error;
    }
  }

  /**
   * Get specific claim by ID
   */
  private async getClaimById(request: PatientAccessRequest, reply: FastifyReply): Promise<Claim> {
    const claimId = request.params.id;

    logger.info('Claim read request', { claimId });

    try {
      const claim = this.generateSampleClaims('patient-123')[0];
      claim.id = claimId;

      return claim;

    } catch (error) {
      logger.error('Claim read failed', {
        error: error.message,
        claimId
      });
      throw error;
    }
  }

  /**
   * Get claim responses (PA decisions) for patient
   */
  private async getClaimResponses(request: PatientAccessRequest, reply: FastifyReply): Promise<Bundle> {
    const patientParam = request.query.patient;
    const status = request.query.status;

    logger.info('ClaimResponse search request', {
      patient: patientParam,
      status
    });

    try {
      if (!patientParam) {
        return reply.code(400).send({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            details: { text: 'Patient parameter is required' }
          }]
        });
      }

      await this.validatePatientAccess(request, patientParam);

      // Generate sample claim responses
      const claimResponses = this.generateSampleClaimResponses(patientParam, status);

      const bundle: Bundle = {
        resourceType: 'Bundle',
        id: `claimresponse-search-${Date.now()}`,
        type: 'searchset',
        timestamp: new Date().toISOString(),
        total: claimResponses.length,
        entry: claimResponses.map(claimResponse => ({
          resource: claimResponse,
          search: { mode: 'match' }
        }))
      };

      return bundle;

    } catch (error) {
      logger.error('ClaimResponse search failed', {
        error: error.message,
        patient: patientParam
      });
      throw error;
    }
  }

  /**
   * Get specific claim response by ID
   */
  private async getClaimResponseById(request: PatientAccessRequest, reply: FastifyReply): Promise<ClaimResponse> {
    const claimResponseId = request.params.id;

    logger.info('ClaimResponse read request', { claimResponseId });

    try {
      const claimResponse = this.generateSampleClaimResponses('patient-123')[0];
      claimResponse.id = claimResponseId;

      return claimResponse;

    } catch (error) {
      logger.error('ClaimResponse read failed', {
        error: error.message,
        claimResponseId
      });
      throw error;
    }
  }

  /**
   * Get explanation of benefits for patient
   */
  private async getExplanationOfBenefits(request: PatientAccessRequest, reply: FastifyReply): Promise<Bundle> {
    const patientParam = request.query.patient;

    logger.info('ExplanationOfBenefit search request', { patient: patientParam });

    try {
      if (!patientParam) {
        return reply.code(400).send({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            details: { text: 'Patient parameter is required' }
          }]
        });
      }

      await this.validatePatientAccess(request, patientParam);

      // Generate sample EOBs
      const eobs = this.generateSampleExplanationOfBenefits(patientParam);

      const bundle: Bundle = {
        resourceType: 'Bundle',
        id: `eob-search-${Date.now()}`,
        type: 'searchset',
        timestamp: new Date().toISOString(),
        total: eobs.length,
        entry: eobs.map(eob => ({
          resource: eob,
          search: { mode: 'match' }
        }))
      };

      return bundle;

    } catch (error) {
      logger.error('ExplanationOfBenefit search failed', {
        error: error.message,
        patient: patientParam
      });
      throw error;
    }
  }

  /**
   * Get specific explanation of benefit by ID
   */
  private async getExplanationOfBenefitById(request: PatientAccessRequest, reply: FastifyReply): Promise<ExplanationOfBenefit> {
    const eobId = request.params.id;

    logger.info('ExplanationOfBenefit read request', { eobId });

    try {
      const eob = this.generateSampleExplanationOfBenefits('patient-123')[0];
      eob.id = eobId;

      return eob;

    } catch (error) {
      logger.error('ExplanationOfBenefit read failed', {
        error: error.message,
        eobId
      });
      throw error;
    }
  }

  /**
   * Initiate bulk data export
   */
  private async initiateBulkExport(request: PatientAccessRequest, reply: FastifyReply, resourceType: string): Promise<any> {
    logger.info('Bulk export request initiated', { resourceType });

    const exportId = `export-${Date.now()}`;
    const statusUrl = `${request.protocol}://${request.hostname}/bulk-export/${exportId}/status`;

    // Return 202 Accepted with polling URL
    reply.code(202).header('Content-Location', statusUrl);

    return {
      message: 'Bulk export initiated',
      exportId,
      statusUrl,
      estimatedCompletion: new Date(Date.now() + 300000).toISOString() // 5 minutes
    };
  }

  // Private helper methods

  private async validatePatientAccess(request: any, patientId: string): Promise<void> {
    // In a real implementation, this would validate:
    // 1. OAuth token scope includes patient/*.read
    // 2. Patient ID in token matches requested patient
    // 3. Patient has active coverage/membership

    logger.debug('Validating patient access', { patientId });

    // For POC, perform basic validation
    if (!patientId || !patientId.startsWith('patient-')) {
      throw new Error('Invalid patient ID format');
    }
  }

  private async buildPatientEverythingBundle(patientId: string, since?: string): Promise<Bundle> {
    const entries: any[] = [];

    // Add patient resource
    entries.push({
      resource: this.generateSamplePatient(patientId),
      search: { mode: 'match' }
    });

    // Add coverage
    const coverage = this.generateSampleCoverage(patientId);
    coverage.forEach(cov => entries.push({
      resource: cov,
      search: { mode: 'include' }
    }));

    // Add claims
    const claims = this.generateSampleClaims(patientId);
    claims.forEach(claim => entries.push({
      resource: claim,
      search: { mode: 'include' }
    }));

    // Add claim responses
    const claimResponses = this.generateSampleClaimResponses(patientId);
    claimResponses.forEach(cr => entries.push({
      resource: cr,
      search: { mode: 'include' }
    }));

    return {
      resourceType: 'Bundle',
      id: `patient-everything-${patientId}`,
      type: 'searchset',
      timestamp: new Date().toISOString(),
      total: entries.length,
      entry: entries
    };
  }

  private generateSamplePatient(patientId: string): Patient {
    return {
      resourceType: 'Patient',
      id: patientId,
      meta: {
        profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient']
      },
      identifier: [
        {
          use: 'usual',
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'MB',
              display: 'Member Number'
            }]
          },
          system: 'http://fhir-iq.com/member-id',
          value: patientId.replace('patient-', 'MBR')
        }
      ],
      name: [
        {
          use: 'official',
          family: 'Patient',
          given: ['Demo']
        }
      ],
      gender: 'unknown',
      birthDate: '1990-01-01'
    };
  }

  private generateSampleCoverage(patientId: string, status?: string): Coverage[] {
    return [
      {
        resourceType: 'Coverage',
        id: `coverage-${patientId}`,
        meta: {
          profile: ['http://hl7.org/fhir/us/davinci-pdex/StructureDefinition/pdex-coverage']
        },
        identifier: [
          {
            system: 'http://fhir-iq.com/coverage-id',
            value: `COV-${patientId}`
          }
        ],
        status: status as any || 'active',
        subscriber: {
          reference: `Patient/${patientId}`
        },
        beneficiary: {
          reference: `Patient/${patientId}`
        },
        payor: [
          {
            reference: 'Organization/fhir-iq-payer'
          }
        ],
        period: {
          start: '2024-01-01',
          end: '2024-12-31'
        }
      }
    ];
  }

  private generateSampleClaims(patientId: string, status?: string, date?: string): Claim[] {
    return [
      {
        resourceType: 'Claim',
        id: `claim-pa-${patientId}`,
        meta: {
          profile: ['http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claim']
        },
        identifier: [
          {
            system: 'http://fhir-iq.com/claim-id',
            value: `PA-${patientId}-001`
          }
        ],
        status: status as any || 'active',
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/claim-type',
            code: 'professional',
            display: 'Professional'
          }]
        },
        use: 'preauthorization',
        patient: {
          reference: `Patient/${patientId}`
        },
        created: date || '2024-01-15T10:00:00Z',
        provider: {
          reference: 'Practitioner/practitioner-1'
        },
        item: [
          {
            sequence: 1,
            productOrService: {
              coding: [{
                system: 'http://www.ama-assn.org/go/cpt',
                code: '72148',
                display: 'MRI Lumbar Spine'
              }]
            },
            quantity: { value: 1 }
          }
        ]
      }
    ];
  }

  private generateSampleClaimResponses(patientId: string, status?: string): ClaimResponse[] {
    return [
      {
        resourceType: 'ClaimResponse',
        id: `claimresponse-${patientId}`,
        meta: {
          profile: ['http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claimresponse']
        },
        identifier: [
          {
            system: 'http://fhir-iq.com/claimresponse-id',
            value: `CR-${patientId}-001`
          }
        ],
        status: status as any || 'active',
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/claim-type',
            code: 'professional',
            display: 'Professional'
          }]
        },
        use: 'preauthorization',
        patient: {
          reference: `Patient/${patientId}`
        },
        created: '2024-01-15T14:30:00Z',
        insurer: {
          reference: 'Organization/fhir-iq-payer'
        },
        outcome: 'complete',
        disposition: 'Prior authorization approved',
        preAuthRef: 'AUTH123456789'
      }
    ];
  }

  private generateSampleExplanationOfBenefits(patientId: string): ExplanationOfBenefit[] {
    return [
      {
        resourceType: 'ExplanationOfBenefit',
        id: `eob-${patientId}`,
        meta: {
          profile: ['http://hl7.org/fhir/us/davinci-pdex/StructureDefinition/pdex-explanationofbenefit']
        },
        identifier: [
          {
            system: 'http://fhir-iq.com/eob-id',
            value: `EOB-${patientId}-001`
          }
        ],
        status: 'active',
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/claim-type',
            code: 'professional',
            display: 'Professional'
          }]
        },
        use: 'claim',
        patient: {
          reference: `Patient/${patientId}`
        },
        created: '2024-01-20T09:00:00Z',
        insurer: {
          reference: 'Organization/fhir-iq-payer'
        },
        provider: {
          reference: 'Practitioner/practitioner-1'
        },
        outcome: 'complete'
      }
    ];
  }
}