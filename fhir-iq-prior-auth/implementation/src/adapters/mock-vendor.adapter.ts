/**
 * Mock Vendor Adapter
 *
 * Implements the VendorAdapterInterface with simulated decision logic
 * for demonstration and testing purposes. Maintains compatibility with
 * existing POC workflows while showcasing the vendor integration pattern.
 */

import { Bundle, ClaimResponse, Claim, QuestionnaireResponse } from 'fhir/r4';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import {
  VendorAdapterInterface,
  VendorAdapterConfig,
  VendorRequest,
  VendorResponse,
  VendorStatusInquiry,
  VendorStatusResponse,
  VendorHealthCheck,
  VendorFeatures,
  VendorDecision,
  VendorDecisionStatus,
  VendorStatusHistoryEntry,
  VendorAdapterError
} from './vendor-adapter.interface';

export class MockVendorAdapter implements VendorAdapterInterface {
  private config!: VendorAdapterConfig;
  private requestHistory: Map<string, VendorResponse> = new Map();
  private initialized = false;

  /**
   * Initialize the mock vendor adapter
   */
  async initialize(config: VendorAdapterConfig): Promise<void> {
    logger.info('Initializing Mock Vendor Adapter', {
      vendorId: config.vendorId,
      vendorName: config.vendorName
    });

    this.config = config;
    this.initialized = true;

    // Simulate initialization delay
    await this.sleep(100);

    logger.info('Mock Vendor Adapter initialized successfully', {
      vendorId: config.vendorId
    });
  }

  /**
   * Submit prior authorization request
   */
  async submitPriorAuthRequest(request: VendorRequest): Promise<VendorResponse> {
    if (!this.initialized) {
      throw new VendorAdapterError('Adapter not initialized', this.config?.vendorId || 'mock', 'NOT_INITIALIZED');
    }

    logger.info('Processing vendor PA request', {
      requestId: request.requestId,
      vendorId: this.config.vendorId,
      patientId: request.context.patientId
    });

    const startTime = Date.now();

    try {
      // Simulate processing delay
      await this.sleep(this.getRandomDelay(500, 2000));

      // Extract clinical data for decision making
      const clinicalData = this.extractClinicalData(request.bundle);

      // Apply mock decision logic (similar to existing PA decision engine)
      const decision = this.makeDecision(clinicalData);

      // Generate vendor response
      const vendorResponse: VendorResponse = {
        vendorRequestId: `MOCK_${Date.now()}`,
        vendorResponseId: `RESP_${uuidv4()}`,
        responseTime: new Date(),
        status: this.getStatusFromDecision(decision),
        decision,
        processingTime: Date.now() - startTime,
        rawResponse: {
          mockVendor: true,
          clinicalFactors: clinicalData,
          decisionTimestamp: new Date().toISOString()
        }
      };

      // Store for status inquiries
      this.requestHistory.set(vendorResponse.vendorRequestId, vendorResponse);

      logger.info('Vendor PA request processed', {
        requestId: request.requestId,
        vendorRequestId: vendorResponse.vendorRequestId,
        outcome: decision.outcome,
        processingTime: vendorResponse.processingTime
      });

      return vendorResponse;

    } catch (error) {
      logger.error('Vendor PA request failed', {
        error: error.message,
        requestId: request.requestId,
        vendorId: this.config.vendorId
      });
      throw error;
    }
  }

  /**
   * Query request status
   */
  async queryRequestStatus(inquiry: VendorStatusInquiry): Promise<VendorStatusResponse> {
    logger.info('Querying vendor request status', {
      vendorRequestId: inquiry.vendorRequestId,
      vendorId: this.config.vendorId
    });

    const vendorResponse = this.requestHistory.get(inquiry.vendorRequestId);

    if (!vendorResponse) {
      throw new VendorAdapterError(
        `Request not found: ${inquiry.vendorRequestId}`,
        this.config.vendorId,
        'REQUEST_NOT_FOUND'
      );
    }

    // Simulate status inquiry delay
    await this.sleep(200);

    const statusResponse: VendorStatusResponse = {
      vendorRequestId: inquiry.vendorRequestId,
      currentStatus: vendorResponse.status,
      lastUpdated: vendorResponse.responseTime,
      statusHistory: [
        {
          status: { code: 'RECEIVED', display: 'Request Received', category: 'preliminary' },
          timestamp: new Date(vendorResponse.responseTime.getTime() - 60000),
          note: 'Request received and queued for processing'
        },
        {
          status: { code: 'PROCESSING', display: 'Under Review', category: 'preliminary' },
          timestamp: new Date(vendorResponse.responseTime.getTime() - 30000),
          note: 'Clinical review in progress'
        },
        {
          status: vendorResponse.status,
          timestamp: vendorResponse.responseTime,
          note: 'Decision completed'
        }
      ]
    };

    return statusResponse;
  }

