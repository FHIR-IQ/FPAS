import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { fhirClient } from '../services/fhir-client';
import { dtrPrepopulationService } from '../services/dtr-prepopulation-service';

interface SmartLaunchParams {
  iss: string;
  launch: string;
  patient?: string;
  encounter?: string;
  questionnaire?: string;
  service?: string;
}

interface DTRContext {
  patient: string;
  encounter?: string;
  practitioner?: string;
  organization?: string;
}

interface RequestContext {
  user?: any;
  correlationId: string;
  userAgent?: string;
}

/**
 * DTR Launcher Handler for SMART app launch and questionnaire prepopulation
 */
export class DTRLauncherHandler {

  /**
   * Handle SMART App Launch for DTR workflow
   */
  async handleSmartLaunch(
    params: SmartLaunchParams,
    context: RequestContext
  ): Promise<any> {
    try {
      logger.info('Processing SMART DTR launch', {
        iss: params.iss,
        launch: params.launch,
        service: params.service,
        correlationId: context.correlationId
      });

      // Validate launch parameters
      this.validateLaunchParams(params);

      // Get questionnaire based on service or questionnaire parameter
      const questionnaire = await this.resolveQuestionnaire(params, context);

      // Extract patient context
      const patientId = params.patient || await this.extractPatientFromLaunch(params.launch);

      // Build DTR context
      const dtrContext: DTRContext = {
        patient: patientId,
        encounter: params.encounter,
        practitioner: await this.extractPractitionerFromContext(params.launch),
        organization: await this.extractOrganizationFromContext(params.launch)
      };

      // Generate launch URL for DTR app
      const launchUrl = this.generateDTRLaunchUrl(questionnaire, dtrContext, context);

      return {
        questionnaire,
        context: dtrContext,
        launchUrl
      };

    } catch (error) {
      logger.error('SMART DTR launch failed', {
        error: error.message,
        params,
        correlationId: context.correlationId
      });
      throw error;
    }
  }

  /**
   * Get questionnaire by service type or canonical URL
   */
  async getQuestionnaire(
    params: { service?: string; url?: string; version?: string },
    context: RequestContext
  ): Promise<any | null> {
    try {
      if (params.url) {
        // Search by canonical URL
        const searchResult = await fhirClient.search('Questionnaire', {
          url: params.url,
          version: params.version
        }, context.correlationId);

        return searchResult.entry?.[0]?.resource || null;
      }

      if (params.service) {
        // Search by service type using context extension
        const questionnaire = await this.findQuestionnaireByService(params.service, context);
        return questionnaire;
      }

      throw new Error('Either service or url parameter is required');

    } catch (error) {
      logger.error('Failed to get questionnaire', {
        error: error.message,
        params,
        correlationId: context.correlationId
      });
      throw error;
    }
  }

  /**
   * Prepopulate questionnaire with patient clinical data
   */
  async prepopulateQuestionnaire(
    questionnaireInput: string | any,
    dtrContext: DTRContext,
    context: RequestContext
  ): Promise<any> {
    try {
      // Resolve questionnaire if ID/URL provided
      let questionnaire = questionnaireInput;
      if (typeof questionnaireInput === 'string') {
        questionnaire = await this.resolveQuestionnaireById(questionnaireInput, context);
      }

      logger.info('Starting questionnaire prepopulation', {
        questionnaireId: questionnaire.id,
        patient: dtrContext.patient,
        correlationId: context.correlationId
      });

      // Use DTR prepopulation service to populate questionnaire
      const questionnaireResponse = await dtrPrepopulationService.prepopulateQuestionnaire(
        questionnaire,
        dtrContext,
        context
      );

      return questionnaireResponse;

    } catch (error) {
      logger.error('Questionnaire prepopulation failed', {
        error: error.message,
        questionnaireId: typeof questionnaireInput === 'string' ? questionnaireInput : questionnaireInput?.id,
        patient: dtrContext.patient,
        correlationId: context.correlationId
      });
      throw error;
    }
  }

  /**
   * Complete DTR workflow: get questionnaire and prepopulate
   */
  async launchAndPrepopulate(
    service: string,
    dtrContext: DTRContext,
    context: RequestContext
  ): Promise<any> {
    try {
      logger.info('Executing complete DTR workflow', {
        service,
        patient: dtrContext.patient,
        correlationId: context.correlationId
      });

      // Step 1: Get questionnaire for service
      const questionnaire = await this.findQuestionnaireByService(service, context);
      if (!questionnaire) {
        throw new Error(`No questionnaire found for service: ${service}`);
      }

      // Step 2: Prepopulate questionnaire
      const questionnaireResponse = await dtrPrepopulationService.prepopulateQuestionnaire(
        questionnaire,
        dtrContext,
        context
      );

      // Step 3: Generate prepopulation summary
      const prepopulationSummary = await dtrPrepopulationService.generatePrepopulationSummary(
        questionnaire,
        questionnaireResponse,
        context
      );

      return {
        questionnaire,
        questionnaireResponse,
        prepopulationSummary
      };

    } catch (error) {
      logger.error('Complete DTR workflow failed', {
        error: error.message,
        service,
        patient: dtrContext.patient,
        correlationId: context.correlationId
      });
      throw error;
    }
  }

