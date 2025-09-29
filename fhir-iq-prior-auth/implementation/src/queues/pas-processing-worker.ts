import { Job } from 'bullmq';
import { logger } from '../utils/logger';
import { fhirClient } from '../services/fhir-client';
import { paDecisionEngine, PADecisionInput } from '../services/pa-decision-engine';
import { claimResponseGenerator, ClaimResponseInput, OperationOutcomeIssue } from '../services/claim-response-generator';
import { PASJobData } from './queue-manager';

/**
 * BullMQ Worker function for processing PAS requests
 * Reads queued PA requests, applies clinical rules, and writes ClaimResponse to FHIR store
 */
export async function pasProcessingWorker(job: Job<PASJobData>) {
  const { taskId, claimId, bundleId, context } = job.data;
  const correlationId = context.correlationId;

  try {
    logger.info('Starting PAS processing job', {
      jobId: job.id,
      taskId,
      claimId,
      bundleId,
      correlationId,
      attempts: job.attemptsMade + 1
    });

    // Update job progress
    await job.updateProgress(10);

    // Step 1: Fetch the Bundle and extract resources
    const { claim, questionnaireResponse, patient, coverage } = await fetchAndExtractResources(
      bundleId,
      claimId,
      correlationId
    );

    await job.updateProgress(30);

    // Step 2: Update Task status to in-progress
    await updateTaskStatus(taskId, 'in-progress', correlationId);

    await job.updateProgress(40);

    // Step 3: Apply decision engine
    logger.info('Applying PA decision engine', {
      claimId,
      patientId: patient.id,
      correlationId
    });

    const decisionInput: PADecisionInput = {
      claim,
      questionnaireResponse,
      patient,
      coverage,
      correlationId
    };

    const { decision, context: decisionContext } = await paDecisionEngine.makeDecision(decisionInput);

    await job.updateProgress(70);

    // Step 4: Generate ClaimResponse
    logger.info('Generating ClaimResponse', {
      claimId,
      disposition: decision.disposition,
      authorizationNumber: decision.authorizationNumber,
      correlationId
    });

    const claimResponseInput: ClaimResponseInput = {
      claim,
      decision,
      decisionContext,
      patient,
      coverage,
      correlationId
    };

    const claimResponse = claimResponseGenerator.generateClaimResponse(claimResponseInput);

    await job.updateProgress(80);

    // Step 5: Store ClaimResponse in FHIR server
    const storedClaimResponse = await fhirClient.create(claimResponse, correlationId);

    logger.info('ClaimResponse stored successfully', {
      claimResponseId: storedClaimResponse.id,
      claimId,
      disposition: decision.disposition,
      correlationId
    });

    await job.updateProgress(90);

    // Step 6: Update Task with completion status
    await updateTaskWithCompletion(taskId, storedClaimResponse, decision, correlationId);

    await job.updateProgress(100);

    logger.info('PAS processing job completed successfully', {
      jobId: job.id,
      claimId,
      claimResponseId: storedClaimResponse.id,
      disposition: decision.disposition,
      processingTime: Date.now() - job.timestamp,
      correlationId
    });

    // Return result for job completion
    return {
      success: true,
      claimResponseId: storedClaimResponse.id,
      disposition: decision.disposition,
      authorizationNumber: decision.authorizationNumber,
      processingTime: Date.now() - job.timestamp
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('PAS processing job failed', {
      jobId: job.id,
      taskId,
      claimId,
      error: errorMessage,
      attemptsMade: job.attemptsMade + 1,
      correlationId,
      stack: error instanceof Error ? error.stack : undefined
    });

    // Update Task with error status if this is the final attempt
    if (job.attemptsMade + 1 >= (job.opts.attempts || 3)) {
      await handleFinalFailure(taskId, errorMessage, correlationId);
    } else {
      // Update Task with retrying status
      await updateTaskStatus(taskId, 'in-progress', correlationId, `Retrying due to error: ${errorMessage}`);
    }

    // Re-throw error to trigger BullMQ retry logic
    throw new Error(`PAS processing failed: ${errorMessage}`);
  }
}

/**
 * Fetch Bundle and extract required resources
 */
async function fetchAndExtractResources(
  bundleId: string,
  claimId: string,
  correlationId: string
): Promise<{
  claim: any;
  questionnaireResponse?: any;
  patient: any;
  coverage: any;
}> {
  try {
    // Fetch the original Bundle
    const bundle = await fhirClient.read('Bundle', bundleId, correlationId);
    if (!bundle) {
      throw new Error(`Bundle ${bundleId} not found`);
    }

    // Extract resources from Bundle entries
    const resources = bundle.entry?.map((entry: any) => entry.resource) || [];

    // Find required resources
    const claim = resources.find((r: any) => r.resourceType === 'Claim' && r.id === claimId);
    const patient = resources.find((r: any) => r.resourceType === 'Patient');
    const coverage = resources.find((r: any) => r.resourceType === 'Coverage');
    const questionnaireResponse = resources.find((r: any) => r.resourceType === 'QuestionnaireResponse');

    if (!claim) {
      throw new Error(`Claim ${claimId} not found in Bundle ${bundleId}`);
    }
    if (!patient) {
      throw new Error(`Patient resource not found in Bundle ${bundleId}`);
    }
    if (!coverage) {
      throw new Error(`Coverage resource not found in Bundle ${bundleId}`);
    }

    logger.debug('Resources extracted from Bundle', {
      bundleId,
      claimId: claim.id,
      patientId: patient.id,
      coverageId: coverage.id,
      hasQuestionnaireResponse: !!questionnaireResponse,
      correlationId
    });

    return { claim, questionnaireResponse, patient, coverage };

  } catch (error) {
    logger.error('Failed to fetch and extract resources', {
      bundleId,
      claimId,
      error: error instanceof Error ? error.message : String(error),
      correlationId
    });
    throw error;
  }
}

/**
 * Update Task status in FHIR store
 */
async function updateTaskStatus(
  taskId: string,
  status: string,
  correlationId: string,
  note?: string
): Promise<void> {
  try {
    // Fetch current Task
    const task = await fhirClient.read('Task', taskId, correlationId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Update Task properties
    task.status = status;
    task.lastModified = new Date().toISOString();

    // Update business status based on main status
    if (status === 'in-progress') {
      task.businessStatus = {
        coding: [{
          system: 'http://hl7.org/fhir/us/davinci-pas/CodeSystem/PASTempCodes',
          code: 'processing',
          display: 'Processing'
        }]
      };
    }

    // Add note if provided
    if (note) {
      if (!task.note) {
        task.note = [];
      }
      task.note.push({
        time: new Date().toISOString(),
        text: note
      });
    }

    // Update Task in FHIR server
    await fhirClient.update(task, correlationId);

    logger.debug('Task status updated', {
      taskId,
      status,
      note,
      correlationId
    });

  } catch (error) {
    logger.error('Failed to update Task status', {
      taskId,
      status,
      error: error instanceof Error ? error.message : String(error),
      correlationId
    });
    // Don't throw error here - this is a secondary operation
  }
}

/**
 * Update Task with completion status and results
 */
async function updateTaskWithCompletion(
  taskId: string,
  claimResponse: any,
  decision: any,
  correlationId: string
): Promise<void> {
  try {
    // Fetch current Task
    const task = await fhirClient.read('Task', taskId, correlationId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Update Task to completed status
    task.status = 'completed';
    task.lastModified = new Date().toISOString();

    // Set business status based on decision
    const businessStatusCode = decision.disposition === 'approved' ? 'approved' :
                              decision.disposition === 'denied' ? 'denied' : 'pending';

    task.businessStatus = {
      coding: [{
        system: 'http://hl7.org/fhir/us/davinci-pas/CodeSystem/PASTempCodes',
        code: businessStatusCode,
        display: businessStatusCode.charAt(0).toUpperCase() + businessStatusCode.slice(1)
      }]
    };

    // Add output referencing the ClaimResponse
    task.output = [{
      type: {
        coding: [{
          system: 'http://hl7.org/fhir/us/davinci-pas/CodeSystem/PASTempCodes',
          code: 'claim-response',
          display: 'Claim Response'
        }]
      },
      valueReference: {
        reference: `ClaimResponse/${claimResponse.id}`
      }
    }];

    // Add completion note
    const completionNote = `PA processing completed with disposition: ${decision.disposition}`;
    if (!task.note) {
      task.note = [];
    }
    task.note.push({
      time: new Date().toISOString(),
      text: completionNote
    });

    // Update Task in FHIR server
    await fhirClient.update(task, correlationId);

    logger.info('Task updated with completion status', {
      taskId,
      claimResponseId: claimResponse.id,
      disposition: decision.disposition,
      correlationId
    });

  } catch (error) {
    logger.error('Failed to update Task with completion', {
      taskId,
      claimResponseId: claimResponse.id,
      error: error instanceof Error ? error.message : String(error),
      correlationId
    });
    // Don't throw error here - ClaimResponse was created successfully
  }
}

/**
 * Handle final failure after all retries exhausted
 */
async function handleFinalFailure(
  taskId: string,
  errorMessage: string,
  correlationId: string
): Promise<void> {
  try {
    // Fetch current Task
    const task = await fhirClient.read('Task', taskId, correlationId);
    if (!task) {
      logger.error(`Task ${taskId} not found for final failure handling`, { correlationId });
      return;
    }

    // Update Task to failed status
    task.status = 'failed';
    task.lastModified = new Date().toISOString();

    // Set business status to error
    task.businessStatus = {
      coding: [{
        system: 'http://hl7.org/fhir/us/davinci-pas/CodeSystem/PASTempCodes',
        code: 'error',
        display: 'Error'
      }]
    };

    // Add failure note
    if (!task.note) {
      task.note = [];
    }
    task.note.push({
      time: new Date().toISOString(),
      text: `PA processing failed after all retry attempts: ${errorMessage}`
    });

    // Create OperationOutcome with error details
    const operationOutcome = claimResponseGenerator.generateOperationOutcome([
      {
        severity: 'error',
        code: 'processing',
        details: {
          coding: [{
            system: 'http://fhir-iq.com/CodeSystem/pas-error-codes',
            code: 'processing-failed',
            display: 'Prior authorization processing failed'
          }],
          text: 'Automated processing failed - manual review required'
        },
        diagnostics: errorMessage
      }
    ], correlationId);

    // Store OperationOutcome and reference it in Task
    const storedOutcome = await fhirClient.create(operationOutcome, correlationId);

    task.output = [{
      type: {
        coding: [{
          system: 'http://hl7.org/fhir/resource-types',
          code: 'OperationOutcome',
          display: 'Operation Outcome'
        }]
      },
      valueReference: {
        reference: `OperationOutcome/${storedOutcome.id}`
      }
    }];

    // Update Task in FHIR server
    await fhirClient.update(task, correlationId);

    logger.error('Task marked as failed after all retries', {
      taskId,
      errorMessage,
      operationOutcomeId: storedOutcome.id,
      correlationId
    });

  } catch (error) {
    logger.error('Failed to handle final failure', {
      taskId,
      originalError: errorMessage,
      handlingError: error instanceof Error ? error.message : String(error),
      correlationId
    });
  }
}