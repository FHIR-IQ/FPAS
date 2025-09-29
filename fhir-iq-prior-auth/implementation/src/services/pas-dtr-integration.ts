import { logger } from '../utils/logger';
import { dtrLauncherHandler } from '../handlers/dtr-launcher-handler';
import { dtrPrepopulationService } from './dtr-prepopulation-service';

interface PASBundle {
  resourceType: 'Bundle';
  type: 'collection' | 'document';
  entry: Array<{
    fullUrl?: string;
    resource: any;
  }>;
}

interface UserContext {
  user?: {
    sub: string;
    scopes: string[];
    patient?: string;
    organization?: string;
  };
  correlationId: string;
  clientIp: string;
}

/**
 * PAS-DTR Integration Service
 * Handles automatic generation of QuestionnaireResponse for PAS Bundles
 * when DTR documentation is missing
 */
export class PASDTRIntegrationService {

  /**
   * Check if PAS Bundle contains QuestionnaireResponse and auto-generate if missing
   */
  async ensureQuestionnaireResponseInBundle(
    bundle: PASBundle,
    context: UserContext
  ): Promise<PASBundle> {
    try {
      logger.info('Checking PAS Bundle for DTR documentation', {
        bundleType: bundle.type,
        entryCount: bundle.entry.length,
        correlationId: context.correlationId
      });

      // Check if Bundle already contains QuestionnaireResponse
      const hasQuestionnaireResponse = bundle.entry.some(entry =>
        entry.resource.resourceType === 'QuestionnaireResponse'
      );

      if (hasQuestionnaireResponse) {
        logger.debug('Bundle already contains QuestionnaireResponse - no DTR generation needed', {
          correlationId: context.correlationId
        });
        return bundle;
      }

      // Extract Claim to determine service type
      const claim = this.extractClaimFromBundle(bundle);
      if (!claim) {
        logger.warn('No Claim found in Bundle - cannot auto-generate DTR', {
          correlationId: context.correlationId
        });
        return bundle;
      }

      // Determine service type from claim
      const serviceType = this.determineServiceTypeFromClaim(claim);
      if (!serviceType) {
        logger.warn('Cannot determine service type from Claim - skipping DTR generation', {
          claimId: claim.id,
          correlationId: context.correlationId
        });
        return bundle;
      }

      // Extract patient ID
      const patientId = this.extractPatientIdFromBundle(bundle);
      if (!patientId) {
        logger.warn('No Patient found in Bundle - cannot auto-generate DTR', {
          correlationId: context.correlationId
        });
        return bundle;
      }

      // Auto-generate QuestionnaireResponse
      logger.info('Auto-generating DTR QuestionnaireResponse', {
        serviceType,
        patientId,
        claimId: claim.id,
        correlationId: context.correlationId
      });

      const questionnaireResponse = await this.generateQuestionnaireResponse(
        serviceType,
        patientId,
        bundle,
        context
      );

      // Add QuestionnaireResponse to Bundle
      const enhancedBundle = this.addQuestionnaireResponseToBundle(bundle, questionnaireResponse);

      logger.info('DTR QuestionnaireResponse auto-generated and added to Bundle', {
        questionnaireResponseId: questionnaireResponse.id,
        serviceType,
        correlationId: context.correlationId
      });

      return enhancedBundle;

    } catch (error) {
      logger.error('Failed to ensure QuestionnaireResponse in Bundle', {
        error: error.message,
        correlationId: context.correlationId,
        stack: error.stack
      });

      // Return original bundle on error - don't fail the entire PAS submission
      logger.warn('Proceeding with PAS submission without DTR auto-generation', {
        correlationId: context.correlationId
      });
      return bundle;
    }
  }

  /**
   * Extract Claim resource from Bundle
   */
  private extractClaimFromBundle(bundle: PASBundle): any | null {
    const claimEntry = bundle.entry.find(entry =>
      entry.resource.resourceType === 'Claim'
    );
    return claimEntry?.resource || null;
  }

  /**
   * Extract Patient ID from Bundle
   */
  private extractPatientIdFromBundle(bundle: PASBundle): string | null {
    const patientEntry = bundle.entry.find(entry =>
      entry.resource.resourceType === 'Patient'
    );

    if (patientEntry?.resource.id) {
      return patientEntry.resource.id;
    }

    // Try to extract from Claim patient reference
    const claim = this.extractClaimFromBundle(bundle);
    if (claim?.patient?.reference) {
      const match = claim.patient.reference.match(/Patient\/(.+)/);
      return match ? match[1] : null;
    }

    return null;
  }

  /**
   * Determine service type from Claim resource
   */
  private determineServiceTypeFromClaim(claim: any): string | null {
    if (!claim.item || claim.item.length === 0) {
      return null;
    }

    // Check first item's service code
    const firstItem = claim.item[0];
    const serviceCode = firstItem.productOrService?.coding?.[0]?.code;

    // Map CPT codes to service types
    const serviceMapping: Record<string, string> = {
      '72148': 'lumbar-mri',         // MRI lumbar spine without contrast
      '72149': 'lumbar-mri',         // MRI lumbar spine with contrast
      '72158': 'lumbar-mri',         // MRI lumbar spine without and with contrast
      '93451': 'cardiac-catheterization', // Cardiac catheterization
      '29881': 'knee-arthroscopy',   // Arthroscopy knee
      '70450': 'ct-head',            // CT head without contrast
      '70460': 'ct-head'             // CT head with contrast
    };

    const serviceType = serviceMapping[serviceCode];
    if (serviceType) {
      logger.debug('Determined service type from CPT code', {
        cptCode: serviceCode,
        serviceType
      });
      return serviceType;
    }

    // Default to lumbar-mri for POC if we can't determine
    logger.debug('Could not determine service type, defaulting to lumbar-mri', {
      serviceCode
    });
    return 'lumbar-mri';
  }

