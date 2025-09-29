/**
 * Enhanced PA Decision Service
 *
 * Integrates with vendor adapters to process prior authorization requests
 * while maintaining backward compatibility with the existing POC workflow.
 */

import { Bundle, ClaimResponse, Task } from 'fhir/r4';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { vendorAdapterRegistry } from '../adapters/vendor-adapter.registry';
import {
  VendorAdapterInterface,
  VendorRequest,
  VendorResponse,
  VendorAdapterError
} from '../adapters/vendor-adapter.interface';

export interface EnhancedPADecisionContext {
  correlationId: string;
  submitterId: string;
  providerId: string;
  payerId: string;
  patientId: string;
  priority: 'routine' | 'urgent' | 'stat';
  preferredVendor?: string;
  fallbackVendors?: string[];
  metadata?: Record<string, any>;
}

export interface PADecisionResult {
  success: boolean;
  claimResponse?: ClaimResponse;
  task?: Task;
  vendorResponse?: VendorResponse;
  processingTime: number;
  vendorUsed: string;
  fallbacksAttempted: string[];
  errors?: string[];
}

export class EnhancedPADecisionService {
  private defaultVendorPriority: string[] = ['mock'];

  /**
   * Process prior authorization request using vendor adapters
   */
  async processRequest(
    bundle: Bundle,
    context: EnhancedPADecisionContext
  ): Promise<PADecisionResult> {
    const startTime = Date.now();
    const fallbacksAttempted: string[] = [];
    const errors: string[] = [];

    logger.info('Processing enhanced PA request', {
      bundleId: bundle.id,
      correlationId: context.correlationId,
      preferredVendor: context.preferredVendor,
      priority: context.priority
    });

    try {
      // Determine vendor priority list
      const vendorPriority = this.buildVendorPriorityList(context);

      // Attempt processing with each vendor in priority order
      for (const vendorId of vendorPriority) {
        try {
          logger.debug('Attempting PA processing with vendor', {
            vendorId,
            correlationId: context.correlationId
          });

          const result = await this.processWithVendor(vendorId, bundle, context);

          logger.info('PA request processed successfully', {
            vendorId,
            correlationId: context.correlationId,
            outcome: result.vendorResponse?.decision.outcome,
            processingTime: Date.now() - startTime
          });

          return {
            success: true,
            claimResponse: result.claimResponse,
            task: result.task,
            vendorResponse: result.vendorResponse,
            processingTime: Date.now() - startTime,
            vendorUsed: vendorId,
            fallbacksAttempted,
            errors: errors.length > 0 ? errors : undefined
          };

        } catch (error) {
          const errorMessage = `Vendor ${vendorId} failed: ${error.message}`;
          errors.push(errorMessage);
          fallbacksAttempted.push(vendorId);

          logger.warn('Vendor processing failed, trying next vendor', {
            vendorId,
            error: error.message,
            correlationId: context.correlationId
          });

          // Continue to next vendor
          continue;
        }
      }

      // If all vendors failed
      throw new Error(`All vendor adapters failed. Attempted: ${fallbacksAttempted.join(', ')}`);

    } catch (error) {
      logger.error('Enhanced PA request processing failed', {
        error: error.message,
        correlationId: context.correlationId,
        fallbacksAttempted,
        processingTime: Date.now() - startTime
      });

      return {
        success: false,
        processingTime: Date.now() - startTime,
        vendorUsed: 'none',
        fallbacksAttempted,
        errors: [...errors, error.message]
      };
    }
  }

