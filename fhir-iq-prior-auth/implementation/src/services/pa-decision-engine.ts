import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface PADecisionInput {
  claim: any;
  questionnaireResponse?: any;
  patient: any;
  coverage: any;
  provider?: any;
  correlationId: string;
}

export interface PADecision {
  disposition: 'approved' | 'denied' | 'pended';
  authorizationNumber?: string;
  validityPeriod?: {
    start: string;
    end: string;
  };
  approvedAmount?: number;
  denyReason?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text?: string;
  };
  pendingReason?: string;
  additionalInfo?: string;
  clinicalReview?: boolean;
  reviewNotes?: string;
}

export interface PADecisionContext {
  ruleEngine: string;
  rulesApplied: string[];
  processingTime: number;
  confidence: number;
}

/**
 * Prior Authorization Decision Engine
 * Implements clinical decision rules for PA approval/denial/pending
 */
export class PADecisionEngine {

  /**
   * Process a prior authorization request and make a decision
   */
  async makeDecision(input: PADecisionInput): Promise<{ decision: PADecision; context: PADecisionContext }> {
    const startTime = Date.now();
    const rulesApplied: string[] = [];

    try {
      logger.info('Starting PA decision processing', {
        claimId: input.claim.id,
        patientId: input.patient.id,
        correlationId: input.correlationId
      });

      // Step 1: Validate input data
      this.validateDecisionInput(input);
      rulesApplied.push('input-validation');

      // Step 2: Extract clinical information from questionnaire response
      const clinicalInfo = this.extractClinicalInfo(input.questionnaireResponse);
      rulesApplied.push('clinical-info-extraction');

      // Step 3: Apply eligibility rules
      const eligibilityResult = this.checkEligibility(input.claim, input.coverage, input.patient);
      if (!eligibilityResult.eligible) {
        const decision: PADecision = {
          disposition: 'denied',
          denyReason: eligibilityResult.reason
        };

        return {
          decision,
          context: this.buildDecisionContext('eligibility-engine', rulesApplied, startTime, 0.95)
        };
      }
      rulesApplied.push('eligibility-check');

      // Step 4: Apply clinical decision rules based on Stage C requirements
      const clinicalDecision = this.applyClinicalRules(clinicalInfo, input.claim);
      rulesApplied.push(`clinical-rules-${clinicalDecision.disposition}`);

      // Step 5: Generate authorization details if approved
      if (clinicalDecision.disposition === 'approved') {
        clinicalDecision.authorizationNumber = this.generateAuthorizationNumber();
        clinicalDecision.validityPeriod = this.calculateValidityPeriod(input.claim);
        clinicalDecision.approvedAmount = this.calculateApprovedAmount(input.claim);
      }

      const processingTime = Date.now() - startTime;

      logger.info('PA decision completed', {
        claimId: input.claim.id,
        disposition: clinicalDecision.disposition,
        authorizationNumber: clinicalDecision.authorizationNumber,
        processingTime,
        correlationId: input.correlationId
      });

      return {
        decision: clinicalDecision,
        context: this.buildDecisionContext('clinical-rules-engine', rulesApplied, startTime, 0.9)
      };

    } catch (error) {
      logger.error('PA decision processing failed', {
        error: error.message,
        claimId: input.claim.id,
        correlationId: input.correlationId,
        stack: error.stack
      });

      const decision: PADecision = {
        disposition: 'pended',
        pendingReason: 'System error during decision processing',
        additionalInfo: 'Manual review required due to processing error',
        clinicalReview: true
      };

      return {
        decision,
        context: this.buildDecisionContext('error-handler', rulesApplied, startTime, 0.0)
      };
    }
  }

  /**
   * Validate decision input data
   */
  private validateDecisionInput(input: PADecisionInput): void {
    if (!input.claim || !input.claim.id) {
      throw new Error('Valid Claim resource is required');
    }

    if (!input.patient || !input.patient.id) {
      throw new Error('Valid Patient resource is required');
    }

    if (!input.coverage || !input.coverage.id) {
      throw new Error('Valid Coverage resource is required');
    }

    // Validate claim has required items
    if (!input.claim.item || input.claim.item.length === 0) {
      throw new Error('Claim must contain at least one item');
    }
  }

  /**
   * Extract clinical information from DTR QuestionnaireResponse
   */
  private extractClinicalInfo(questionnaireResponse?: any): any {
    if (!questionnaireResponse || !questionnaireResponse.item) {
      logger.debug('No questionnaire response provided, using default clinical info');
      return {
        failedConservativeTx: false,
        neuroDeficit: false,
        symptomDuration: 0,
        hasDocumentation: false
      };
    }

    const clinicalInfo = {
      failedConservativeTx: false,
      neuroDeficit: false,
      symptomDuration: 0,
      conservativeTherapyDetails: '',
      neuroDeficitDetails: '',
      hasDocumentation: true
    };

    // Extract answers from questionnaire response items
    for (const item of questionnaireResponse.item) {
      switch (item.linkId) {
        case 'conservative-therapy':
          // Check if conservative therapy was tried
          clinicalInfo.failedConservativeTx = item.answer?.[0]?.valueBoolean === true;
          break;

        case 'conservative-therapy-details':
          clinicalInfo.conservativeTherapyDetails = item.answer?.[0]?.valueString || '';
          break;

        case 'neurologic-deficit':
          // Check if neurologic deficits are present
          clinicalInfo.neuroDeficit = item.answer?.[0]?.valueBoolean === true;
          break;

        case 'neurologic-deficit-details':
          clinicalInfo.neuroDeficitDetails = item.answer?.[0]?.valueString || '';
          break;

        case 'symptom-duration':
          const duration = item.answer?.[0]?.valueQuantity;
          if (duration && duration.unit === 'weeks') {
            clinicalInfo.symptomDuration = duration.value || 0;
          }
          break;
      }
    }

    logger.debug('Extracted clinical information', {
      failedConservativeTx: clinicalInfo.failedConservativeTx,
      neuroDeficit: clinicalInfo.neuroDeficit,
      symptomDuration: clinicalInfo.symptomDuration
    });

    return clinicalInfo;
  }

