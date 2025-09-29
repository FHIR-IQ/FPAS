/**
 * Vendor Adapter Registry
 *
 * Manages multiple vendor adapters and provides a central registry
 * for discovering and accessing configured vendor integrations.
 */

import { logger } from '../utils/logger';
import {
  VendorAdapterInterface,
  VendorAdapterFactory,
  VendorAdapterRegistry,
  VendorAdapterConfig,
  VendorInfo,
  VendorAdapterError
} from './vendor-adapter.interface';
import { MockVendorAdapter } from './mock-vendor.adapter';

export class VendorAdapterRegistryImpl implements VendorAdapterRegistry, VendorAdapterFactory {
  private adapters: Map<string, VendorAdapterInterface> = new Map();
  private adapterConfigs: Map<string, VendorAdapterConfig> = new Map();
  private vendorInfo: Map<string, VendorInfo> = new Map();

  constructor() {
    this.initializeBuiltInVendors();
  }

  /**
   * Register a vendor adapter
   */
  registerAdapter(vendorId: string, adapter: VendorAdapterInterface): void {
    logger.info('Registering vendor adapter', { vendorId });

    if (this.adapters.has(vendorId)) {
      logger.warn('Overwriting existing vendor adapter', { vendorId });
    }

    this.adapters.set(vendorId, adapter);

    logger.debug('Vendor adapter registered successfully', {
      vendorId,
      totalAdapters: this.adapters.size
    });
  }

  /**
   * Get a registered vendor adapter
   */
  getAdapter(vendorId: string): VendorAdapterInterface | undefined {
    const adapter = this.adapters.get(vendorId);

    if (!adapter) {
      logger.warn('Vendor adapter not found', { vendorId });
      return undefined;
    }

    return adapter;
  }

  /**
   * List all registered adapters
   */
  listAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Remove a vendor adapter
   */
  removeAdapter(vendorId: string): boolean {
    const removed = this.adapters.delete(vendorId);
    this.adapterConfigs.delete(vendorId);

    if (removed) {
      logger.info('Vendor adapter removed', { vendorId });
    } else {
      logger.warn('Attempted to remove non-existent vendor adapter', { vendorId });
    }

    return removed;
  }

  /**
   * Create a new vendor adapter instance
   */
  createAdapter(vendorId: string, config: VendorAdapterConfig): VendorAdapterInterface {
    logger.info('Creating vendor adapter', { vendorId, vendorName: config.vendorName });

    // Store configuration for reference
    this.adapterConfigs.set(vendorId, config);

    // Create adapter based on vendor type
    let adapter: VendorAdapterInterface;

    switch (vendorId.toLowerCase()) {
      case 'mock':
      case 'mock-vendor':
        adapter = new MockVendorAdapter();
        break;

      case 'change-healthcare':
        // adapter = new ChangeHealthcareAdapter();
        throw new VendorAdapterError('Change Healthcare adapter not implemented', vendorId, 'NOT_IMPLEMENTED');

      case 'covermy-meds':
        // adapter = new CoverMyMedsAdapter();
        throw new VendorAdapterError('CoverMyMeds adapter not implemented', vendorId, 'NOT_IMPLEMENTED');

      case 'waystar':
        // adapter = new WaystarAdapter();
        throw new VendorAdapterError('Waystar adapter not implemented', vendorId, 'NOT_IMPLEMENTED');

      case 'appriss-health':
        // adapter = new ApprissHealthAdapter();
        throw new VendorAdapterError('Appriss Health adapter not implemented', vendorId, 'NOT_IMPLEMENTED');

      default:
        throw new VendorAdapterError(`Unknown vendor adapter: ${vendorId}`, vendorId, 'UNKNOWN_VENDOR');
    }

    // Initialize the adapter
    adapter.initialize(config).catch(error => {
      logger.error('Vendor adapter initialization failed', {
        vendorId,
        error: error.message
      });
    });

    // Register the adapter
    this.registerAdapter(vendorId, adapter);

    return adapter;
  }

  /**
   * Get supported vendor IDs
   */
  getSupportedVendors(): string[] {
    return [
      'mock',
      'change-healthcare',
      'covermy-meds',
      'waystar',
      'appriss-health'
    ];
  }

  /**
   * Get vendor information
   */
  getVendorInfo(vendorId: string): VendorInfo {
    const info = this.vendorInfo.get(vendorId);

    if (!info) {
      throw new VendorAdapterError(`Vendor info not found: ${vendorId}`, vendorId, 'VENDOR_NOT_FOUND');
    }

    return info;
  }

  /**
   * Get active adapter by priority
   * Returns the first healthy adapter from the priority list
   */
  async getActiveAdapter(priorityList?: string[]): Promise<VendorAdapterInterface> {
    const vendorsToCheck = priorityList || this.listAdapters();

    for (const vendorId of vendorsToCheck) {
      const adapter = this.getAdapter(vendorId);

      if (!adapter) {
        continue;
      }

      try {
        const health = await adapter.healthCheck();
        if (health.status === 'healthy') {
          logger.debug('Selected active vendor adapter', {
            vendorId,
            responseTime: health.responseTime
          });
          return adapter;
        }
      } catch (error) {
        logger.warn('Vendor adapter health check failed', {
          vendorId,
          error: error.message
        });
      }
    }

    throw new VendorAdapterError('No healthy vendor adapters available', 'none', 'NO_HEALTHY_ADAPTERS');
  }