  /**
   * Cancel request
   */
  async cancelRequest(vendorRequestId: string): Promise<boolean> {
    logger.info('Cancelling vendor request', {
      vendorRequestId,
      vendorId: this.config.vendorId
    });

    const vendorResponse = this.requestHistory.get(vendorRequestId);

    if (!vendorResponse) {
      return false;
    }

    // Simulate cancellation delay
    await this.sleep(300);

    // Update status to cancelled
    vendorResponse.status = {
      code: 'CANCELLED',
      display: 'Request Cancelled',
      category: 'final'
    };

    vendorResponse.decision.outcome = 'cancelled';

    return true;
  }

  /**
   * Transform FHIR Bundle to vendor format
   */
  async transformFHIRToVendor(bundle: Bundle): Promise<any> {
    logger.debug('Transforming FHIR to vendor format', {
      bundleId: bundle.id,
      vendorId: this.config.vendorId
    });

    // Extract key resources
    const claim = this.extractResource<Claim>(bundle, 'Claim');
    const questionnaireResponse = this.extractResource<QuestionnaireResponse>(bundle, 'QuestionnaireResponse');

    const vendorFormat = {
      requestType: 'PRIOR_AUTHORIZATION',
      timestamp: new Date().toISOString(),
      patient: {
        id: claim?.patient?.reference?.split('/')[1],
        demographics: this.extractPatientDemographics(bundle)
      },
      services: this.extractRequestedServices(claim),
      clinicalData: this.extractClinicalEvidence(questionnaireResponse),
      provider: this.extractProviderInfo(bundle),
      insurance: this.extractInsuranceInfo(bundle),
      metadata: {
        bundleId: bundle.id,
        transformedAt: new Date().toISOString(),
        version: '1.0'
      }
    };

    return vendorFormat;
  }

