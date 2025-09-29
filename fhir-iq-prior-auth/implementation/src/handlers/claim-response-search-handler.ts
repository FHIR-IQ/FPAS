import { logger } from '../utils/logger';
import { fhirClient } from '../services/fhir-client';
import { auditLogger } from '../services/audit-logger';

interface SearchParams {
  patient?: string;
  request?: string;
  outcome?: 'complete' | 'error' | 'partial';
  status?: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  created?: string;
  _count?: number;
  _offset?: number;
  _sort?: string;
}

interface SearchContext {
  user?: {
    sub: string;
    scopes: string[];
    patient?: string;
    organization?: string;
  };
  correlationId: string;
  baseUrl?: string;
}

interface SearchResult {
  resourceType: 'Bundle';
  type: 'searchset';
  total: number;
  link?: Array<{
    relation: string;
    url: string;
  }>;
  entry: Array<{
    fullUrl: string;
    resource: any;
    search?: {
      mode: 'match';
      score?: number;
    };
  }>;
}

/**
 * Handler for ClaimResponse search operations with filtering and patient scoping
 */
export class ClaimResponseSearchHandler {

  /**
   * Search ClaimResponse resources with filtering support
   */
  async search(params: SearchParams, context: SearchContext): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting ClaimResponse search', {
        searchParams: params,
        userScopes: context.user?.scopes,
        correlationId: context.correlationId
      });

      // Apply security filters based on user scopes
      const secureParams = await this.applySecurityFilters(params, context);

      // Build FHIR search query
      const searchQuery = this.buildSearchQuery(secureParams);

      // Execute search against FHIR server
      const searchResult = await fhirClient.search('ClaimResponse', searchQuery);

      // Transform result to match expected format
      const transformedResult = this.transformSearchResult(searchResult, params, context);

      // Log audit event
      await this.logSearchAudit(params, transformedResult.total, context);

      const duration = Date.now() - startTime;
      logger.info('ClaimResponse search completed', {
        total: transformedResult.total,
        duration,
        correlationId: context.correlationId
      });

      return transformedResult;

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('ClaimResponse search failed', {
        error: error.message,
        searchParams: params,
        duration,
        correlationId: context.correlationId,
        stack: error.stack
      });

      // Log failed audit event
      await this.logSearchAudit(params, 0, context, error);

      throw error;
    }
  }

  /**
   * Read ClaimResponse by ID with security validation
   */
  async readById(id: string, context: SearchContext): Promise<any | null> {
    try {
      logger.info('Reading ClaimResponse by ID', {
        resourceId: id,
        userScopes: context.user?.scopes,
        correlationId: context.correlationId
      });

      // Fetch resource from FHIR server
      const resource = await fhirClient.read('ClaimResponse', id);

      if (!resource) {
        return null;
      }

      // Validate user can access this resource
      await this.validateResourceAccess(resource, context);

      // Log audit event
      await this.logReadAudit(id, context);

      return resource;

    } catch (error) {
      logger.error('ClaimResponse read failed', {
        error: error.message,
        resourceId: id,
        correlationId: context.correlationId
      });

      // Log failed audit event
      await this.logReadAudit(id, context, error);

      throw error;
    }
  }

  /**
   * Apply security filters based on user scopes and context
   */
  private async applySecurityFilters(params: SearchParams, context: SearchContext): Promise<SearchParams> {
    const secureParams = { ...params };

    // For patient scope, restrict to patient's own resources
    if (context.user?.scopes?.includes('patient/ClaimResponse.read')) {
      if (!context.user.patient) {
        throw new Error('Patient scope requires patient context in token');
      }

      // Override or validate patient parameter
      if (params.patient && params.patient !== context.user.patient) {
        throw new Error('Cannot access data for different patient with patient scope');
      }

      secureParams.patient = context.user.patient;
    }

    // For user scope, apply organization-based filtering if configured
    if (context.user?.scopes?.includes('user/ClaimResponse.read') && context.user.organization) {
      // In a real implementation, would filter by requesting organization
      // For POC, we'll log the organization context
      logger.debug('Applying organization filter', {
        organization: context.user.organization,
        correlationId: context.correlationId
      });
    }

    return secureParams;
  }

  /**
   * Build FHIR search query from parameters
   */
  private buildSearchQuery(params: SearchParams): Record<string, any> {
    const query: Record<string, any> = {};

    // Patient filter
    if (params.patient) {
      query.patient = this.normalizeReference(params.patient);
    }

    // Request (Claim) filter
    if (params.request) {
      query.request = this.normalizeReference(params.request);
    }

    // Outcome filter
    if (params.outcome) {
      query.outcome = params.outcome;
    }

    // Status filter
    if (params.status) {
      query.status = params.status;
    }

    // Created date filter
    if (params.created) {
      query.created = this.parseCreatedDateFilter(params.created);
    }

    // Pagination
    query._count = Math.min(params._count || 20, 100);
    query._offset = params._offset || 0;

    // Sorting
    if (params._sort) {
      query._sort = this.normalizeSortParameter(params._sort);
    } else {
      query._sort = '-_lastUpdated'; // Default to newest first
    }

    return query;
  }

  /**
   * Normalize reference parameter (handle both full URLs and relative references)
   */
  private normalizeReference(reference: string): string {
    // If it's already a proper reference, return as-is
    if (reference.includes('/')) {
      return reference;
    }

    // If it's just an ID, assume it needs resource type prefix
    // This would need more sophisticated logic in real implementation
    return reference;
  }

  /**
   * Parse created date filter parameter
   */
  private parseCreatedDateFilter(created: string): string {
    // Support ISO 8601 dates and date ranges
    // For POC, return as-is (HAPI FHIR will handle parsing)
    return created;
  }

  /**
   * Normalize sort parameter for FHIR search
   */
  private normalizeSortParameter(sort: string): string {
    const sortMap: Record<string, string> = {
      'created': 'created',
      '-created': '-created',
      'patient': 'patient',
      '-patient': '-patient'
    };

    return sortMap[sort] || '-_lastUpdated';
  }

  /**
   * Transform HAPI FHIR search result to our expected format
   */
  private transformSearchResult(
    fhirResult: any,
    originalParams: SearchParams,
    context: SearchContext
  ): SearchResult {
    const result: SearchResult = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: fhirResult.total || 0,
      entry: []
    };

    // Transform entries
    if (fhirResult.entry) {
      result.entry = fhirResult.entry.map((entry: any) => ({
        fullUrl: entry.fullUrl || `ClaimResponse/${entry.resource.id}`,
        resource: this.sanitizeClaimResponse(entry.resource),
        search: {
          mode: 'match' as const
        }
      }));
    }

    // Add pagination links
    if (context.baseUrl) {
      result.link = this.buildPaginationLinks(originalParams, result.total, context.baseUrl);
    }

    return result;
  }

  /**
   * Sanitize ClaimResponse resource (remove sensitive data based on scopes)
   */
  private sanitizeClaimResponse(resource: any): any {
    // For POC, return full resource
    // In production, would filter based on user scopes
    return resource;
  }

  /**
   * Build pagination links for search results
   */
  private buildPaginationLinks(
    params: SearchParams,
    total: number,
    baseUrl: string
  ): Array<{ relation: string; url: string }> {
    const links: Array<{ relation: string; url: string }> = [];
    const count = params._count || 20;
    const offset = params._offset || 0;

    // Self link
    links.push({
      relation: 'self',
      url: this.buildSearchUrl(baseUrl, params)
    });

    // First link
    if (offset > 0) {
      links.push({
        relation: 'first',
        url: this.buildSearchUrl(baseUrl, { ...params, _offset: 0 })
      });
    }

    // Previous link
    if (offset > 0) {
      const prevOffset = Math.max(0, offset - count);
      links.push({
        relation: 'previous',
        url: this.buildSearchUrl(baseUrl, { ...params, _offset: prevOffset })
      });
    }

    // Next link
    if (offset + count < total) {
      links.push({
        relation: 'next',
        url: this.buildSearchUrl(baseUrl, { ...params, _offset: offset + count })
      });
    }

    // Last link
    if (offset + count < total) {
      const lastOffset = Math.floor((total - 1) / count) * count;
      links.push({
        relation: 'last',
        url: this.buildSearchUrl(baseUrl, { ...params, _offset: lastOffset })
      });
    }

    return links;
  }

  /**
   * Build search URL with parameters
   */
  private buildSearchUrl(baseUrl: string, params: SearchParams): string {
    const url = new URL(baseUrl);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value.toString());
      }
    });

    return url.toString();
  }

  /**
   * Validate user can access specific ClaimResponse resource
   */
  private async validateResourceAccess(resource: any, context: SearchContext): Promise<void> {
    // For patient scope, validate patient reference matches token
    if (context.user?.scopes?.includes('patient/ClaimResponse.read')) {
      const resourcePatient = resource.patient?.reference;
      if (!resourcePatient || !resourcePatient.includes(context.user.patient!)) {
        throw new Error('Access denied: resource does not belong to authenticated patient');
      }
    }

    // For user scope, validate organization context if available
    if (context.user?.scopes?.includes('user/ClaimResponse.read') && context.user.organization) {
      // In real implementation, would check if user's organization can access this resource
      logger.debug('Validating organization access', {
        organization: context.user.organization,
        resourceId: resource.id,
        correlationId: context.correlationId
      });
    }
  }

  /**
   * Log search audit event
   */
  private async logSearchAudit(
    params: SearchParams,
    resultCount: number,
    context: SearchContext,
    error?: Error
  ): Promise<void> {
    try {
      await auditLogger.logEvent({
        eventType: 'CLAIMRESPONSE_SEARCH',
        timestamp: new Date().toISOString(),
        userId: context.user?.sub,
        searchParams: params,
        resultCount,
        correlationId: context.correlationId,
        result: error ? 'failed' : 'success',
        error: error?.message
      });
    } catch (auditError) {
      logger.error('Failed to log search audit event', {
        error: auditError.message,
        correlationId: context.correlationId
      });
    }
  }

  /**
   * Log read audit event
   */
  private async logReadAudit(
    resourceId: string,
    context: SearchContext,
    error?: Error
  ): Promise<void> {
    try {
      await auditLogger.logEvent({
        eventType: 'CLAIMRESPONSE_READ',
        timestamp: new Date().toISOString(),
        userId: context.user?.sub,
        resourceId,
        correlationId: context.correlationId,
        result: error ? 'failed' : 'success',
        error: error?.message
      });
    } catch (auditError) {
      logger.error('Failed to log read audit event', {
        error: auditError.message,
        correlationId: context.correlationId
      });
    }
  }
}

// Export singleton instance
export const claimResponseSearchHandler = new ClaimResponseSearchHandler();