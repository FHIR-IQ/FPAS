import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { fhirClient } from './fhir-client';

interface DTRContext {
  patient: string;
  encounter?: string;
  practitioner?: string;
  organization?: string;
}

interface RequestContext {
  user?: any;
  correlationId: string;
}

interface PrepopulationResult {
  success: boolean;
  value?: any;
  source?: string;
  error?: string;
}

interface PrepopulationSummary {
  itemsPopulated: number;
  itemsTotal: number;
  dataSourcesQueried: string[];
  populationSuccess: boolean;
}

/**
 * DTR Prepopulation Service - performs naive prepopulation by querying FHIR store
 * for Observations, Conditions, Procedures, and other clinical data
 */
export class DTRPrepopulationService {

  /**
   * Get questionnaire by procedure/service code
   */
  async getQuestionnaireByCode(code: string): Promise<any> {
    try {
      logger.debug('Fetching questionnaire for code', { code });

      // For POC, return a static questionnaire based on code
      return this.getDefaultQuestionnaire();
    } catch (error) {
      logger.error('Failed to fetch questionnaire by code', {
        error: error.message,
        code
      });
      throw error;
    }
  }

  /**
   * Get default DTR questionnaire
   */
  async getDefaultQuestionnaire(): Promise<any> {
    return {
      resourceType: 'Questionnaire',
      id: 'dtr-prior-auth-questionnaire',
      meta: {
        profile: ['http://hl7.org/fhir/us/davinci-dtr/StructureDefinition/dtr-questionnaire']
      },
      url: 'http://fhir-iq.com/Questionnaire/dtr-prior-auth',
      version: '1.0.0',
      name: 'DTRPriorAuthQuestionnaire',
      title: 'DTR Prior Authorization Questionnaire',
      status: 'active',
      experimental: false,
      publisher: 'FHIR IQ',
      description: 'Data collection questionnaire for prior authorization requests',
      item: [
        {
          linkId: 'conservative-therapy',
          text: 'Has the patient tried and failed conservative treatment for this condition?',
          type: 'boolean',
          required: true
        },
        {
          linkId: 'conservative-therapy-details',
          text: 'Please describe the conservative therapies attempted',
          type: 'text',
          enableWhen: [{
            question: 'conservative-therapy',
            operator: '=',
            answerBoolean: true
          }]
        },
        {
          linkId: 'neurologic-deficit',
          text: 'Does the patient have neurological deficits?',
          type: 'boolean',
          required: true
        },
        {
          linkId: 'neurologic-deficit-details',
          text: 'Please describe the neurological deficits',
          type: 'text',
          enableWhen: [{
            question: 'neurologic-deficit',
            operator: '=',
            answerBoolean: true
          }]
        },
        {
          linkId: 'symptom-duration',
          text: 'How long has the patient had symptoms?',
          type: 'quantity',
          required: true
        },
        {
          linkId: 'imaging-reason',
          text: 'What is the primary indication for imaging?',
          type: 'choice',
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

  /**
   * Create QuestionnaireResponse from DTR submission
   */
  async createQuestionnaireResponse(
    patientId: string,
    orderId: string,
    code: string,
    responses: Record<string, string>
  ): Promise<any> {
    try {
      logger.info('Creating QuestionnaireResponse', {
        patientId,
        orderId,
        code,
        responseCount: Object.keys(responses).length
      });

      const questionnaireResponse = {
        resourceType: 'QuestionnaireResponse',
        id: uuidv4(),
        meta: {
          profile: ['http://hl7.org/fhir/us/davinci-dtr/StructureDefinition/dtr-questionnaireresponse']
        },
        questionnaire: 'http://fhir-iq.com/Questionnaire/dtr-prior-auth',
        status: 'completed',
        subject: {
          reference: `Patient/${patientId}`
        },
        authored: new Date().toISOString(),
        item: []
      };

      // Convert form responses to FHIR QuestionnaireResponse items
      for (const [linkId, value] of Object.entries(responses)) {
        if (value && value.trim() !== '') {
          let answer;

          switch (linkId) {
            case 'failedConservativeTx':
            case 'neuroDeficit':
              answer = { valueBoolean: value === 'true' };
              break;
            case 'treatmentDuration':
              answer = { valueString: value };
              break;
            default:
              answer = { valueString: value };
          }

          questionnaireResponse.item.push({
            linkId,
            answer: [answer]
          });
        }
      }

      return questionnaireResponse;
    } catch (error) {
      logger.error('Failed to create QuestionnaireResponse', {
        error: error.message,
        patientId,
        orderId
      });
      throw error;
    }
  }

  /**
   * Prepopulate questionnaire with patient clinical data
   */
  async prepopulateQuestionnaire(
    questionnaire: any,
    dtrContext: DTRContext,
    context: RequestContext
  ): Promise<any> {
    try {
      logger.info('Starting questionnaire prepopulation', {
        questionnaireId: questionnaire.id,
        patient: dtrContext.patient,
        correlationId: context.correlationId
      });

      // Create base QuestionnaireResponse
      const questionnaireResponse = this.createBaseQuestionnaireResponse(
        questionnaire,
        dtrContext,
        context
      );

      // Query patient clinical data
      const clinicalData = await this.queryClinicalData(dtrContext, context);

      // Populate each questionnaire item
      const populationResults: PrepopulationResult[] = [];

      for (const item of questionnaire.item || []) {
        const result = await this.populateQuestionnaireItem(
          item,
          clinicalData,
          dtrContext,
          context
        );
        populationResults.push(result);

        if (result.success && result.value !== undefined) {
          // Add populated answer to QuestionnaireResponse
          this.addAnswerToResponse(questionnaireResponse, item.linkId, result.value, item.type);
        }
      }

      // Log prepopulation results
      const successCount = populationResults.filter(r => r.success).length;
      logger.info('Questionnaire prepopulation completed', {
        questionnaireId: questionnaire.id,
        itemsPopulated: successCount,
        itemsTotal: populationResults.length,
        correlationId: context.correlationId
      });

      return questionnaireResponse;

    } catch (error) {
      logger.error('Questionnaire prepopulation failed', {
        error: error.message,
        questionnaireId: questionnaire.id,
        patient: dtrContext.patient,
        correlationId: context.correlationId
      });
      throw error;
    }
  }

  /**
   * Generate prepopulation summary for reporting
   */
  async generatePrepopulationSummary(
    questionnaire: any,
    questionnaireResponse: any,
    context: RequestContext
  ): Promise<PrepopulationSummary> {
    const totalItems = questionnaire.item?.length || 0;
    const populatedItems = questionnaireResponse.item?.filter((item: any) =>
      item.answer && item.answer.length > 0
    ).length || 0;

    return {
      itemsPopulated: populatedItems,
      itemsTotal: totalItems,
      dataSourcesQueried: [
        'Observation',
        'Condition',
        'Procedure',
        'MedicationStatement',
        'DiagnosticReport'
      ],
      populationSuccess: populatedItems > 0
    };
  }

  /**
   * Create base QuestionnaireResponse structure
   */
  private createBaseQuestionnaireResponse(
    questionnaire: any,
    dtrContext: DTRContext,
    context: RequestContext
  ): any {
    return {
      resourceType: 'QuestionnaireResponse',
      id: uuidv4(),
      meta: {
        profile: ['http://hl7.org/fhir/us/davinci-dtr/StructureDefinition/dtr-questionnaireresponse']
      },
      questionnaire: questionnaire.url || `Questionnaire/${questionnaire.id}`,
      status: 'in-progress',
      subject: {
        reference: `Patient/${dtrContext.patient}`
      },
      authored: new Date().toISOString(),
      author: dtrContext.practitioner ? {
        reference: `Practitioner/${dtrContext.practitioner}`
      } : undefined,
      source: dtrContext.practitioner ? {
        reference: `Practitioner/${dtrContext.practitioner}`
      } : undefined,
      item: []
    };
  }

  /**
   * Query clinical data from FHIR store for prepopulation
   */
  private async queryClinicalData(
    dtrContext: DTRContext,
    context: RequestContext
  ): Promise<any> {
    try {
      logger.debug('Querying clinical data for prepopulation', {
        patient: dtrContext.patient,
        correlationId: context.correlationId
      });

      // Query different resource types in parallel
      const [
        observations,
        conditions,
        procedures,
        medications,
        diagnosticReports
      ] = await Promise.all([
        this.queryObservations(dtrContext.patient, context),
        this.queryConditions(dtrContext.patient, context),
        this.queryProcedures(dtrContext.patient, context),
        this.queryMedications(dtrContext.patient, context),
        this.queryDiagnosticReports(dtrContext.patient, context)
      ]);

      return {
        observations,
        conditions,
        procedures,
        medications,
        diagnosticReports
      };

    } catch (error) {
      logger.error('Failed to query clinical data', {
        error: error.message,
        patient: dtrContext.patient,
        correlationId: context.correlationId
      });
      throw error;
    }
  }

  /**
   * Query patient observations
   */
  private async queryObservations(patientId: string, context: RequestContext): Promise<any[]> {
    try {
      const searchResult = await fhirClient.search('Observation', {
        patient: patientId,
        _sort: '-date',
        _count: 50
      }, context.correlationId);

      return searchResult.entry?.map(entry => entry.resource) || [];
    } catch (error) {
      logger.warn('Failed to query observations', {
        error: error.message,
        patient: patientId,
        correlationId: context.correlationId
      });
      return [];
    }
  }

  /**
   * Query patient conditions
   */
  private async queryConditions(patientId: string, context: RequestContext): Promise<any[]> {
    try {
      const searchResult = await fhirClient.search('Condition', {
        patient: patientId,
        _sort: '-recorded-date',
        _count: 50
      }, context.correlationId);

      return searchResult.entry?.map(entry => entry.resource) || [];
    } catch (error) {
      logger.warn('Failed to query conditions', {
        error: error.message,
        patient: patientId,
        correlationId: context.correlationId
      });
      return [];
    }
  }

  /**
   * Query patient procedures
   */
  private async queryProcedures(patientId: string, context: RequestContext): Promise<any[]> {
    try {
      const searchResult = await fhirClient.search('Procedure', {
        patient: patientId,
        _sort: '-date',
        _count: 50
      }, context.correlationId);

      return searchResult.entry?.map(entry => entry.resource) || [];
    } catch (error) {
      logger.warn('Failed to query procedures', {
        error: error.message,
        patient: patientId,
        correlationId: context.correlationId
      });
      return [];
    }
  }

  /**
   * Query patient medications
   */
  private async queryMedications(patientId: string, context: RequestContext): Promise<any[]> {
    try {
      const searchResult = await fhirClient.search('MedicationStatement', {
        patient: patientId,
        _sort: '-effective',
        _count: 50
      }, context.correlationId);

      return searchResult.entry?.map(entry => entry.resource) || [];
    } catch (error) {
      logger.warn('Failed to query medications', {
        error: error.message,
        patient: patientId,
        correlationId: context.correlationId
      });
      return [];
    }
  }

  /**
   * Query diagnostic reports
   */
  private async queryDiagnosticReports(patientId: string, context: RequestContext): Promise<any[]> {
    try {
      const searchResult = await fhirClient.search('DiagnosticReport', {
        patient: patientId,
        _sort: '-date',
        _count: 30
      }, context.correlationId);

      return searchResult.entry?.map(entry => entry.resource) || [];
    } catch (error) {
      logger.warn('Failed to query diagnostic reports', {
        error: error.message,
        patient: patientId,
        correlationId: context.correlationId
      });
      return [];
    }
  }

  /**
   * Populate individual questionnaire item based on clinical data
   */
  private async populateQuestionnaireItem(
    item: any,
    clinicalData: any,
    dtrContext: DTRContext,
    context: RequestContext
  ): Promise<PrepopulationResult> {
    try {
      logger.debug('Populating questionnaire item', {
        linkId: item.linkId,
        type: item.type,
        correlationId: context.correlationId
      });

      // Apply naive prepopulation rules based on linkId
      switch (item.linkId) {
        case 'conservative-therapy':
          return this.populateConservativeTherapy(clinicalData, context);

        case 'conservative-therapy-details':
          return this.populateConservativeTherapyDetails(clinicalData, context);

        case 'neurologic-deficit':
          return this.populateNeurologicDeficit(clinicalData, context);

        case 'neurologic-deficit-details':
          return this.populateNeurologicDeficitDetails(clinicalData, context);

        case 'symptom-duration':
          return this.populateSymptomDuration(clinicalData, context);

        case 'imaging-reason':
          return this.populateImagingReason(clinicalData, context);

        default:
          logger.debug('No prepopulation rule for item', {
            linkId: item.linkId,
            correlationId: context.correlationId
          });
          return { success: false, error: 'No prepopulation rule defined' };
      }

    } catch (error) {
      logger.error('Failed to populate questionnaire item', {
        error: error.message,
        linkId: item.linkId,
        correlationId: context.correlationId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Populate conservative therapy question
   */
  private populateConservativeTherapy(clinicalData: any, context: RequestContext): PrepopulationResult {
    // Look for physical therapy procedures or medications indicating conservative treatment
    const procedures = clinicalData.procedures || [];
    const medications = clinicalData.medications || [];

    // Check for physical therapy procedures
    const physicalTherapy = procedures.find((proc: any) =>
      this.containsCodeInCoding(proc.code, [
        '91251008', // Physical therapy
        '229060009', // Therapeutic exercise
        '182813001'  // Manual therapy
      ])
    );

    // Check for conservative therapy medications (NSAIDs, muscle relaxants)
    const conservativeMeds = medications.find((med: any) =>
      this.containsCodeInCoding(med.medicationCodeableConcept, [
        '387207008', // Ibuprofen
        '387494007', // Naproxen
        '387467008', // Diclofenac
        '387467008'  // Cyclobenzaprine
      ])
    );

    const hasConservativeTherapy = !!(physicalTherapy || conservativeMeds);

    return {
      success: true,
      value: hasConservativeTherapy,
      source: physicalTherapy ? 'Procedure' : conservativeMeds ? 'MedicationStatement' : 'None'
    };
  }

  /**
   * Populate conservative therapy details
   */
  private populateConservativeTherapyDetails(clinicalData: any, context: RequestContext): PrepopulationResult {
    const procedures = clinicalData.procedures || [];
    const medications = clinicalData.medications || [];

    const treatments: string[] = [];

    // Find physical therapy
    const pt = procedures.find((proc: any) =>
      this.containsCodeInCoding(proc.code, ['91251008', '229060009'])
    );
    if (pt) {
      treatments.push('Physical therapy');
    }

    // Find medications
    const nsaids = medications.filter((med: any) =>
      this.containsCodeInCoding(med.medicationCodeableConcept, ['387207008', '387494007'])
    );
    if (nsaids.length > 0) {
      treatments.push('NSAIDs');
    }

    const muscleRelaxants = medications.filter((med: any) =>
      this.containsCodeInCoding(med.medicationCodeableConcept, ['387467008'])
    );
    if (muscleRelaxants.length > 0) {
      treatments.push('Muscle relaxants');
    }

    if (treatments.length > 0) {
      return {
        success: true,
        value: treatments.join(', '),
        source: 'Procedure,MedicationStatement'
      };
    }

    return { success: false, error: 'No conservative therapy found' };
  }

  /**
   * Populate neurologic deficit question
   */
  private populateNeurologicDeficit(clinicalData: any, context: RequestContext): PrepopulationResult {
    const conditions = clinicalData.conditions || [];
    const observations = clinicalData.observations || [];

    // Look for neurologic conditions
    const neuroCondition = conditions.find((cond: any) =>
      this.containsCodeInCoding(cond.code, [
        '84017003',  // Radiculopathy
        '54586004',  // Spinal stenosis
        '23056005',  // Neuralgia
        'G54.4'      // Lumbosacral root disorders
      ])
    );

    // Look for neurologic examination findings
    const neuroExam = observations.find((obs: any) =>
      this.containsCodeInCoding(obs.code, [
        '87572000',  // Neurological examination
        '102491009', // Decreased reflex
        '44695005'   // Paralysis
      ])
    );

    const hasNeuroDeficit = !!(neuroCondition || neuroExam);

    return {
      success: true,
      value: hasNeuroDeficit,
      source: neuroCondition ? 'Condition' : neuroExam ? 'Observation' : 'None'
    };
  }

  /**
   * Populate neurologic deficit details
   */
  private populateNeurologicDeficitDetails(clinicalData: any, context: RequestContext): PrepopulationResult {
    const conditions = clinicalData.conditions || [];
    const observations = clinicalData.observations || [];

    const findings: string[] = [];

    // Check conditions
    const radiculopathy = conditions.find((cond: any) =>
      this.containsCodeInCoding(cond.code, ['84017003'])
    );
    if (radiculopathy) {
      findings.push('Radiculopathy');
    }

    const stenosis = conditions.find((cond: any) =>
      this.containsCodeInCoding(cond.code, ['54586004'])
    );
    if (stenosis) {
      findings.push('Spinal stenosis');
    }

    // Check observations
    const weakness = observations.find((obs: any) =>
      this.containsCodeInCoding(obs.code, ['26544005'])
    );
    if (weakness) {
      findings.push('Muscle weakness');
    }

    if (findings.length > 0) {
      return {
        success: true,
        value: findings.join(', '),
        source: 'Condition,Observation'
      };
    }

    return { success: false, error: 'No neurologic deficit details found' };
  }

  /**
   * Populate symptom duration
   */
  private populateSymptomDuration(clinicalData: any, context: RequestContext): PrepopulationResult {
    const conditions = clinicalData.conditions || [];

    // Find back pain condition and calculate duration
    const backPain = conditions.find((cond: any) =>
      this.containsCodeInCoding(cond.code, ['279039007', 'M54.5'])
    );

    if (backPain && backPain.onsetDateTime) {
      const onsetDate = new Date(backPain.onsetDateTime);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - onsetDate.getTime());
      const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));

      return {
        success: true,
        value: {
          value: diffWeeks,
          unit: 'weeks',
          system: 'http://unitsofmeasure.org',
          code: 'wk'
        },
        source: 'Condition'
      };
    }

    // Default to 8 weeks if no specific onset found
    return {
      success: true,
      value: {
        value: 8,
        unit: 'weeks',
        system: 'http://unitsofmeasure.org',
        code: 'wk'
      },
      source: 'Default'
    };
  }

  /**
   * Populate imaging reason
   */
  private populateImagingReason(clinicalData: any, context: RequestContext): PrepopulationResult {
    const conditions = clinicalData.conditions || [];

    // Find primary back-related condition
    const backPain = conditions.find((cond: any) =>
      this.containsCodeInCoding(cond.code, ['279039007'])
    );

    if (backPain) {
      return {
        success: true,
        value: {
          system: 'http://snomed.info/sct',
          code: '279039007',
          display: 'Low back pain'
        },
        source: 'Condition'
      };
    }

    const radiculopathy = conditions.find((cond: any) =>
      this.containsCodeInCoding(cond.code, ['84017003'])
    );

    if (radiculopathy) {
      return {
        success: true,
        value: {
          system: 'http://snomed.info/sct',
          code: '84017003',
          display: 'Radiculopathy'
        },
        source: 'Condition'
      };
    }

    // Default to low back pain
    return {
      success: true,
      value: {
        system: 'http://snomed.info/sct',
        code: '279039007',
        display: 'Low back pain'
      },
      source: 'Default'
    };
  }

  /**
   * Check if coding contains any of the specified codes
   */
  private containsCodeInCoding(codeableConcept: any, codes: string[]): boolean {
    if (!codeableConcept || !codeableConcept.coding) {
      return false;
    }

    return codeableConcept.coding.some((coding: any) =>
      codes.includes(coding.code)
    );
  }

  /**
   * Add answer to QuestionnaireResponse item
   */
  private addAnswerToResponse(
    questionnaireResponse: any,
    linkId: string,
    value: any,
    type: string
  ): void {
    if (!questionnaireResponse.item) {
      questionnaireResponse.item = [];
    }

    const answer = this.formatAnswerByType(value, type);
    if (answer) {
      questionnaireResponse.item.push({
        linkId,
        answer: [answer]
      });
    }
  }

  /**
   * Format answer based on question type
   */
  private formatAnswerByType(value: any, type: string): any {
    switch (type) {
      case 'boolean':
        return { valueBoolean: Boolean(value) };

      case 'string':
      case 'text':
        return { valueString: String(value) };

      case 'integer':
        return { valueInteger: parseInt(value) };

      case 'decimal':
        return { valueDecimal: parseFloat(value) };

      case 'date':
        return { valueDate: value };

      case 'dateTime':
        return { valueDateTime: value };

      case 'quantity':
        return { valueQuantity: value };

      case 'choice':
        return { valueCoding: value };

      default:
        return { valueString: String(value) };
    }
  }
}

// Export singleton instance
export const dtrPrepopulationService = new DTRPrepopulationService();