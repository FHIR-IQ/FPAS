/**
 * Vendor Adapter Interface
 *
 * Defines the contract for integrating with external utilization management (UM)
 * vendors while maintaining compatibility with FHIR PAS workflows.
 *
 * This interface allows the system to switch between different UM providers
 * without changing the core prior authorization processing logic.
 */

import { Bundle, ClaimResponse, Task, Claim } from 'fhir/r4';

export interface VendorAdapterConfig {
  vendorId: string;
  vendorName: string;
  apiEndpoint: string;
  authentication: VendorAuthConfig;
  features: VendorFeatures;
  mappings?: VendorMappings;
  timeouts?: VendorTimeouts;
}

export interface VendorAuthConfig {
  type: 'oauth2' | 'api-key' | 'basic' | 'custom';
  clientId?: string;
  clientSecret?: string;
  tokenEndpoint?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  customHeaders?: Record<string, string>;
}

export interface VendorFeatures {
  supportsRealTimeDecisions: boolean;
  supportsAsyncDecisions: boolean;
  supportsBulkSubmissions: boolean;
  supportsStatusInquiry: boolean;
  supportsDocumentUpload: boolean;
  supportsWebhooks: boolean;
  maxConcurrentRequests: number;
  supportedResourceTypes: string[];
}

export interface VendorMappings {
  codeSystemMappings: Record<string, string>;
  fieldMappings: Record<string, string>;
  statusMappings: Record<string, VendorStatus>;
  priorityMappings?: Record<string, string>;
}

export interface VendorTimeouts {
  connectionTimeout: number;
  requestTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface VendorStatus {
  code: string;
  display: string;
  fhirMapping: 'approved' | 'denied' | 'pended' | 'cancelled';
}

export interface VendorRequest {
  requestId: string;
  vendorRequestId?: string;
  submissionTime: Date;
  priority: 'routine' | 'urgent' | 'stat';
  bundle: Bundle;
  context: VendorRequestContext;
}

export interface VendorRequestContext {
  submitterId: string;
  providerId: string;
  payerId: string;
  patientId: string;
  correlationId: string;
  metadata?: Record<string, any>;
}

export interface VendorResponse {
  vendorRequestId: string;
  vendorResponseId: string;
  responseTime: Date;
  status: VendorDecisionStatus;
  decision: VendorDecision;
  processingTime: number;
  rawResponse?: any;
}

export interface VendorDecisionStatus {
  code: string;
  display: string;
  category: 'final' | 'preliminary' | 'pending' | 'error';
}

export interface VendorDecision {
  outcome: 'approved' | 'denied' | 'pended' | 'cancelled';
  authorizationNumber?: string;
  reason?: string;
  reasonCode?: string;
  validUntil?: Date;
  conditions?: string[];
  supportingDocuments?: VendorDocument[];
  nextSteps?: string[];
}

export interface VendorDocument {
  id: string;
  type: string;
  description: string;
  url?: string;
  content?: string;
  mimeType: string;
}

export interface VendorStatusInquiry {
  vendorRequestId: string;
  submitterRequestId: string;
}

export interface VendorStatusResponse {
  vendorRequestId: string;
  currentStatus: VendorDecisionStatus;
  lastUpdated: Date;
  estimatedCompletion?: Date;
  statusHistory: VendorStatusHistoryEntry[];
}

export interface VendorStatusHistoryEntry {
  status: VendorDecisionStatus;
  timestamp: Date;
  note?: string;
}

export interface VendorHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  features: Record<string, boolean>;
  lastChecked: Date;
  errorDetails?: string;
}

/**
 * Main Vendor Adapter Interface
 *
 * All vendor adapters must implement this interface to ensure
 * consistent integration with the PAS workflow.
 */
export interface VendorAdapterInterface {
  /**
   * Initialize the vendor adapter with configuration
   */
  initialize(config: VendorAdapterConfig): Promise<void>;

  /**
   * Submit a prior authorization request to the vendor
   */
  submitPriorAuthRequest(request: VendorRequest): Promise<VendorResponse>;

  /**
   * Query the status of a previously submitted request
   */
  queryRequestStatus(inquiry: VendorStatusInquiry): Promise<VendorStatusResponse>;

  /**
   * Cancel a pending request
   */
  cancelRequest(vendorRequestId: string): Promise<boolean>;

  /**
   * Transform FHIR Bundle to vendor-specific format
   */
  transformFHIRToVendor(bundle: Bundle): Promise<any>;

  /**
   * Transform vendor response to FHIR ClaimResponse
   */
  transformVendorToFHIR(vendorResponse: VendorResponse): Promise<ClaimResponse>;

  /**
   * Health check for vendor connectivity
   */
  healthCheck(): Promise<VendorHealthCheck>;

  /**
   * Get vendor capabilities and configuration
   */
  getCapabilities(): VendorFeatures;

  /**
   * Handle webhook notifications from vendor (if supported)
   */
  handleWebhook?(payload: any): Promise<VendorResponse>;

  /**
   * Bulk submission support (if vendor supports it)
   */
  submitBulkRequests?(requests: VendorRequest[]): Promise<VendorResponse[]>;

  /**
   * Upload supporting documents (if vendor supports it)
   */
  uploadDocument?(requestId: string, document: VendorDocument): Promise<string>;
}

/**
 * Vendor Adapter Factory Interface
 *
 * Used to create vendor-specific adapter instances
 */
export interface VendorAdapterFactory {
  createAdapter(vendorId: string, config: VendorAdapterConfig): VendorAdapterInterface;
  getSupportedVendors(): string[];
  getVendorInfo(vendorId: string): VendorInfo;
}

export interface VendorInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  features: VendorFeatures;
  configurationSchema: any;
}

/**
 * Adapter Registry for managing multiple vendor adapters
 */
export interface VendorAdapterRegistry {
  registerAdapter(vendorId: string, adapter: VendorAdapterInterface): void;
  getAdapter(vendorId: string): VendorAdapterInterface | undefined;
  listAdapters(): string[];
  removeAdapter(vendorId: string): boolean;
}

/**
 * Error types for vendor adapter operations
 */
export class VendorAdapterError extends Error {
  constructor(
    message: string,
    public readonly vendorId: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'VendorAdapterError';
  }
}

export class VendorConnectionError extends VendorAdapterError {
  constructor(vendorId: string, details?: any) {
    super(`Failed to connect to vendor ${vendorId}`, vendorId, 'CONNECTION_ERROR', details);
    this.name = 'VendorConnectionError';
  }
}

export class VendorAuthenticationError extends VendorAdapterError {
  constructor(vendorId: string, details?: any) {
    super(`Authentication failed for vendor ${vendorId}`, vendorId, 'AUTH_ERROR', details);
    this.name = 'VendorAuthenticationError';
  }
}

export class VendorTimeoutError extends VendorAdapterError {
  constructor(vendorId: string, timeout: number) {
    super(`Request to vendor ${vendorId} timed out after ${timeout}ms`, vendorId, 'TIMEOUT_ERROR');
    this.name = 'VendorTimeoutError';
  }
}

export class VendorTransformationError extends VendorAdapterError {
  constructor(vendorId: string, direction: 'toVendor' | 'toFHIR', details?: any) {
    super(`Data transformation failed for vendor ${vendorId} (${direction})`, vendorId, 'TRANSFORM_ERROR', details);
    this.name = 'VendorTransformationError';
  }
}