import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { PADecision, PADecisionContext } from './pa-decision-engine';

export interface ClaimResponseInput {
  claim: any;
  decision: PADecision;
  decisionContext: PADecisionContext;
  patient: any;
  coverage: any;
  correlationId: string;
}

export interface OperationOutcomeIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code: string;
  details?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text?: string;
  };
  diagnostics?: string;
  location?: string[];
  expression?: string[];
}

/**
 * ClaimResponse Generator for Prior Authorization responses
 * Creates FHIR-compliant ClaimResponse resources with proper adjudication
 */
export class ClaimResponseGenerator {

  /**
   * Generate a complete ClaimResponse based on PA decision
   */
  generateClaimResponse(input: ClaimResponseInput): any {
    const now = new Date().toISOString();

    try {
      logger.debug('Generating ClaimResponse', {
        claimId: input.claim.id,
        disposition: input.decision.disposition,
        correlationId: input.correlationId
      });

      const claimResponse = {
        resourceType: 'ClaimResponse',
        id: uuidv4(),
        meta: {
          profile: ['http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claimresponse'],
          lastUpdated: now
        },
        identifier: this.generateIdentifiers(input.decision),
        status: 'active',
        type: input.claim.type,
        use: 'preauthorization',
        patient: input.claim.patient,
        created: now,
        insurer: this.getInsurerReference(input.coverage),
        requestor: input.claim.provider,
        request: {
          reference: `Claim/${input.claim.id}`
        },
        outcome: this.mapDispositionToOutcome(input.decision.disposition),
        disposition: this.getDispositionText(input.decision),
        preAuthRef: input.decision.authorizationNumber,
        preAuthPeriod: input.decision.validityPeriod,
        item: this.generateItemAdjudications(input.claim, input.decision),
        total: this.generateTotalAdjudication(input.claim, input.decision),
        error: this.generateErrors(input.decision),
        extension: this.generateExtensions(input.decision, input.decisionContext)
      };

      // Remove undefined/null fields
      return this.cleanupResource(claimResponse);

    } catch (error) {
      logger.error('Failed to generate ClaimResponse', {
        error: error.message,
        claimId: input.claim.id,
        correlationId: input.correlationId
      });
      throw error;
    }
  }

  /**
   * Generate OperationOutcome for detailed error/warning information
   */
  generateOperationOutcome(
    issues: OperationOutcomeIssue[],
    correlationId: string
  ): any {
    return {
      resourceType: 'OperationOutcome',
      id: uuidv4(),
      meta: {
        lastUpdated: new Date().toISOString()
      },
      issue: issues.map(issue => ({
        severity: issue.severity,
        code: issue.code,
        details: issue.details,
        diagnostics: issue.diagnostics,
        location: issue.location,
        expression: issue.expression
      }))
    };
  }

