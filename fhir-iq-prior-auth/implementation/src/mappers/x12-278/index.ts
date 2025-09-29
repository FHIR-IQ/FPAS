/**
 * X12 278 Mapper Module
 *
 * Optional module for legacy X12 EDI integration.
 * Can be excluded from pure-FHIR deployments per CMS enforcement requirements.
 *
 * @module X12278Mapper
 * @optional
 */

import { Bundle, ClaimResponse } from 'fhir/r4';
import { logger } from '../../utils/logger';
import { FHIRToX12Mapper } from './fhir-to-x12.mapper';
import { X12ToFHIRMapper } from './x12-to-fhir.mapper';
import { X12Validator } from './validation/x12-validator';
import { BusinessRulesValidator } from './validation/business-rules';

export interface X12MapperConfig {
  senderId: string;           // X12 sender identification
  receiverId: string;         // X12 receiver identification
  submitterNPI: string;       // Submitter NPI
  validateX12: boolean;       // Enable X12 format validation
  validateBusinessRules: boolean; // Enable business rule validation
  generateControlNumbers: boolean; // Auto-generate control numbers
  environmentCode: string;    // P=Production, T=Test
}

export interface X12Transaction {
  transactionSetId: string;   // 278 for health care services review
  controlNumber: string;      // Transaction control number
  segments: string[];         // Array of X12 segments
  rawEdi: string;            // Complete EDI transaction
}

export interface X12MapperInterface {
  // FHIR → X12 Transformation
  bundleToX12(bundle: Bundle): Promise<X12Transaction>;
  claimResponseToX12(claimResponse: ClaimResponse): Promise<X12Transaction>;

  // X12 → FHIR Transformation
  x12ToBundle(transaction: X12Transaction): Promise<Bundle>;
  x12ToClaimResponse(transaction: X12Transaction): Promise<ClaimResponse>;

  // Validation
  validateX12Transaction(transaction: X12Transaction): Promise<ValidationResult>;
  validateFHIRBundle(bundle: Bundle): Promise<ValidationResult>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  location?: string;          // Segment or element location
  severity: 'error' | 'fatal';
}

export interface ValidationWarning {
  code: string;
  message: string;
  location?: string;
  suggestion?: string;
}

/**
 * Main X12 278 Mapper Implementation
 */
export class X12278Mapper implements X12MapperInterface {
  private fhirToX12Mapper: FHIRToX12Mapper;
  private x12ToFHIRMapper: X12ToFHIRMapper;
  private x12Validator: X12Validator;
  private businessRulesValidator: BusinessRulesValidator;
  private config: X12MapperConfig;

  constructor(config: X12MapperConfig) {
    this.config = config;
    this.fhirToX12Mapper = new FHIRToX12Mapper(config);
    this.x12ToFHIRMapper = new X12ToFHIRMapper(config);
    this.x12Validator = new X12Validator(config);
    this.businessRulesValidator = new BusinessRulesValidator(config);

    logger.info('X12 278 Mapper initialized', {
      senderId: config.senderId,
      environment: config.environmentCode,
      validationEnabled: config.validateX12
    });
  }

  /**
   * Transform FHIR Bundle to X12 278 Transaction
   */
  async bundleToX12(bundle: Bundle): Promise<X12Transaction> {
    try {
      logger.debug('Converting FHIR Bundle to X12 278', {
        bundleId: bundle.id,
        entryCount: bundle.entry?.length || 0
      });

      // Validate FHIR Bundle first
      if (this.config.validateBusinessRules) {
        const fhirValidation = await this.validateFHIRBundle(bundle);
        if (!fhirValidation.isValid) {
          throw new Error(`FHIR Bundle validation failed: ${fhirValidation.errors[0]?.message}`);
        }
      }

      // Transform to X12
      const transaction = await this.fhirToX12Mapper.transform(bundle);

      // Validate X12 output
      if (this.config.validateX12) {
        const x12Validation = await this.validateX12Transaction(transaction);
        if (!x12Validation.isValid) {
          throw new Error(`X12 validation failed: ${x12Validation.errors[0]?.message}`);
        }
      }

      logger.info('Successfully converted Bundle to X12 278', {
        transactionId: transaction.controlNumber,
        segmentCount: transaction.segments.length
      });

      return transaction;

    } catch (error) {
      logger.error('Failed to convert Bundle to X12', {
        error: error.message,
        bundleId: bundle.id
      });
      throw error;
    }
  }

