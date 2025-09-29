/**
 * PAS Processor with Optional X12 Integration
 *
 * Demonstrates how the X12 mapper module can be conditionally included
 * to support legacy systems while maintaining pure-FHIR capability.
 */

import { Bundle, ClaimResponse } from 'fhir/r4';
import { logger } from '../utils/logger';
import { PASRequestHandler } from '../handlers/pas-request-handler';

// Optional X12 imports - these will be excluded in pure-FHIR deployments
import type {
  X12278Mapper,
  X12MapperConfig,
  X12Transaction,
  X12MapperInterface
} from '../mappers/x12-278';

export interface PASProcessorConfig {
  // Core FHIR processing (always available)
  enableAsyncProcessing: boolean;
  validateFHIR: boolean;
  auditLogging: boolean;

  // Optional X12 integration
  enableX12Mapping?: boolean;
  x12Config?: X12MapperConfig;
  legacyEndpoints?: boolean;
  x12ValidationLevel?: 'syntax' | 'business' | 'full';
}

export interface ProcessingResult {
  fhirResponse: Bundle | ClaimResponse;
  x12Response?: X12Transaction;  // Only present when X12 enabled
  processingTime: number;
  validationResults?: ValidationSummary;
}

export interface ValidationSummary {
  fhirValid: boolean;
  x12Valid?: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Enhanced PAS Processor supporting optional X12 integration
 */
export class PASProcessorWithX12 {
  private pasHandler: PASRequestHandler;
  private x12Mapper?: X12MapperInterface;
  private config: PASProcessorConfig;

  constructor(config: PASProcessorConfig) {
    this.config = config;
    this.pasHandler = new PASRequestHandler();

    // Conditionally initialize X12 mapper
    this.initializeX12Mapper();
  }

  /**
   * Process PAS request with optional X12 transformation
   */
  async processRequest(bundle: Bundle): Promise<ProcessingResult> {
    const startTime = Date.now();
    const validationResults: ValidationSummary = {
      fhirValid: true,
      errors: [],
      warnings: []
    };

    try {
      logger.info('Processing PAS request', {
        bundleId: bundle.id,
        x12Enabled: !!this.x12Mapper,
        entryCount: bundle.entry?.length
      });

      // Step 1: Core FHIR processing (always performed)
      const fhirResponse = await this.pasHandler.submitRequest(bundle, {
        correlationId: bundle.id || 'unknown',
        clientIp: 'system'
      });

      const result: ProcessingResult = {
        fhirResponse: fhirResponse.response || fhirResponse.task,
        processingTime: Date.now() - startTime,
        validationResults
      };

      // Step 2: Optional X12 transformation
      if (this.x12Mapper && this.config.enableX12Mapping) {
        try {
          result.x12Response = await this.generateX12Response(
            bundle,
            result.fhirResponse
          );
          validationResults.x12Valid = true;

          logger.debug('X12 transformation completed', {
            controlNumber: result.x12Response.controlNumber,
            segmentCount: result.x12Response.segments.length
          });

        } catch (x12Error) {
          logger.warn('X12 transformation failed', {
            error: x12Error.message,
            bundleId: bundle.id
          });

          validationResults.x12Valid = false;
          validationResults.warnings.push(`X12 mapping failed: ${x12Error.message}`);

          // Continue processing - X12 failure doesn't stop FHIR processing
        }
      }

      logger.info('PAS request processing completed', {
        bundleId: bundle.id,
        processingTime: result.processingTime,
        x12Generated: !!result.x12Response
      });

      return result;

    } catch (error) {
      logger.error('PAS request processing failed', {
        error: error.message,
        bundleId: bundle.id,
        processingTime: Date.now() - startTime
      });

      validationResults.fhirValid = false;
      validationResults.errors.push(error.message);

      throw error;
    }
  }