  /**
   * Get adapter configuration
   */
  getAdapterConfig(vendorId: string): VendorAdapterConfig | undefined {
    return this.adapterConfigs.get(vendorId);
  }

  /**
   * Health check all adapters
   */
  async healthCheckAll(): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    const healthChecks = this.listAdapters().map(async vendorId => {
      const adapter = this.getAdapter(vendorId);
      if (!adapter) {
        return { vendorId, error: 'Adapter not found' };
      }

      try {
        const health = await adapter.healthCheck();
        return { vendorId, ...health };
      } catch (error) {
        return {
          vendorId,
          status: 'unhealthy',
          error: error.message,
          lastChecked: new Date()
        };
      }
    });

    const healthResults = await Promise.all(healthChecks);

    healthResults.forEach(result => {
      results[result.vendorId] = result;
    });

    return results;
  }

  /**
   * Load adapters from configuration
   */
  async loadAdaptersFromConfig(configs: VendorAdapterConfig[]): Promise<void> {
    logger.info('Loading vendor adapters from configuration', {
      adapterCount: configs.length
    });

    const loadPromises = configs.map(async config => {
      try {
        this.createAdapter(config.vendorId, config);
        logger.info('Vendor adapter loaded successfully', {
          vendorId: config.vendorId,
          vendorName: config.vendorName
        });
      } catch (error) {
        logger.error('Failed to load vendor adapter', {
          vendorId: config.vendorId,
          error: error.message
        });
      }
    });

    await Promise.all(loadPromises);

    logger.info('Vendor adapter loading completed', {
      totalLoaded: this.adapters.size,
      loadedAdapters: this.listAdapters()
    });
  }

  /**
   * Get registry statistics
   */
  getRegistryStats(): {
    totalAdapters: number;
    activeAdapters: string[];
    supportedVendors: string[];
    configurations: Record<string, any>;
  } {
    return {
      totalAdapters: this.adapters.size,
      activeAdapters: this.listAdapters(),
      supportedVendors: this.getSupportedVendors(),
      configurations: Object.fromEntries(
        Array.from(this.adapterConfigs.entries()).map(([vendorId, config]) => [
          vendorId,
          {
            vendorName: config.vendorName,
            features: config.features,
            endpoint: config.apiEndpoint
          }
        ])
      )
    };
  }

  /**
   * Initialize built-in vendor information
   */
  private initializeBuiltInVendors(): void {
    // Mock Vendor
    this.vendorInfo.set('mock', {
      id: 'mock',
      name: 'Mock Vendor Adapter',
      description: 'Simulated vendor adapter for testing and demonstration',
      version: '1.0.0',
      features: {
        supportsRealTimeDecisions: true,
        supportsAsyncDecisions: true,
        supportsBulkSubmissions: false,
        supportsStatusInquiry: true,
        supportsDocumentUpload: false,
        supportsWebhooks: false,
        maxConcurrentRequests: 10,
        supportedResourceTypes: ['Claim', 'Patient', 'Practitioner', 'Organization']
      },
      configurationSchema: {
        type: 'object',
        properties: {
          vendorId: { type: 'string' },
          vendorName: { type: 'string' },
          apiEndpoint: { type: 'string' }
        },
        required: ['vendorId', 'vendorName']
      }
    });

    // Change Healthcare
    this.vendorInfo.set('change-healthcare', {
      id: 'change-healthcare',
      name: 'Change Healthcare',
      description: 'Change Healthcare prior authorization integration',
      version: '1.0.0',
      features: {
        supportsRealTimeDecisions: true,
        supportsAsyncDecisions: true,
        supportsBulkSubmissions: true,
        supportsStatusInquiry: true,
        supportsDocumentUpload: true,
        supportsWebhooks: true,
        maxConcurrentRequests: 50,
        supportedResourceTypes: ['Claim', 'Patient', 'Practitioner', 'Organization', 'Coverage']
      },
      configurationSchema: {
        type: 'object',
        properties: {
          vendorId: { type: 'string' },
          vendorName: { type: 'string' },
          apiEndpoint: { type: 'string', format: 'uri' },
          authentication: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['oauth2'] },
              clientId: { type: 'string' },
              clientSecret: { type: 'string' },
              tokenEndpoint: { type: 'string', format: 'uri' }
            },
            required: ['type', 'clientId', 'clientSecret', 'tokenEndpoint']
          }
        },
        required: ['vendorId', 'vendorName', 'apiEndpoint', 'authentication']
      }
    });

    // Add other vendor info as needed...
  }
}

// Export singleton instance
export const vendorAdapterRegistry = new VendorAdapterRegistryImpl();