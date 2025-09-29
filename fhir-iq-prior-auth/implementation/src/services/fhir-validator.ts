import { logger } from '../utils/logger';

/**
 * FHIR Validator service for validating resources against profiles
 */
export class FHIRValidator {
  async validateAgainstProfile(resource: any, profileUrl: string): Promise<void> {
    logger.debug('Validating resource against profile', {
      resourceType: resource.resourceType,
      profileUrl
    });

    // Mock validation for POC - in real implementation would use HAPI FHIR validator
    if (!resource.resourceType) {
      throw new Error('Resource must have resourceType');
    }
  }

  async validateResource(resource: any): Promise<void> {
    logger.debug('Validating resource', {
      resourceType: resource.resourceType
    });

    // Mock validation for POC
    if (!resource.resourceType) {
      throw new Error('Resource must have resourceType');
    }
  }
}

export const fhirValidator = new FHIRValidator();