  /**
   * Query request status using vendor adapters
   */
  async queryRequestStatus(
    requestId: string,
    vendorId?: string
  ): Promise<{
    success: boolean;
    status?: any;
    vendor?: string;
    error?: string;
  }> {
    logger.info('Querying PA request status', { requestId, vendorId });

    try {
      // If vendor specified, use it; otherwise try all adapters
      const vendorsToTry = vendorId ? [vendorId] : vendorAdapterRegistry.listAdapters();

      for (const currentVendorId of vendorsToTry) {
        const adapter = vendorAdapterRegistry.getAdapter(currentVendorId);
        if (!adapter) {
          continue;
        }

        try {
          const statusResponse = await adapter.queryRequestStatus({
            vendorRequestId: requestId,
            submitterRequestId: requestId
          });

          return {
            success: true,
            status: statusResponse,
            vendor: currentVendorId
          };

        } catch (error) {
          if (vendorId) {
            // If specific vendor was requested, don't try others
            throw error;
          }
          // Continue trying other vendors
          continue;
        }
      }

      throw new Error('Request not found in any vendor system');

    } catch (error) {
      logger.error('Status query failed', {
        error: error.message,
        requestId,
        vendorId
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get vendor adapter health status
   */
  async getVendorHealth(): Promise<Record<string, any>> {
    logger.debug('Checking vendor adapter health');

    try {
      const healthResults = await vendorAdapterRegistry.healthCheckAll();

      logger.info('Vendor health check completed', {
        vendorCount: Object.keys(healthResults).length,
        healthyVendors: Object.values(healthResults).filter(h => h.status === 'healthy').length
      });

      return healthResults;

    } catch (error) {
      logger.error('Vendor health check failed', { error: error.message });
      return {};
    }
  }

  /**
   * Initialize vendor adapters from configuration
   */
  async initializeVendors(vendorConfigs: any[]): Promise<void> {
    logger.info('Initializing vendor adapters', {
      vendorCount: vendorConfigs.length
    });

    try {
      await vendorAdapterRegistry.loadAdaptersFromConfig(vendorConfigs);

      const stats = vendorAdapterRegistry.getRegistryStats();
      logger.info('Vendor adapters initialized', {
        totalAdapters: stats.totalAdapters,
        activeAdapters: stats.activeAdapters
      });

    } catch (error) {
      logger.error('Vendor adapter initialization failed', {
        error: error.message
      });
      throw error;
    }
  }

  // Private helper methods

  private async processWithVendor(
    vendorId: string,
    bundle: Bundle,
    context: EnhancedPADecisionContext
  ): Promise<{
    claimResponse?: ClaimResponse;
    task?: Task;
    vendorResponse: VendorResponse;
  }> {
    const adapter = vendorAdapterRegistry.getAdapter(vendorId);

    if (!adapter) {
      throw new VendorAdapterError(`Vendor adapter not found: ${vendorId}`, vendorId, 'ADAPTER_NOT_FOUND');
    }

    // Check vendor health first
    const health = await adapter.healthCheck();
    if (health.status !== 'healthy') {
      throw new VendorAdapterError(`Vendor ${vendorId} is unhealthy: ${health.status}`, vendorId, 'VENDOR_UNHEALTHY');
    }

    // Create vendor request
    const vendorRequest: VendorRequest = {
      requestId: uuidv4(),
      submissionTime: new Date(),
      priority: context.priority,
      bundle,
      context: {
        submitterId: context.submitterId,
        providerId: context.providerId,
        payerId: context.payerId,
        patientId: context.patientId,
        correlationId: context.correlationId,
        metadata: context.metadata
      }
    };

    // Submit to vendor
    const vendorResponse = await adapter.submitPriorAuthRequest(vendorRequest);

    // Transform vendor response to FHIR
    const claimResponse = await adapter.transformVendorToFHIR(vendorResponse);

    // Create task if needed (for async processing)
    let task: Task | undefined;
    if (vendorResponse.status.category === 'preliminary' || vendorResponse.status.category === 'pending') {
      task = this.createProcessingTask(vendorResponse, context);
    }

    return {
      claimResponse,
      task,
      vendorResponse
    };
  }

  private buildVendorPriorityList(context: EnhancedPADecisionContext): string[] {
    const priorityList: string[] = [];

    // Add preferred vendor first
    if (context.preferredVendor) {
      priorityList.push(context.preferredVendor);
    }

    // Add fallback vendors
    if (context.fallbackVendors) {
      context.fallbackVendors.forEach(vendor => {
        if (!priorityList.includes(vendor)) {
          priorityList.push(vendor);
        }
      });
    }

    // Add default vendors
    this.defaultVendorPriority.forEach(vendor => {
      if (!priorityList.includes(vendor)) {
        priorityList.push(vendor);
      }
    });

    // Add any remaining registered vendors
    vendorAdapterRegistry.listAdapters().forEach(vendor => {
      if (!priorityList.includes(vendor)) {
        priorityList.push(vendor);
      }
    });

    return priorityList;
  }

  private createProcessingTask(
    vendorResponse: VendorResponse,
    context: EnhancedPADecisionContext
  ): Task {
    return {
      resourceType: 'Task',
      id: uuidv4(),
      meta: {
        profile: ['http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-task']
      },
      identifier: [
        {
          system: 'http://fhir-iq.com/task-id',
          value: vendorResponse.vendorRequestId
        }
      ],
      status: 'in-progress',
      intent: 'order',
      code: {
        coding: [
          {
            system: 'http://hl7.org/fhir/us/davinci-pas/CodeSystem/PASTempCodes',
            code: 'prior-auth-processing',
            display: 'Prior Authorization Processing'
          }
        ]
      },
      description: vendorResponse.decision.reason || 'Prior authorization request under review',
      for: {
        reference: `Patient/${context.patientId}`
      },
      authoredOn: vendorResponse.responseTime.toISOString(),
      lastModified: vendorResponse.responseTime.toISOString(),
      requester: {
        reference: `Practitioner/${context.providerId}`
      },
      owner: {
        reference: 'Organization/pas-system'
      },
      businessStatus: {
        coding: [
          {
            system: 'http://fhir-iq.com/pas-business-status',
            code: vendorResponse.status.code,
            display: vendorResponse.status.display
          }
        ]
      },
      note: vendorResponse.decision.nextSteps ? [
        {
          text: `Next steps: ${vendorResponse.decision.nextSteps.join(', ')}`,
          time: vendorResponse.responseTime.toISOString()
        }
      ] : undefined
    };
  }

  /**
   * Get service configuration and stats
   */
  getServiceInfo(): {
    name: string;
    version: string;
    vendorAdapters: Record<string, any>;
    defaultPriority: string[];
    features: string[];
  } {
    return {
      name: 'Enhanced PA Decision Service',
      version: '1.0.0',
      vendorAdapters: vendorAdapterRegistry.getRegistryStats().configurations,
      defaultPriority: this.defaultVendorPriority,
      features: [
        'Multi-vendor support',
        'Automatic fallback',
        'Real-time decisions',
        'Async processing',
        'Status inquiry',
        'Health monitoring'
      ]
    };
  }
}

// Export singleton instance
export const enhancedPADecisionService = new EnhancedPADecisionService();