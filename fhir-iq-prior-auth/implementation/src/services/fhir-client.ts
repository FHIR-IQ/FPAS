import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

export interface FHIRSearchResult {
  resourceType: 'Bundle';
  type: 'searchset';
  total: number;
  entry?: Array<{
    fullUrl: string;
    resource: any;
    search?: {
      mode: 'match' | 'include';
      score?: number;
    };
  }>;
  link?: Array<{
    relation: string;
    url: string;
  }>;
}

export interface FHIROperationOutcome {
  resourceType: 'OperationOutcome';
  issue: Array<{
    severity: 'fatal' | 'error' | 'warning' | 'information';
    code: string;
    details?: any;
    diagnostics?: string;
  }>;
}

/**
 * FHIR REST Client for interacting with HAPI FHIR Server
 * Provides methods for CRUD operations and search
 */
export class FHIRClient {
  private httpClient: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.fhir.baseUrl;

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: config.fhir.timeout || 30000,
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json',
        'User-Agent': 'FHIR-IQ-PAS-Server/1.0.0'
      }
    });

    this.setupInterceptors();
  }

  /**
   * Create a new FHIR resource
   */
  async createResource<T = any>(resource: any, correlationId?: string): Promise<T> {
    try {
      logger.debug('Creating FHIR resource', {
        resourceType: resource.resourceType,
        resourceId: resource.id,
        correlationId
      });

      const response = await this.httpClient.post(
        `/${resource.resourceType}`,
        resource,
        {
          headers: correlationId ? { 'X-Correlation-ID': correlationId } : {}
        }
      );

      logger.info('FHIR resource created successfully', {
        resourceType: resource.resourceType,
        resourceId: response.data.id,
        statusCode: response.status,
        correlationId
      });

      return response.data;

    } catch (error) {
      logger.error('Failed to create FHIR resource', {
        error: this.extractErrorMessage(error),
        resourceType: resource.resourceType,
        correlationId
      });
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Read a FHIR resource by ID
   */
  async readResource<T = any>(resourceType: string, id: string, correlationId?: string): Promise<T | null> {
    try {
      logger.debug('Reading FHIR resource', {
        resourceType,
        resourceId: id,
        correlationId
      });

      const response = await this.httpClient.get(
        `/${resourceType}/${id}`,
        {
          headers: correlationId ? { 'X-Correlation-ID': correlationId } : {}
        }
      );

      return response.data;

    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        logger.debug('FHIR resource not found', {
          resourceType,
          resourceId: id,
          correlationId
        });
        return null;
      }

      logger.error('Failed to read FHIR resource', {
        error: this.extractErrorMessage(error),
        resourceType,
        resourceId: id,
        correlationId
      });
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Update a FHIR resource
   */
  async updateResource<T = any>(resource: any, correlationId?: string): Promise<T> {
    try {
      logger.debug('Updating FHIR resource', {
        resourceType: resource.resourceType,
        resourceId: resource.id,
        correlationId
      });

      const response = await this.httpClient.put(
        `/${resource.resourceType}/${resource.id}`,
        resource,
        {
          headers: correlationId ? { 'X-Correlation-ID': correlationId } : {}
        }
      );

      logger.info('FHIR resource updated successfully', {
        resourceType: resource.resourceType,
        resourceId: resource.id,
        statusCode: response.status,
        correlationId
      });

      return response.data;

    } catch (error) {
      logger.error('Failed to update FHIR resource', {
        error: this.extractErrorMessage(error),
        resourceType: resource.resourceType,
        resourceId: resource.id,
        correlationId
      });
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Search FHIR resources
   */
  async searchResources(
    resourceType: string,
    searchParams: Record<string, any>,
    correlationId?: string
  ): Promise<FHIRSearchResult> {
    try {
      logger.debug('Searching FHIR resources', {
        resourceType,
        searchParams,
        correlationId
      });

      const params = new URLSearchParams();
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await this.httpClient.get(
        `/${resourceType}?${params.toString()}`,
        {
          headers: correlationId ? { 'X-Correlation-ID': correlationId } : {}
        }
      );

      logger.debug('FHIR search completed', {
        resourceType,
        total: response.data.total,
        entryCount: response.data.entry?.length || 0,
        correlationId
      });

      return response.data;

    } catch (error) {
      logger.error('Failed to search FHIR resources', {
        error: this.extractErrorMessage(error),
        resourceType,
        searchParams,
        correlationId
      });
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Create a Bundle resource (for PAS submissions)
   */
  async createBundle(bundle: any, correlationId?: string): Promise<any> {
    try {
      logger.debug('Creating FHIR Bundle', {
        bundleType: bundle.type,
        entryCount: bundle.entry?.length || 0,
        correlationId
      });

      // Use transaction/batch for Bundle submissions
      const response = await this.httpClient.post(
        '/',
        bundle,
        {
          headers: correlationId ? { 'X-Correlation-ID': correlationId } : {}
        }
      );

      logger.info('FHIR Bundle created successfully', {
        bundleId: response.data.id,
        statusCode: response.status,
        correlationId
      });

      return response.data;

    } catch (error) {
      logger.error('Failed to create FHIR Bundle', {
        error: this.extractErrorMessage(error),
        bundleType: bundle.type,
        correlationId
      });
      throw this.handleFHIRError(error);
    }
  }

  /**
   * Extract error message from various error types
   */
  private extractErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      if (error.response?.data?.resourceType === 'OperationOutcome') {
        const issues = error.response.data.issue || [];
        return issues.map((issue: any) => issue.diagnostics || issue.details?.text || 'Unknown FHIR error').join('; ');
      }
      return error.response?.data?.message || error.message;
    }
    return error.message || 'Unknown error';
  }

  /**
   * Handle FHIR-specific errors
   */
  private handleFHIRError(error: any): Error {
    if (axios.isAxiosError(error)) {
      if (error.response?.data?.resourceType === 'OperationOutcome') {
        const outcome = error.response.data as FHIROperationOutcome;
        const fhirError = new Error(`FHIR Error: ${this.extractErrorMessage(error)}`);
        (fhirError as any).operationOutcome = outcome;
        (fhirError as any).status = error.response.status;
        return fhirError;
      }

      const httpError = new Error(`HTTP ${error.response?.status}: ${error.message}`);
      (httpError as any).status = error.response?.status;
      return httpError;
    }

    return error instanceof Error ? error : new Error(String(error));
  }

  /**
   * Setup HTTP interceptors for logging and error handling
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        logger.debug('FHIR HTTP Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL
        });
        return config;
      },
      (error) => {
        logger.error('FHIR HTTP Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug('FHIR HTTP Response', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        if (axios.isAxiosError(error)) {
          logger.error('FHIR HTTP Response Error', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            url: error.config?.url,
            data: error.response?.data
          });
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Convenience method aliases
   */
  async read(resourceType: string, id: string, correlationId?: string) {
    return this.readResource(resourceType, id, correlationId);
  }

  async create(resource: any, correlationId?: string) {
    return this.createResource(resource, correlationId);
  }

  async update(resource: any, correlationId?: string) {
    return this.updateResource(resource, correlationId);
  }

  async search(resourceType: string, params: Record<string, any>, correlationId?: string) {
    return this.searchResources(resourceType, params, correlationId);
  }
}

// Export singleton instance
export const fhirClient = new FHIRClient();
