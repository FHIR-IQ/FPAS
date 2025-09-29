import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { fhirValidator } from '../services/fhir-validator';
import { queueManager } from '../queues/queue-manager';
import { fhirClient } from '../services/fhir-client';
import { auditLogger } from '../services/audit-logger';
import { pasDTRIntegrationService } from '../services/pas-dtr-integration';

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

interface PASSubmissionResult {
  isAsync: boolean;
  response?: any;
  task?: any;
}

/**
 * Handler for PAS (Prior Authorization Support) request processing
 * Implements Da Vinci PAS IG requirements for authorization submission
 */
export class PASRequestHandler {

  /**
   * Submit a prior authorization request Bundle
   */
  async submitRequest(bundle: PASBundle, context: UserContext): Promise<PASSubmissionResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting PAS request submission', {
        bundleType: bundle.type,
        entryCount: bundle.entry.length,
        correlationId: context.correlationId,
        userId: context.user?.sub
      });

      // Step 1: Validate Bundle structure and profiles
      await this.validatePASBundle(bundle, context);

      // Step 2: Ensure DTR QuestionnaireResponse is present (auto-generate if missing)
      const enhancedBundle = await pasDTRIntegrationService.ensureQuestionnaireResponseInBundle(bundle, context);

      // Step 3: Extract and validate Claim resource
      const claim = this.extractClaimFromBundle(enhancedBundle);
      if (!claim) {
        throw new Error('PAS Bundle must contain a Claim resource');
      }

      // Step 4: Validate provider attribution and patient context
      await this.validateProviderAttribution(claim, context);

      // Step 5: Store Bundle resources in FHIR server
      const storedBundle = await this.storePASBundle(enhancedBundle, context);

      // Step 6: Determine processing mode (sync vs async)
      const processingMode = this.determineProcessingMode(claim, context);

      if (processingMode === 'synchronous') {
        // Process immediately for simple cases
        const response = await this.processSynchronously(claim, storedBundle, context);

        // Log audit event
        await this.logPASSubmissionAudit(claim, 'synchronous', context);

        return {
          isAsync: false,
          response
        };
      } else {
        // Queue for background processing
        const task = await this.queueForAsyncProcessing(claim, storedBundle, context);

        // Log audit event
        await this.logPASSubmissionAudit(claim, 'asynchronous', context);

        return {
          isAsync: true,
          task
        };
      }

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('PAS request submission failed', {
        error: error.message,
        correlationId: context.correlationId,
        duration,
        stack: error.stack
      });

      // Log failed audit event
      await this.logPASSubmissionAudit(null, 'failed', context, error);

      throw error;
    }
  }

  /**
   * Validate PAS Bundle against Da Vinci PAS profiles
   */
  private async validatePASBundle(bundle: PASBundle, context: UserContext): Promise<void> {
    logger.debug('Validating PAS Bundle profiles', {
      correlationId: context.correlationId
    });

    // Validate Bundle structure
    if (!bundle.resourceType || bundle.resourceType !== 'Bundle') {
      throw new Error('Resource must be a Bundle');
    }

    if (!bundle.type || !['collection', 'document'].includes(bundle.type)) {
      throw new Error('Bundle type must be collection or document');
    }

    if (!bundle.entry || !Array.isArray(bundle.entry) || bundle.entry.length === 0) {
      throw new Error('Bundle must contain at least one entry');
    }

    // Validate individual resources against profiles
    for (const entry of bundle.entry) {
      if (!entry.resource) {
        throw new Error('Bundle entry must contain a resource');
      }

      await this.validateResourceProfile(entry.resource, context);
    }

    // Validate required resources are present
    this.validateRequiredResources(bundle);
  }

  /**
   * Validate individual resource against appropriate FHIR profile
   */
  private async validateResourceProfile(resource: any, context: UserContext): Promise<void> {
    const resourceType = resource.resourceType;

    try {
      switch (resourceType) {
        case 'Claim':
          await fhirValidator.validateAgainstProfile(
            resource,
            'http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claim'
          );
          break;
        case 'Patient':
          await fhirValidator.validateAgainstProfile(
            resource,
            'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'
          );
          break;
        case 'Coverage':
          await fhirValidator.validateAgainstProfile(
            resource,
            'http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-coverage'
          );
          break;
        case 'QuestionnaireResponse':
          await fhirValidator.validateAgainstProfile(
            resource,
            'http://hl7.org/fhir/us/davinci-dtr/StructureDefinition/dtr-questionnaireresponse'
          );
          break;
        default:
          // Allow other resource types with base FHIR validation
          await fhirValidator.validateResource(resource);
      }
    } catch (validationError) {
      throw new Error(`${resourceType} validation failed: ${validationError.message}`);
    }
  }

  /**
   * Validate that required resources are present in Bundle
   */
  private validateRequiredResources(bundle: PASBundle): void {
    const resourceTypes = bundle.entry.map(entry => entry.resource.resourceType);

    const requiredTypes = ['Claim', 'Patient', 'Coverage'];
    const missingTypes = requiredTypes.filter(type => !resourceTypes.includes(type));

    if (missingTypes.length > 0) {
      throw new Error(`PAS Bundle missing required resources: ${missingTypes.join(', ')}`);
    }
  }

  /**
   * Extract Claim resource from Bundle
   */
  private extractClaimFromBundle(bundle: PASBundle): any | null {
    const claimEntry = bundle.entry.find(entry => entry.resource.resourceType === 'Claim');
    return claimEntry?.resource || null;
  }

  /**
   * Validate provider attribution and patient context
   */
  private async validateProviderAttribution(claim: any, context: UserContext): Promise<void> {
    logger.debug('Validating provider attribution', {
      claimId: claim.id,
      userOrganization: context.user?.organization,
      correlationId: context.correlationId
    });

    // For user scopes, validate provider can submit for this patient
    if (context.user?.scopes?.includes('user/Claim.write')) {
      const providerRef = claim.provider?.reference;
      if (!providerRef) {
        throw new Error('Claim must include provider reference for user scope');
      }

      // Validate provider organization matches token context
      if (context.user.organization && !providerRef.includes(context.user.organization)) {
        throw new Error('Provider organization does not match token context');
      }
    }

    // For patient scopes, validate patient context
    if (context.user?.scopes?.includes('patient/Claim.write')) {
      const patientRef = claim.patient?.reference;
      if (!patientRef) {
        throw new Error('Claim must include patient reference for patient scope');
      }

      if (context.user.patient && !patientRef.includes(context.user.patient)) {
        throw new Error('Patient reference does not match token context');
      }
    }
  }

  /**
   * Store PAS Bundle resources in FHIR server
   */
  private async storePASBundle(bundle: PASBundle, context: UserContext): Promise<any> {
    logger.debug('Storing PAS Bundle in FHIR server', {
      correlationId: context.correlationId
    });

    try {
      // Generate unique identifiers for resources without IDs
      const bundleWithIds = this.assignResourceIds(bundle);

      // Submit Bundle to FHIR server
      const storedBundle = await fhirClient.createBundle(bundleWithIds);

      logger.info('PAS Bundle stored successfully', {
        bundleId: storedBundle.id,
        correlationId: context.correlationId
      });

      return storedBundle;
    } catch (error) {
      logger.error('Failed to store PAS Bundle', {
        error: error.message,
        correlationId: context.correlationId
      });
      throw new Error(`Failed to store Bundle in FHIR server: ${error.message}`);
    }
  }

  /**
   * Assign unique IDs to resources that don't have them
   */
  private assignResourceIds(bundle: PASBundle): PASBundle {
    const updatedBundle = { ...bundle };
    updatedBundle.entry = bundle.entry.map(entry => {
      if (!entry.resource.id) {
        entry.resource.id = uuidv4();
      }
      if (!entry.fullUrl) {
        entry.fullUrl = `${entry.resource.resourceType}/${entry.resource.id}`;
      }
      return entry;
    });
    return updatedBundle;
  }

  /**
   * Determine if request should be processed synchronously or asynchronously
   */
  private determineProcessingMode(claim: any, context: UserContext): 'synchronous' | 'asynchronous' {
    // Simple heuristics for POC - real implementation would be more sophisticated

    // Check if DTR questionnaire response is present
    const hasQuestionnaireResponse = claim.supportingInfo?.some(
      (info: any) => info.category?.coding?.[0]?.code === 'questionnaire-response'
    );

    // Check claim complexity
    const itemCount = claim.item?.length || 0;
    const diagnosisCount = claim.diagnosis?.length || 0;

    // Process synchronously for simple cases
    if (itemCount <= 1 && diagnosisCount <= 1 && hasQuestionnaireResponse) {
      return 'synchronous';
    }

    // Default to asynchronous processing
    return 'asynchronous';
  }

  /**
   * Process prior authorization request synchronously
   */
  private async processSynchronously(claim: any, bundle: any, context: UserContext): Promise<any> {
    logger.info('Processing PAS request synchronously', {
      claimId: claim.id,
      correlationId: context.correlationId
    });

    // Mock UM decision for POC - real implementation would integrate with UM engine
    const decision = await this.mockUMDecision(claim, context);

    // Create ClaimResponse
    const claimResponse = this.createClaimResponse(claim, decision, context);

    // Store ClaimResponse
    const storedResponse = await fhirClient.createResource(claimResponse);

    // Return response Bundle
    return {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      entry: [{
        fullUrl: `ClaimResponse/${storedResponse.id}`,
        resource: storedResponse
      }]
    };
  }

  /**
   * Queue prior authorization request for asynchronous processing
   */
  private async queueForAsyncProcessing(claim: any, bundle: any, context: UserContext): Promise<any> {
    logger.info('Queueing PAS request for async processing', {
      claimId: claim.id,
      correlationId: context.correlationId
    });

    // Create Task resource for tracking
    const task = {
      resourceType: 'Task',
      id: uuidv4(),
      status: 'accepted',
      intent: 'order',
      code: {
        coding: [{
          system: 'http://hl7.org/fhir/us/davinci-pas/CodeSystem/PASTempCodes',
          code: 'prior-auth-review',
          display: 'Prior Authorization Review'
        }]
      },
      focus: {
        reference: `Claim/${claim.id}`
      },
      for: claim.patient,
      authoredOn: new Date().toISOString(),
      requester: claim.provider,
      businessStatus: {
        coding: [{
          system: 'http://hl7.org/fhir/us/davinci-pas/CodeSystem/PASTempCodes',
          code: 'processing',
          display: 'Processing'
        }]
      }
    };

    // Store Task
    const storedTask = await fhirClient.createResource(task);

    // Queue for background processing
    await queueManager.addPASProcessingJob({
      taskId: storedTask.id,
      claimId: claim.id,
      bundleId: bundle.id,
      priority: this.determinePriority(claim),
      submittedAt: new Date().toISOString(),
      context: {
        userId: context.user?.sub,
        correlationId: context.correlationId
      }
    });

    return storedTask;
  }

  /**
   * Determine processing priority based on claim characteristics
   */
  private determinePriority(claim: any): 'low' | 'normal' | 'high' | 'urgent' {
    // Check claim priority
    const claimPriority = claim.priority?.coding?.[0]?.code;

    if (claimPriority === 'stat') return 'urgent';
    if (claimPriority === 'urgent') return 'high';

    // Check for emergency/urgent procedures
    const hasUrgentProcedure = claim.item?.some((item: any) => {
      const serviceCode = item.productOrService?.coding?.[0]?.code;
      // Mock logic - check for emergency procedure codes
      return serviceCode && ['99281', '99282', '99283'].includes(serviceCode);
    });

    if (hasUrgentProcedure) return 'high';

    return 'normal';
  }

  /**
   * Mock UM decision engine for POC
   */
  private async mockUMDecision(claim: any, context: UserContext): Promise<any> {
    logger.debug('Executing mock UM decision logic', {
      claimId: claim.id,
      correlationId: context.correlationId
    });

    // Mock decision based on simple rules
    const hasConservativeTherapy = this.checkConservativeTherapy(claim);
    const hasNeuroDeficit = this.checkNeuroDeficit(claim);

    if (hasConservativeTherapy && hasNeuroDeficit) {
      return {
        disposition: 'approved',
        authorizationNumber: `PA-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        validityPeriod: {
          start: new Date().toISOString().split('T')[0],
          end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 90 days
        }
      };
    } else if (hasConservativeTherapy) {
      return {
        disposition: 'pended',
        requiresAdditionalInfo: true,
        pendingReason: 'Additional clinical documentation required'
      };
    } else {
      return {
        disposition: 'denied',
        denyReason: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/claimrejectionreason',
            code: 'no-conservative-therapy',
            display: 'Conservative therapy not attempted'
          }]
        }
      };
    }
  }

  /**
   * Check if conservative therapy was attempted based on questionnaire response
   */
  private checkConservativeTherapy(claim: any): boolean {
    // Mock logic - check supporting info for DTR questionnaire response
    const questionnaireResponse = claim.supportingInfo?.find(
      (info: any) => info.category?.coding?.[0]?.code === 'questionnaire-response'
    );

    if (!questionnaireResponse) return false;

    // In real implementation, would fetch and parse QuestionnaireResponse
    // For POC, assume conservative therapy if questionnaire is present
    return true;
  }

  /**
   * Check if neurologic deficits are present
   */
  private checkNeuroDeficit(claim: any): boolean {
    // Mock logic based on diagnosis codes
    const hasNeuroDeficitDx = claim.diagnosis?.some((dx: any) => {
      const code = dx.diagnosisCodeableConcept?.coding?.[0]?.code;
      // Mock ICD-10 codes for neurologic deficits
      return code && ['M54.5', 'G95.9', 'M51.36'].includes(code);
    });

    return hasNeuroDeficitDx;
  }

  /**
   * Create ClaimResponse resource
   */
  private createClaimResponse(claim: any, decision: any, context: UserContext): any {
    const now = new Date().toISOString();

    return {
      resourceType: 'ClaimResponse',
      id: uuidv4(),
      status: 'active',
      type: claim.type,
      use: 'preauthorization',
      patient: claim.patient,
      created: now,
      insurer: {
        reference: 'Organization/mock-payer'
      },
      requestor: claim.provider,
      request: {
        reference: `Claim/${claim.id}`
      },
      outcome: decision.disposition === 'approved' ? 'complete' : 'error',
      disposition: decision.disposition,
      preAuthRef: decision.authorizationNumber,
      preAuthPeriod: decision.validityPeriod,
      item: claim.item?.map((claimItem: any, index: number) => ({
        itemSequence: index + 1,
        adjudication: [{
          category: {
            coding: [{
              system: 'http://hl7.org/fhir/us/davinci-pas/CodeSystem/PASDJAdjudicationValueCodes',
              code: decision.disposition,
              display: decision.disposition.charAt(0).toUpperCase() + decision.disposition.slice(1)
            }]
          }
        }]
      }))
    };
  }

  /**
   * Log PAS submission audit event
   */
  private async logPASSubmissionAudit(
    claim: any | null,
    result: string,
    context: UserContext,
    error?: Error
  ): Promise<void> {
    try {
      await auditLogger.logEvent({
        eventType: 'PAS_SUBMISSION',
        timestamp: new Date().toISOString(),
        userId: context.user?.sub,
        patientId: claim?.patient?.reference,
        claimId: claim?.id,
        result,
        correlationId: context.correlationId,
        clientIp: context.clientIp,
        error: error?.message
      });
    } catch (auditError) {
      logger.error('Failed to log audit event', {
        error: auditError.message,
        correlationId: context.correlationId
      });
    }
  }
}

// Export singleton instance
export const pasRequestHandler = new PASRequestHandler();