  /**
   * Check member eligibility for the requested service
   */
  private checkEligibility(claim: any, coverage: any, patient: any): { eligible: boolean; reason?: any } {
    // Check coverage is active
    if (coverage.status !== 'active') {
      return {
        eligible: false,
        reason: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/claimrejectionreason',
            code: 'coverage-inactive',
            display: 'Coverage is not active'
          }],
          text: 'Member coverage is not currently active'
        }
      };
    }

    // Check coverage period
    const today = new Date().toISOString().split('T')[0];
    if (coverage.period) {
      if (coverage.period.start && coverage.period.start > today) {
        return {
          eligible: false,
          reason: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/claimrejectionreason',
              code: 'coverage-not-yet-effective',
              display: 'Coverage not yet effective'
            }]
          }
        };
      }

      if (coverage.period.end && coverage.period.end < today) {
        return {
          eligible: false,
          reason: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/claimrejectionreason',
              code: 'coverage-expired',
              display: 'Coverage has expired'
            }]
          }
        };
      }
    }

    // Additional eligibility checks would go here in a real implementation
    // (e.g., benefit verification, network status, etc.)

    return { eligible: true };
  }

  /**
   * Apply clinical decision rules based on Stage C requirements:
   * If FailedConservativeTx=true AND NeuroDeficit=true -> approve
   * Else -> pend or deny with details
   */
  private applyClinicalRules(clinicalInfo: any, claim: any): PADecision {
    logger.debug('Applying clinical decision rules', {
      failedConservativeTx: clinicalInfo.failedConservativeTx,
      neuroDeficit: clinicalInfo.neuroDeficit,
      claimId: claim.id
    });

    // Stage C Rule: Both conservative therapy failure AND neurologic deficit required for approval
    if (clinicalInfo.failedConservativeTx && clinicalInfo.neuroDeficit) {
      return {
        disposition: 'approved',
        reviewNotes: 'Approved based on failed conservative therapy and presence of neurologic deficits'
      };
    }

    // Conservative therapy tried but no neurologic deficits - pend for additional review
    if (clinicalInfo.failedConservativeTx && !clinicalInfo.neuroDeficit) {
      return {
        disposition: 'pended',
        pendingReason: 'Additional clinical documentation required',
        additionalInfo: 'Conservative therapy documented but neurologic deficits not clearly established. Please provide additional clinical documentation including neurological examination findings.',
        clinicalReview: true,
        reviewNotes: 'Conservative therapy documented but neurologic deficits unclear'
      };
    }

    // No conservative therapy documented - deny
    if (!clinicalInfo.failedConservativeTx) {
      return {
        disposition: 'denied',
        denyReason: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/claimrejectionreason',
            code: 'conservative-therapy-required',
            display: 'Conservative therapy must be attempted before authorization'
          }],
          text: 'Member must complete at least 6 weeks of conservative therapy before advanced imaging can be authorized'
        },
        reviewNotes: 'Conservative therapy not documented or insufficient duration'
      };
    }

    // Neurologic deficits present but no conservative therapy - also deny
    if (clinicalInfo.neuroDeficit && !clinicalInfo.failedConservativeTx) {
      return {
        disposition: 'denied',
        denyReason: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/claimrejectionreason',
            code: 'conservative-therapy-required',
            display: 'Conservative therapy must be attempted before authorization'
          }],
          text: 'Conservative therapy is required even when neurologic deficits are present, unless contraindicated'
        },
        reviewNotes: 'Neurologic deficits present but conservative therapy not attempted'
      };
    }

    // Default case - pend for manual review
    return {
      disposition: 'pended',
      pendingReason: 'Clinical information incomplete',
      additionalInfo: 'Insufficient clinical documentation to make automated determination. Manual clinical review required.',
      clinicalReview: true,
      reviewNotes: 'Insufficient clinical documentation for automated decision'
    };
  }

  /**
   * Generate authorization number
   */
  private generateAuthorizationNumber(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `PA-${timestamp}-${random}`;
  }

  /**
   * Calculate validity period for authorization
   */
  private calculateValidityPeriod(claim: any): { start: string; end: string } {
    const now = new Date();
    const start = now.toISOString().split('T')[0];

    // Default to 90 days from today for imaging authorizations
    const endDate = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
    const end = endDate.toISOString().split('T')[0];

    return { start, end };
  }

  /**
   * Calculate approved amount based on claim items
   */
  private calculateApprovedAmount(claim: any): number {
    if (!claim.item || claim.item.length === 0) {
      return 0;
    }

    // Sum up all item amounts - in real implementation would apply benefit rules
    return claim.item.reduce((total: number, item: any) => {
      const amount = item.net?.value || item.unitPrice?.value || 0;
      return total + amount;
    }, 0);
  }

  /**
   * Build decision context metadata
   */
  private buildDecisionContext(
    ruleEngine: string,
    rulesApplied: string[],
    startTime: number,
    confidence: number
  ): PADecisionContext {
    return {
      ruleEngine,
      rulesApplied,
      processingTime: Date.now() - startTime,
      confidence
    };
  }
}

// Export singleton instance
export const paDecisionEngine = new PADecisionEngine();