  /**
   * Generate QuestionnaireResponse using DTR prepopulation
   */
  private async generateQuestionnaireResponse(
    serviceType: string,
    patientId: string,
    bundle: PASBundle,
    context: UserContext
  ): Promise<any> {
    try {
      // Build DTR context
      const dtrContext = {
        patient: patientId,
        practitioner: this.extractPractitionerFromBundle(bundle),
        organization: this.extractOrganizationFromBundle(bundle)
      };

      // Use DTR launcher to get questionnaire and prepopulate
      const result = await dtrLauncherHandler.launchAndPrepopulate(
        serviceType,
        dtrContext,
        {
          user: context.user,
          correlationId: context.correlationId
        }
      );

      // Update QuestionnaireResponse status to completed for PAS submission
      result.questionnaireResponse.status = 'completed';
      result.questionnaireResponse.authored = new Date().toISOString();

      // Add extension to indicate auto-generation
      if (!result.questionnaireResponse.extension) {
        result.questionnaireResponse.extension = [];
      }

      result.questionnaireResponse.extension.push({
        url: 'http://fhir-iq.com/StructureDefinition/extension-auto-generated',
        valueBoolean: true
      });

      result.questionnaireResponse.extension.push({
        url: 'http://fhir-iq.com/StructureDefinition/extension-generation-source',
        valueString: 'PAS-DTR-Integration'
      });

      logger.info('QuestionnaireResponse auto-generated successfully', {
        questionnaireResponseId: result.questionnaireResponse.id,
        itemsPopulated: result.prepopulationSummary.itemsPopulated,
        serviceType,
        correlationId: context.correlationId
      });

      return result.questionnaireResponse;

    } catch (error) {
      logger.error('Failed to generate QuestionnaireResponse', {
        error: error.message,
        serviceType,
        patientId,
        correlationId: context.correlationId
      });
      throw error;
    }
  }

  /**
   * Extract Practitioner ID from Bundle
   */
  private extractPractitionerFromBundle(bundle: PASBundle): string | undefined {
    const practitionerEntry = bundle.entry.find(entry =>
      entry.resource.resourceType === 'Practitioner'
    );

    if (practitionerEntry?.resource.id) {
      return practitionerEntry.resource.id;
    }

    // Try to extract from Claim provider reference
    const claim = this.extractClaimFromBundle(bundle);
    if (claim?.provider?.reference) {
      const match = claim.provider.reference.match(/Practitioner\/(.+)/);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Extract Organization ID from Bundle
   */
  private extractOrganizationFromBundle(bundle: PASBundle): string | undefined {
    // Look for Organization that's not a payer
    const organizationEntry = bundle.entry.find(entry =>
      entry.resource.resourceType === 'Organization' &&
      !this.isPayerOrganization(entry.resource)
    );

    if (organizationEntry?.resource.id) {
      return organizationEntry.resource.id;
    }

    // Try to extract from Claim provider reference
    const claim = this.extractClaimFromBundle(bundle);
    if (claim?.provider?.reference) {
      const match = claim.provider.reference.match(/Organization\/(.+)/);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Check if Organization is a payer (insurer)
   */
  private isPayerOrganization(organization: any): boolean {
    // Simple heuristic - check if organization is referenced by Coverage.payor
    // In a more sophisticated implementation, would check organization type
    return organization.type?.some((type: any) =>
      type.coding?.some((coding: any) =>
        coding.code === 'pay' || coding.display?.toLowerCase().includes('payer')
      )
    ) || false;
  }

  /**
   * Add QuestionnaireResponse to PAS Bundle
   */
  private addQuestionnaireResponseToBundle(
    bundle: PASBundle,
    questionnaireResponse: any
  ): PASBundle {
    const enhancedBundle = { ...bundle };

    // Add QuestionnaireResponse as new entry
    enhancedBundle.entry = [
      ...bundle.entry,
      {
        fullUrl: `QuestionnaireResponse/${questionnaireResponse.id}`,
        resource: questionnaireResponse
      }
    ];

    // Update Claim supportingInfo to reference the QuestionnaireResponse
    const claimEntry = enhancedBundle.entry.find(entry =>
      entry.resource.resourceType === 'Claim'
    );

    if (claimEntry) {
      const claim = claimEntry.resource;

      if (!claim.supportingInfo) {
        claim.supportingInfo = [];
      }

      // Add supporting info entry for QuestionnaireResponse
      claim.supportingInfo.push({
        sequence: claim.supportingInfo.length + 1,
        category: {
          coding: [{
            system: 'http://hl7.org/fhir/us/davinci-pas/CodeSystem/PASSupportingInfoType',
            code: 'questionnaire-response',
            display: 'Questionnaire Response'
          }]
        },
        valueReference: {
          reference: `QuestionnaireResponse/${questionnaireResponse.id}`
        }
      });

      logger.debug('Added QuestionnaireResponse reference to Claim supportingInfo', {
        claimId: claim.id,
        questionnaireResponseId: questionnaireResponse.id
      });
    }

    return enhancedBundle;
  }
}

// Export singleton instance
export const pasDTRIntegrationService = new PASDTRIntegrationService();