  /**
   * Transform FHIR ClaimResponse to X12 278 Response
   */
  async claimResponseToX12(claimResponse: ClaimResponse): Promise<X12Transaction> {
    try {
      logger.debug('Converting ClaimResponse to X12 278 Response', {
        claimResponseId: claimResponse.id,
        outcome: claimResponse.outcome
      });

      return await this.fhirToX12Mapper.transformResponse(claimResponse);

    } catch (error) {
      logger.error('Failed to convert ClaimResponse to X12', {
        error: error.message,
        claimResponseId: claimResponse.id
      });
      throw error;
    }
  }

  /**
   * Transform X12 278 Transaction to FHIR Bundle
   */
  async x12ToBundle(transaction: X12Transaction): Promise<Bundle> {
    try {
      logger.debug('Converting X12 278 to FHIR Bundle', {
        controlNumber: transaction.controlNumber,
        segmentCount: transaction.segments.length
      });

      // Validate X12 input
      if (this.config.validateX12) {
        const validation = await this.validateX12Transaction(transaction);
        if (!validation.isValid) {
          throw new Error(`X12 validation failed: ${validation.errors[0]?.message}`);
        }
      }

      // Transform to FHIR
      const bundle = await this.x12ToFHIRMapper.transform(transaction);

      logger.info('Successfully converted X12 278 to Bundle', {
        bundleId: bundle.id,
        entryCount: bundle.entry?.length || 0
      });

      return bundle;

    } catch (error) {
      logger.error('Failed to convert X12 to Bundle', {
        error: error.message,
        controlNumber: transaction.controlNumber
      });
      throw error;
    }
  }

  /**
   * Transform X12 278 Response to FHIR ClaimResponse
   */
  async x12ToClaimResponse(transaction: X12Transaction): Promise<ClaimResponse> {
    try {
      logger.debug('Converting X12 278 Response to ClaimResponse', {
        controlNumber: transaction.controlNumber
      });

      return await this.x12ToFHIRMapper.transformResponse(transaction);

    } catch (error) {
      logger.error('Failed to convert X12 Response to ClaimResponse', {
        error: error.message,
        controlNumber: transaction.controlNumber
      });
      throw error;
    }
  }

  /**
   * Validate X12 Transaction
   */
  async validateX12Transaction(transaction: X12Transaction): Promise<ValidationResult> {
    const syntaxValidation = await this.x12Validator.validateSyntax(transaction);
    const businessValidation = this.config.validateBusinessRules
      ? await this.businessRulesValidator.validateX12(transaction)
      : { isValid: true, errors: [], warnings: [] };

    return {
      isValid: syntaxValidation.isValid && businessValidation.isValid,
      errors: [...syntaxValidation.errors, ...businessValidation.errors],
      warnings: [...syntaxValidation.warnings, ...businessValidation.warnings]
    };
  }

  /**
   * Validate FHIR Bundle for X12 mapping compatibility
   */
  async validateFHIRBundle(bundle: Bundle): Promise<ValidationResult> {
    return await this.businessRulesValidator.validateFHIR(bundle);
  }

  /**
   * Generate X12 control number
   */
  generateControlNumber(): string {
    const timestamp = Date.now().toString();
    return timestamp.slice(-9); // Use last 9 digits of timestamp
  }

  /**
   * Get mapper configuration
   */
  getConfig(): X12MapperConfig {
    return { ...this.config };
  }

  /**
   * Update mapper configuration
   */
  updateConfig(updates: Partial<X12MapperConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('X12 Mapper configuration updated', updates);
  }
}

/**
 * Factory function to create X12 mapper instance
 */
export function createX12Mapper(config: X12MapperConfig): X12278Mapper {
  return new X12278Mapper(config);
}

/**
 * Check if X12 mapping is available in current deployment
 */
export function isX12MappingAvailable(): boolean {
  try {
    // This module is available if we can import it
    return true;
  } catch {
    return false;
  }
}

// Export types for external use
export type {
  X12MapperConfig,
  X12Transaction,
  X12MapperInterface,
  ValidationResult,
  ValidationError,
  ValidationWarning
};