  /**
   * Process X12 278 request (legacy endpoint)
   */
  async processX12Request(x12Transaction: X12Transaction): Promise<ProcessingResult> {
    if (!this.x12Mapper) {
      throw new Error('X12 processing not available - mapper not configured');
    }

    const startTime = Date.now();

    try {
      logger.info('Processing X12 278 request', {
        controlNumber: x12Transaction.controlNumber,
        transactionSetId: x12Transaction.transactionSetId
      });

      // Transform X12 to FHIR
      const fhirBundle = await this.x12Mapper.x12ToBundle(x12Transaction);

      // Process via standard FHIR workflow
      const fhirResult = await this.processRequest(fhirBundle);

      // Transform FHIR response back to X12
      const x12Response = await this.x12Mapper.bundleToX12(
        fhirResult.fhirResponse as Bundle
      );

      return {
        ...fhirResult,
        x12Response,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('X12 request processing failed', {
        error: error.message,
        controlNumber: x12Transaction.controlNumber
      });
      throw error;
    }
  }

  /**
   * Get processing capabilities
   */
  getCapabilities(): {
    fhirProcessing: boolean;
    x12Processing: boolean;
    legacyEndpoints: boolean;
    supportedFormats: string[];
  } {
    return {
      fhirProcessing: true,
      x12Processing: !!this.x12Mapper,
      legacyEndpoints: this.config.legacyEndpoints || false,
      supportedFormats: this.x12Mapper
        ? ['application/fhir+json', 'application/edi-x12']
        : ['application/fhir+json']
    };
  }

  /**
   * Validate configuration compatibility
   */
  validateConfiguration(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check X12 configuration
    if (this.config.enableX12Mapping && !this.x12Mapper) {
      issues.push('X12 mapping enabled but mapper initialization failed');
    }

    if (this.config.legacyEndpoints && !this.config.enableX12Mapping) {
      issues.push('Legacy endpoints require X12 mapping to be enabled');
    }

    // Check for conflicting settings
    if (this.config.x12ValidationLevel === 'full' && !this.config.validateFHIR) {
      issues.push('Full X12 validation recommended with FHIR validation enabled');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Initialize X12 mapper conditionally
   */
  private async initializeX12Mapper(): Promise<void> {
    if (!this.config.enableX12Mapping || !this.config.x12Config) {
      logger.info('X12 mapping disabled - running in pure-FHIR mode');
      return;
    }

    try {
      // Dynamic import to avoid loading X12 module in pure-FHIR deployments
      const { X12278Mapper } = await import('../mappers/x12-278');

      this.x12Mapper = new X12278Mapper(this.config.x12Config);

      logger.info('X12 mapper initialized successfully', {
        senderId: this.config.x12Config.senderId,
        validation: this.config.x12ValidationLevel || 'syntax'
      });

    } catch (error) {
      logger.error('Failed to initialize X12 mapper', {
        error: error.message,
        config: this.config.x12Config
      });

      // In production, you might want to fail startup if X12 is required
      if (this.config.legacyEndpoints) {
        throw new Error('X12 mapper required for legacy endpoints but initialization failed');
      }

      // Otherwise, continue in FHIR-only mode
      logger.warn('Continuing in FHIR-only mode due to X12 initialization failure');
    }
  }

  /**
   * Generate X12 response from FHIR processing results
   */
  private async generateX12Response(
    originalBundle: Bundle,
    fhirResponse: Bundle | ClaimResponse
  ): Promise<X12Transaction> {
    if (!this.x12Mapper) {
      throw new Error('X12 mapper not available');
    }

    // If response is a ClaimResponse, convert it directly
    if (fhirResponse.resourceType === 'ClaimResponse') {
      return await this.x12Mapper.claimResponseToX12(fhirResponse as ClaimResponse);
    }

    // If response is a Bundle, extract ClaimResponse
    const bundle = fhirResponse as Bundle;
    const claimResponse = bundle.entry?.find(
      entry => entry.resource?.resourceType === 'ClaimResponse'
    )?.resource as ClaimResponse;

    if (claimResponse) {
      return await this.x12Mapper.claimResponseToX12(claimResponse);
    }

    // Fallback: convert the entire response bundle
    return await this.x12Mapper.bundleToX12(bundle);
  }

  /**
   * Health check including X12 mapper status
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    fhir: boolean;
    x12?: boolean;
    details: Record<string, any>;
  }> {
    const health = {
      status: 'healthy' as const,
      fhir: true,
      details: {
        fhirProcessing: true,
        x12Enabled: !!this.x12Mapper,
        legacyEndpoints: this.config.legacyEndpoints
      }
    };

    // Check X12 mapper health if enabled
    if (this.x12Mapper) {
      try {
        // Test basic X12 functionality
        const testConfig = this.x12Mapper.getConfig();
        health.x12 = !!testConfig.senderId;
        health.details.x12Config = {
          senderId: testConfig.senderId,
          validation: testConfig.validateX12
        };

      } catch (error) {
        health.x12 = false;
        health.status = 'degraded';
        health.details.x12Error = error.message;
      }
    }

    return health;
  }
}

// Factory functions for different deployment scenarios

/**
 * Create processor for pure-FHIR deployment (CMS enforcement)
 */
export function createFHIROnlyProcessor(): PASProcessorWithX12 {
  return new PASProcessorWithX12({
    enableAsyncProcessing: true,
    validateFHIR: true,
    auditLogging: true,
    enableX12Mapping: false,      // Explicitly disabled
    legacyEndpoints: false
  });
}

/**
 * Create processor with X12 integration for legacy systems
 */
export function createHybridProcessor(x12Config: X12MapperConfig): PASProcessorWithX12 {
  return new PASProcessorWithX12({
    enableAsyncProcessing: true,
    validateFHIR: true,
    auditLogging: true,
    enableX12Mapping: true,       // X12 enabled
    x12Config,
    legacyEndpoints: true,
    x12ValidationLevel: 'business'
  });
}

/**
 * Create processor for gateway/clearinghouse deployment
 */
export function createGatewayProcessor(x12Config: X12MapperConfig): PASProcessorWithX12 {
  return new PASProcessorWithX12({
    enableAsyncProcessing: true,
    validateFHIR: true,
    auditLogging: true,
    enableX12Mapping: true,
    x12Config,
    legacyEndpoints: true,
    x12ValidationLevel: 'full'    // Maximum validation for gateway
  });
}

// Export configuration types
export type { PASProcessorConfig, ProcessingResult, ValidationSummary };