  /**
   * Validate SMART launch parameters
   */
  private validateLaunchParams(params: SmartLaunchParams): void {
    if (!params.iss) {
      throw new Error('FHIR server issuer (iss) is required');
    }

    if (!params.launch) {
      throw new Error('Launch context token is required');
    }

    if (!params.service && !params.questionnaire) {
      throw new Error('Either service type or questionnaire must be specified');
    }
  }

  /**
   * Resolve questionnaire based on launch parameters
   */
  private async resolveQuestionnaire(
    params: SmartLaunchParams,
    context: RequestContext
  ): Promise<any> {
    if (params.questionnaire) {
      // Direct questionnaire reference
      return await this.resolveQuestionnaireById(params.questionnaire, context);
    }

    if (params.service) {
      // Find by service type
      const questionnaire = await this.findQuestionnaireByService(params.service, context);
      if (!questionnaire) {
        throw new Error(`No questionnaire found for service: ${params.service}`);
      }
      return questionnaire;
    }

    throw new Error('Unable to resolve questionnaire from launch parameters');
  }

  /**
   * Find questionnaire by service type
   */
  private async findQuestionnaireByService(
    service: string,
    context: RequestContext
  ): Promise<any | null> {
    try {
      // Service mapping for POC - in real implementation would use proper search
      const serviceQuestionnaireMap: Record<string, string> = {
        'lumbar-mri': 'imaging-lumbar-mri',
        'cardiac-catheterization': 'cardiac-cath',
        'knee-arthroscopy': 'orthopedic-knee',
        'ct-head': 'imaging-ct-head'
      };

      const questionnaireId = serviceQuestionnaireMap[service];
      if (!questionnaireId) {
        logger.warn('Unknown service type', { service, correlationId: context.correlationId });
        return null;
      }

      // For POC, return the lumbar MRI questionnaire we have in specs
      if (service === 'lumbar-mri') {
        return await this.getMockLumbarMRIQuestionnaire(context);
      }

      // Try to find in FHIR server
      const searchResult = await fhirClient.search('Questionnaire', {
        identifier: questionnaireId,
        status: 'active'
      }, context.correlationId);

      return searchResult.entry?.[0]?.resource || null;

    } catch (error) {
      logger.error('Failed to find questionnaire by service', {
        error: error.message,
        service,
        correlationId: context.correlationId
      });
      return null;
    }
  }

  /**
   * Resolve questionnaire by ID or canonical URL
   */
  private async resolveQuestionnaireById(
    questionnaireId: string,
    context: RequestContext
  ): Promise<any> {
    // Try direct read first
    let questionnaire = await fhirClient.read('Questionnaire', questionnaireId, context.correlationId);

    if (!questionnaire) {
      // Try search by canonical URL
      const searchResult = await fhirClient.search('Questionnaire', {
        url: questionnaireId
      }, context.correlationId);

      questionnaire = searchResult.entry?.[0]?.resource;
    }

    if (!questionnaire) {
      throw new Error(`Questionnaire not found: ${questionnaireId}`);
    }

    return questionnaire;
  }

  /**
   * Extract patient ID from launch context (mock implementation)
   */
  private async extractPatientFromLaunch(launchToken: string): Promise<string> {
    // Mock implementation - in real SMART launch, would decode JWT token
    logger.debug('Extracting patient from launch token', { launchToken });

    // For POC, extract patient ID from launch token if formatted as "patient-{id}"
    const match = launchToken.match(/patient-(.+)/);
    if (match) {
      return match[1];
    }

    // Default to mock patient for POC
    return 'patient-example-jane-doe';
  }

  /**
   * Extract practitioner from launch context (mock implementation)
   */
  private async extractPractitionerFromContext(launchToken: string): Promise<string | undefined> {
    // Mock implementation
    logger.debug('Extracting practitioner from launch context', { launchToken });

    const match = launchToken.match(/practitioner-(.+)/);
    if (match) {
      return match[1];
    }

    return 'practitioner-dr-smith';
  }