  /**
   * Generate identifiers for ClaimResponse
   */
  private generateIdentifiers(decision: PADecision): any[] {
    const identifiers = [];

    // Add authorization number as identifier if approved
    if (decision.authorizationNumber) {
      identifiers.push({
        use: 'official',
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'ACSN',
            display: 'Accession ID'
          }]
        },
        system: 'http://fhir-iq.com/prior-authorization-number',
        value: decision.authorizationNumber
      });
    }

    // Add internal tracking identifier
    identifiers.push({
      use: 'secondary',
      system: 'http://fhir-iq.com/claim-response-id',
      value: `CR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    });

    return identifiers;
  }

  /**
   * Get insurer reference from coverage
   */
  private getInsurerReference(coverage: any): any {
    if (coverage.payor && coverage.payor.length > 0) {
      return coverage.payor[0];
    }

    return {
      reference: 'Organization/default-payer',
      display: 'Default Payer Organization'
    };
  }

  /**
   * Map PA decision disposition to FHIR outcome
   */
  private mapDispositionToOutcome(disposition: string): string {
    switch (disposition) {
      case 'approved':
        return 'complete';
      case 'denied':
        return 'error';
      case 'pended':
        return 'partial';
      default:
        return 'error';
    }
  }

  /**
   * Get human-readable disposition text
   */
  private getDispositionText(decision: PADecision): string {
    switch (decision.disposition) {
      case 'approved':
        return `Prior authorization approved${decision.authorizationNumber ? ` - Authorization #${decision.authorizationNumber}` : ''}`;
      case 'denied':
        return 'Prior authorization denied - see details for reason';
      case 'pended':
        return 'Prior authorization pending - additional information required';
      default:
        return 'Prior authorization status unknown';
    }
  }

  /**
   * Generate item-level adjudications
   */
  private generateItemAdjudications(claim: any, decision: PADecision): any[] {
    if (!claim.item || claim.item.length === 0) {
      return [];
    }

    return claim.item.map((claimItem: any, index: number) => {
      const itemAdjudication = {
        itemSequence: index + 1,
        adjudication: this.generateAdjudicationForItem(claimItem, decision),
        noteNumber: this.generateItemNotes(decision, index + 1)
      };

      // Add extensions for approved items
      if (decision.disposition === 'approved') {
        itemAdjudication['extension'] = this.generateItemExtensions(decision);
      }

      return this.cleanupResource(itemAdjudication);
    });
  }

  /**
   * Generate adjudication details for individual item
   */
  private generateAdjudicationForItem(claimItem: any, decision: PADecision): any[] {
    const adjudications = [];

    // Eligibility adjudication
    adjudications.push({
      category: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/adjudication',
          code: 'eligible',
          display: 'Eligible Amount'
        }]
      },
      amount: claimItem.net || claimItem.unitPrice || { value: 0, currency: 'USD' }
    });

    // Decision-specific adjudication
    const decisionCode = this.getDecisionAdjudicationCode(decision.disposition);
    adjudications.push({
      category: {
        coding: [{
          system: 'http://hl7.org/fhir/us/davinci-pas/CodeSystem/PASDJAdjudicationValueCodes',
          code: decisionCode.code,
          display: decisionCode.display
        }]
      },
      reason: decision.disposition === 'denied' ? decision.denyReason : undefined
    });

    // Approved amount for approved items
    if (decision.disposition === 'approved' && decision.approvedAmount) {
      adjudications.push({
        category: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/adjudication',
            code: 'benefit',
            display: 'Benefit Amount'
          }]
        },
        amount: {
          value: decision.approvedAmount,
          currency: 'USD'
        }
      });
    }

    return adjudications;
  }

  /**
   * Get adjudication code for decision disposition
   */
  private getDecisionAdjudicationCode(disposition: string): { code: string; display: string } {
    switch (disposition) {
      case 'approved':
        return { code: 'approved', display: 'Approved' };
      case 'denied':
        return { code: 'denied', display: 'Denied' };
      case 'pended':
        return { code: 'pending', display: 'Pending' };
      default:
        return { code: 'other', display: 'Other' };
    }
  }

  /**
   * Generate item-specific notes
   */
  private generateItemNotes(decision: PADecision, itemSequence: number): number[] | undefined {
    if (decision.reviewNotes || decision.additionalInfo || decision.pendingReason) {
      return [1]; // Reference to process note #1
    }
    return undefined;
  }

  /**
   * Generate item-level extensions
   */
  private generateItemExtensions(decision: PADecision): any[] {
    const extensions = [];

    if (decision.authorizationNumber) {
      extensions.push({
        url: 'http://hl7.org/fhir/us/davinci-pas/StructureDefinition/extension-authorizationNumber',
        valueString: decision.authorizationNumber
      });
    }

    if (decision.validityPeriod) {
      extensions.push({
        url: 'http://hl7.org/fhir/us/davinci-pas/StructureDefinition/extension-itemAuthorizedDate',
        valuePeriod: decision.validityPeriod
      });
    }

    return extensions;
  }

  /**
   * Generate total adjudication amounts
   */
  private generateTotalAdjudication(claim: any, decision: PADecision): any[] {
    const totals = [];

    // Calculate total submitted amount
    const submittedTotal = this.calculateTotalAmount(claim);
    if (submittedTotal > 0) {
      totals.push({
        category: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/adjudication',
            code: 'submitted',
            display: 'Submitted Amount'
          }]
        },
        amount: {
          value: submittedTotal,
          currency: 'USD'
        }
      });
    }

    // Add approved amount if applicable
    if (decision.disposition === 'approved' && decision.approvedAmount) {
      totals.push({
        category: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/adjudication',
            code: 'benefit',
            display: 'Benefit Amount'
          }]
        },
        amount: {
          value: decision.approvedAmount,
          currency: 'USD'
        }
      });
    }

    return totals;
  }

  /**
   * Calculate total amount from claim items
   */
  private calculateTotalAmount(claim: any): number {
    if (!claim.item || claim.item.length === 0) {
      return 0;
    }

    return claim.item.reduce((total: number, item: any) => {
      const amount = item.net?.value || item.unitPrice?.value || 0;
      return total + amount;
    }, 0);
  }

  /**
   * Generate error details for denied/pended claims
   */
  private generateErrors(decision: PADecision): any[] | undefined {
    if (decision.disposition === 'denied' && decision.denyReason) {
      return [{
        code: {
          coding: decision.denyReason.coding
        },
        expression: ['Claim']
      }];
    }
    return undefined;
  }

  /**
   * Generate ClaimResponse extensions
   */
  private generateExtensions(decision: PADecision, context: PADecisionContext): any[] {
    const extensions = [];

    // Decision processing metadata
    extensions.push({
      url: 'http://fhir-iq.com/StructureDefinition/extension-decision-metadata',
      extension: [
        {
          url: 'ruleEngine',
          valueString: context.ruleEngine
        },
        {
          url: 'processingTime',
          valueInteger: context.processingTime
        },
        {
          url: 'confidence',
          valueDecimal: context.confidence
        },
        {
          url: 'rulesApplied',
          valueString: context.rulesApplied.join(', ')
        }
      ]
    });

    // Clinical review flag
    if (decision.clinicalReview) {
      extensions.push({
        url: 'http://fhir-iq.com/StructureDefinition/extension-clinical-review-required',
        valueBoolean: true
      });
    }

    return extensions;
  }

  /**
   * Remove undefined/null fields from resource
   */
  private cleanupResource(resource: any): any {
    const cleaned = { ...resource };

    Object.keys(cleaned).forEach(key => {
      if (cleaned[key] === undefined || cleaned[key] === null) {
        delete cleaned[key];
      } else if (Array.isArray(cleaned[key]) && cleaned[key].length === 0) {
        delete cleaned[key];
      } else if (typeof cleaned[key] === 'object' && !Array.isArray(cleaned[key])) {
        cleaned[key] = this.cleanupResource(cleaned[key]);
      }
    });

    return cleaned;
  }
}

// Export singleton instance
export const claimResponseGenerator = new ClaimResponseGenerator();