  /**
   * Transform vendor response to FHIR ClaimResponse
   */
  async transformVendorToFHIR(vendorResponse: VendorResponse): Promise<ClaimResponse> {
    logger.debug('Transforming vendor response to FHIR', {
      vendorRequestId: vendorResponse.vendorRequestId,
      outcome: vendorResponse.decision.outcome
    });

    const claimResponse: ClaimResponse = {
      resourceType: 'ClaimResponse',
      id: uuidv4(),
      meta: {
        profile: ['http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claimresponse']
      },
      identifier: [
        {
          system: 'http://fhir-iq.com/pas-response-id',
          value: vendorResponse.vendorResponseId
        },
        {
          system: 'http://mock-vendor.example.com/request-id',
          value: vendorResponse.vendorRequestId
        }
      ],
      status: this.mapVendorStatusToFHIR(vendorResponse.decision.outcome),
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/claim-type',
            code: 'professional',
            display: 'Professional'
          }
        ]
      },
      use: 'preauthorization',
      patient: {
        reference: 'Patient/patient-example'
      },
      created: vendorResponse.responseTime.toISOString(),
      insurer: {
        reference: 'Organization/mock-payer'
      },
      outcome: this.mapOutcomeToFHIR(vendorResponse.decision.outcome),
      disposition: vendorResponse.decision.reason || this.getDefaultDisposition(vendorResponse.decision.outcome),
      preAuthRef: vendorResponse.decision.authorizationNumber,
      item: vendorResponse.decision.outcome === 'approved' ? [
        {
          itemSequence: 1,
          adjudication: [
            {
              category: {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/adjudication',
                    code: 'eligible',
                    display: 'Eligible'
                  }
                ]
              },
              reason: {
                coding: [
                  {
                    system: 'http://mock-vendor.example.com/reason-codes',
                    code: 'APPROVED',
                    display: 'Prior authorization approved'
                  }
                ]
              }
            }
          ]
        }
      ] : undefined
    };

    return claimResponse;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<VendorHealthCheck> {
    const startTime = Date.now();

    // Simulate health check delay
    await this.sleep(50);

    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      responseTime,
      features: {
        submitPriorAuth: true,
        queryStatus: true,
        cancelRequest: true,
        webhooks: false,
        bulkSubmission: false,
        documentUpload: false
      },
      lastChecked: new Date()
    };
  }

  /**
   * Get capabilities
   */
  getCapabilities(): VendorFeatures {
    return {
      supportsRealTimeDecisions: true,
      supportsAsyncDecisions: true,
      supportsBulkSubmissions: false,
      supportsStatusInquiry: true,
      supportsDocumentUpload: false,
      supportsWebhooks: false,
      maxConcurrentRequests: 10,
      supportedResourceTypes: ['Claim', 'Patient', 'Practitioner', 'Organization', 'QuestionnaireResponse']
    };
  }

  // Private helper methods

  private extractClinicalData(bundle: Bundle): any {
    const questionnaireResponse = this.extractResource<QuestionnaireResponse>(bundle, 'QuestionnaireResponse');

    if (!questionnaireResponse) {
      return {
        failedConservativeTx: false,
        neuroDeficit: false
      };
    }

    const answers = this.extractQuestionnaireAnswers(questionnaireResponse);

    return {
      failedConservativeTx: answers.failedConservativeTx === 'true',
      neuroDeficit: answers.neuroDeficit === 'true',
      clinicalNotes: answers.clinicalNotes,
      treatmentDuration: answers.treatmentDuration
    };
  }

  private extractQuestionnaireAnswers(questionnaireResponse: QuestionnaireResponse): Record<string, string> {
    const answers: Record<string, string> = {};

    questionnaireResponse.item?.forEach(item => {
      if (item.answer && item.answer.length > 0) {
        const answer = item.answer[0];
        if (answer.valueBoolean !== undefined) {
          answers[item.linkId] = answer.valueBoolean.toString();
        } else if (answer.valueString) {
          answers[item.linkId] = answer.valueString;
        }
      }
    });

    return answers;
  }

  private makeDecision(clinicalData: any): VendorDecision {
    // Mock decision logic (same as existing PA decision engine)
    let outcome: 'approved' | 'denied' | 'pended';
    let reason: string;
    let reasonCode: string;

    if (clinicalData.failedConservativeTx && clinicalData.neuroDeficit) {
      outcome = 'approved';
      reason = 'Patient meets approval criteria: failed conservative treatment with neurological deficit';
      reasonCode = 'CRITERIA_MET';
    } else if (clinicalData.failedConservativeTx && !clinicalData.neuroDeficit) {
      outcome = 'pended';
      reason = 'Additional clinical documentation required for neurological assessment';
      reasonCode = 'ADDITIONAL_INFO_NEEDED';
    } else {
      outcome = 'denied';
      reason = 'Conservative treatment must be attempted before prior authorization';
      reasonCode = 'CONSERVATIVE_TX_REQUIRED';
    }

    const decision: VendorDecision = {
      outcome,
      reason,
      reasonCode,
      authorizationNumber: outcome === 'approved' ? `AUTH_${Date.now()}` : undefined,
      validUntil: outcome === 'approved' ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) : undefined,
      conditions: outcome === 'approved' ? [
        'Authorization valid for 90 days',
        'Single procedure only'
      ] : undefined,
      nextSteps: outcome === 'pended' ? [
        'Submit additional neurological examination results',
        'Provide documentation of conservative treatment attempts'
      ] : undefined
    };

    return decision;
  }

  private getStatusFromDecision(decision: VendorDecision): VendorDecisionStatus {
    const statusMap = {
      approved: { code: 'APPROVED', display: 'Prior Authorization Approved', category: 'final' as const },
      denied: { code: 'DENIED', display: 'Prior Authorization Denied', category: 'final' as const },
      pended: { code: 'PENDED', display: 'Prior Authorization Pending', category: 'preliminary' as const },
      cancelled: { code: 'CANCELLED', display: 'Request Cancelled', category: 'final' as const }
    };

    return statusMap[decision.outcome];
  }

  private extractResource<T>(bundle: Bundle, resourceType: string): T | undefined {
    return bundle.entry?.find(
      entry => entry.resource?.resourceType === resourceType
    )?.resource as T;
  }

  private extractPatientDemographics(bundle: Bundle): any {
    // Mock patient demographics extraction
    return {
      age: 45,
      gender: 'female',
      state: 'CA'
    };
  }

  private extractRequestedServices(claim?: Claim): any[] {
    if (!claim?.item) return [];

    return claim.item.map(item => ({
      code: item.productOrService?.coding?.[0]?.code,
      display: item.productOrService?.coding?.[0]?.display,
      quantity: item.quantity?.value || 1
    }));
  }

  private extractClinicalEvidence(questionnaireResponse?: QuestionnaireResponse): any {
    if (!questionnaireResponse) return {};

    return {
      hasEvidence: !!questionnaireResponse.item?.length,
      responseCount: questionnaireResponse.item?.length || 0
    };
  }

  private extractProviderInfo(bundle: Bundle): any {
    return {
      npi: '1234567890',
      name: 'Mock Provider',
      specialty: 'Radiology'
    };
  }

  private extractInsuranceInfo(bundle: Bundle): any {
    return {
      payerId: 'MOCK_PAYER',
      plan: 'Mock Health Plan',
      memberId: 'MEMBER123'
    };
  }

  private mapVendorStatusToFHIR(outcome: string): 'active' | 'cancelled' | 'draft' | 'entered-in-error' {
    const statusMap = {
      approved: 'active',
      denied: 'active',
      pended: 'active',
      cancelled: 'cancelled'
    } as const;

    return statusMap[outcome as keyof typeof statusMap] || 'active';
  }

  private mapOutcomeToFHIR(outcome: string): 'queued' | 'complete' | 'error' | 'partial' {
    const outcomeMap = {
      approved: 'complete',
      denied: 'error',
      pended: 'partial',
      cancelled: 'error'
    } as const;

    return outcomeMap[outcome as keyof typeof outcomeMap] || 'error';
  }

  private getDefaultDisposition(outcome: string): string {
    const dispositionMap = {
      approved: 'Prior authorization approved based on clinical criteria',
      denied: 'Prior authorization denied - criteria not met',
      pended: 'Prior authorization pending - additional information required',
      cancelled: 'Request cancelled by provider'
    };

    return dispositionMap[outcome as keyof typeof dispositionMap] || 'Processing completed';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getRandomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}