  /**
   * Extract organization from launch context (mock implementation)
   */
  private async extractOrganizationFromContext(launchToken: string): Promise<string | undefined> {
    // Mock implementation
    logger.debug('Extracting organization from launch context', { launchToken });

    const match = launchToken.match(/org-(.+)/);
    if (match) {
      return match[1];
    }

    return 'provider-organization-spine-clinic';
  }

  /**
   * Generate DTR app launch URL
   */
  private generateDTRLaunchUrl(
    questionnaire: any,
    dtrContext: DTRContext,
    context: RequestContext
  ): string {
    const baseUrl = process.env.DTR_APP_URL || 'https://dtr.fhir-iq.com';
    const params = new URLSearchParams({
      questionnaire: questionnaire.id,
      patient: dtrContext.patient,
      fhirServer: process.env.FHIR_BASE_URL || 'http://localhost:8080/fhir'
    });

    if (dtrContext.encounter) {
      params.set('encounter', dtrContext.encounter);
    }

    return `${baseUrl}/launch?${params.toString()}`;
  }

  /**
   * Get mock lumbar MRI questionnaire for POC
   */
  private async getMockLumbarMRIQuestionnaire(context: RequestContext): Promise<any> {
    // Return the questionnaire from our specs directory
    return {
      resourceType: 'Questionnaire',
      id: 'imaging-lumbar-mri',
      url: 'http://fhir-iq.com/Questionnaire/imaging-lumbar-mri',
      version: '1.0.0',
      name: 'ImagingLumbarMRIQuestionnaire',
      title: 'Lumbar MRI Prior Authorization Questionnaire',
      status: 'active',
      date: '2024-09-26',
      publisher: 'FHIR IQ Prior Authorization POC',
      description: 'Questionnaire for lumbar MRI prior authorization with DTR integration',
      jurisdiction: [{
        coding: [{
          system: 'urn:iso:std:iso:3166',
          code: 'US',
          display: 'United States of America'
        }]
      }],
      useContext: [{
        code: {
          system: 'http://terminology.hl7.org/CodeSystem/usage-context-type',
          code: 'task',
          display: 'Workflow Task'
        },
        valueCodeableConcept: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: '113091000',
            display: 'Magnetic resonance imaging'
          }]
        }
      }],
      item: [
        {
          linkId: 'conservative-therapy',
          text: 'Has the patient tried conservative therapy for at least 6 weeks?',
          type: 'boolean',
          required: true,
          extension: [{
            url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression',
            valueExpression: {
              language: 'text/cql',
              expression: 'ConservativeTherapyAttempted'
            }
          }]
        },
        {
          linkId: 'conservative-therapy-details',
          text: 'What conservative treatments were tried?',
          type: 'text',
          enableWhen: [{
            question: 'conservative-therapy',
            operator: '=',
            answerBoolean: true
          }],
          extension: [{
            url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression',
            valueExpression: {
              language: 'text/cql',
              expression: 'ConservativeTherapyDetails'
            }
          }]
        },
        {
          linkId: 'neurologic-deficit',
          text: 'Does the patient have neurologic deficits?',
          type: 'boolean',
          required: true,
          extension: [{
            url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression',
            valueExpression: {
              language: 'text/cql',
              expression: 'HasNeurologicDeficit'
            }
          }]
        },
        {
          linkId: 'neurologic-deficit-details',
          text: 'Describe the neurologic deficits',
          type: 'text',
          enableWhen: [{
            question: 'neurologic-deficit',
            operator: '=',
            answerBoolean: true
          }],
          extension: [{
            url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression',
            valueExpression: {
              language: 'text/cql',
              expression: 'NeurologicDeficitDetails'
            }
          }]
        },
        {
          linkId: 'symptom-duration',
          text: 'How long has the patient had symptoms?',
          type: 'quantity',
          required: true,
          extension: [{
            url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression',
            valueExpression: {
              language: 'text/cql',
              expression: 'SymptomDuration'
            }
          }]
        },
        {
          linkId: 'imaging-reason',
          text: 'Primary reason for MRI request',
          type: 'choice',
          required: true,
          answerOption: [
            {
              valueCoding: {
                system: 'http://snomed.info/sct',
                code: '279039007',
                display: 'Low back pain'
              }
            },
            {
              valueCoding: {
                system: 'http://snomed.info/sct',
                code: '84017003',
                display: 'Radiculopathy'
              }
            },
            {
              valueCoding: {
                system: 'http://snomed.info/sct',
                code: '54586004',
                display: 'Spinal stenosis'
              }
            }
          ]
        }
      ]
    };
  }
}

// Export singleton instance
export const dtrLauncherHandler = new DTRLauncherHandler();