/**
 * Coverage Requirements Discovery (CRD) Service
 *
 * Implements HL7 Da Vinci CRD Implementation Guide for triggering
 * DTR questionnaires when providers place orders requiring prior authorization.
 *
 * Supports CDS Hooks specification v1.0 for order-select and order-sign events.
 */

import { FastifyInstance } from 'fastify';
import { Bundle, ServiceRequest, MedicationRequest, DeviceRequest, QuestionnaireResponse } from 'fhir/r4';
import { logger } from '../utils/logger';
import { DTRService } from '../services/dtr-prepopulation.service';

export interface CRDHookRequest {
  hook: string;
  hookInstance: string;
  fhirServer: string;
  fhirAuthorization?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    subject: string;
  };
  context: {
    userId: string;
    patientId?: string;
    encounterId?: string;
    selections?: string[];
    draftOrders?: Bundle;
  };
  prefetch?: Record<string, any>;
}

export interface CRDCard {
  uuid: string;
  summary: string;
  indicator: 'info' | 'warning' | 'critical';
  detail?: string;
  source: {
    label: string;
    url?: string;
    icon?: string;
  };
  suggestions?: CRDSuggestion[];
  links?: CRDLink[];
}

export interface CRDSuggestion {
  label: string;
  uuid: string;
  actions?: CRDAction[];
}

export interface CRDAction {
  type: 'create' | 'update' | 'delete';
  description: string;
  resource?: any;
}

export interface CRDLink {
  label: string;
  url: string;
  type: 'absolute' | 'smart';
  appContext?: string;
}

export interface CRDResponse {
  cards: CRDCard[];
  systemActions?: CRDAction[];
}

/**
 * Coverage Requirements Discovery Service
 * Implements CDS Hooks for prior authorization workflow
 */
export class CRDDiscoveryService {
  private dtrService: DTRService;

  // Services that commonly require prior authorization
  private readonly PA_REQUIRED_CODES = new Set([
    // MRI/Advanced Imaging
    '70551', '70552', '70553', // Brain MRI
    '72148', '72149', '72158', // Lumbar spine MRI
    '73721', '73722', '73723', // Lower extremity MRI

    // Surgical Procedures
    '63030', '63047', '63056', // Lumbar decompression
    '27447', '27130', '27236', // Joint replacement

    // DME/Equipment
    'E0143', 'E0144', 'E0147', // Walker equipment
    'E0950', 'E0951', 'E0952', // Wheelchair equipment
    'E1390', 'E1391', 'E1392', // Oxygen equipment

    // High-cost medications
    'J1745', 'J3262', 'J9035'  // Specialty drugs
  ]);

  constructor(dtrService: DTRService) {
    this.dtrService = dtrService;
  }

  /**
   * Register CRD hook endpoints with Fastify server
   */
  async registerHooks(server: FastifyInstance): Promise<void> {
    // CDS Hooks discovery endpoint
    server.get('/cds-services', async (request, reply) => {
      return this.getDiscoveryResponse();
    });

    // Order-select hook (when provider selects order from CPOE)
    server.post('/cds-services/pa-order-select', async (request, reply) => {
      const hookRequest = request.body as CRDHookRequest;
      return await this.handleOrderSelectHook(hookRequest);
    });

    // Order-sign hook (when provider signs/commits order)
    server.post('/cds-services/pa-order-sign', async (request, reply) => {
      const hookRequest = request.body as CRDHookRequest;
      return await this.handleOrderSignHook(hookRequest);
    });

    logger.info('CRD hooks registered successfully');
  }

  /**
   * CDS Hooks discovery response
   */
  private getDiscoveryResponse() {
    return {
      services: [
        {
          hook: 'order-select',
          title: 'Prior Authorization Order Select',
          description: 'Checks if selected orders require prior authorization and provides DTR links',
          id: 'pa-order-select',
          prefetch: {
            patient: 'Patient/{{context.patientId}}',
            encounter: 'Encounter/{{context.encounterId}}',
            practitioner: 'Practitioner/{{context.userId}}'
          }
        },
        {
          hook: 'order-sign',
          title: 'Prior Authorization Order Sign',
          description: 'Final check for PA requirements and DTR completion before order submission',
          id: 'pa-order-sign',
          prefetch: {
            patient: 'Patient/{{context.patientId}}',
            encounter: 'Encounter/{{context.encounterId}}',
            practitioner: 'Practitioner/{{context.userId}}',
            coverage: 'Coverage?patient={{context.patientId}}&status=active'
          }
        }
      ]
    };
  }

  /**
   * Handle order-select hook - inform about PA requirements
   */
  private async handleOrderSelectHook(request: CRDHookRequest): Promise<CRDResponse> {
    try {
      logger.info('Processing order-select hook', {
        hookInstance: request.hookInstance,
        patientId: request.context.patientId,
        userId: request.context.userId
      });

      const cards: CRDCard[] = [];
      const draftOrders = request.context.draftOrders;

      if (!draftOrders?.entry) {
        return { cards };
      }

      // Check each order for PA requirements
      for (const entry of draftOrders.entry) {
        const resource = entry.resource;

        if (this.requiresPriorAuthorization(resource)) {
          const paCard = await this.createPARequiredCard(resource, request);
          if (paCard) {
            cards.push(paCard);
          }
        }
      }

      logger.debug('Order-select hook completed', {
        cardsGenerated: cards.length,
        hookInstance: request.hookInstance
      });

      return { cards };

    } catch (error) {
      logger.error('Order-select hook failed', {
        error: error.message,
        hookInstance: request.hookInstance
      });

      return {
        cards: [{
          uuid: this.generateUUID(),
          summary: 'Error checking prior authorization requirements',
          indicator: 'warning',
          detail: 'Unable to determine if orders require prior authorization. Please check manually.',
          source: {
            label: 'FHIR IQ PAS System'
          }
        }]
      };
    }
  }

  /**
   * Handle order-sign hook - final PA check and DTR completion
   */
  private async handleOrderSignHook(request: CRDHookRequest): Promise<CRDResponse> {
    try {
      logger.info('Processing order-sign hook', {
        hookInstance: request.hookInstance,
        patientId: request.context.patientId
      });

      const cards: CRDCard[] = [];
      const systemActions: CRDAction[] = [];
      const draftOrders = request.context.draftOrders;

      if (!draftOrders?.entry) {
        return { cards, systemActions };
      }

      // Check for PA requirements and DTR completion
      for (const entry of draftOrders.entry) {
        const resource = entry.resource;

        if (this.requiresPriorAuthorization(resource)) {
          // Check if DTR has been completed for this order
          const dtrCompleted = await this.checkDTRCompletion(resource, request);

          if (!dtrCompleted) {
            // Block order submission and require DTR completion
            const blockingCard = await this.createDTRRequiredCard(resource, request);
            if (blockingCard) {
              cards.push(blockingCard);
            }
          } else {
            // DTR completed - add informational card
            const infoCard = this.createDTRCompletedCard(resource);
            cards.push(infoCard);
          }
        }
      }

      return { cards, systemActions };

    } catch (error) {
      logger.error('Order-sign hook failed', {
        error: error.message,
        hookInstance: request.hookInstance
      });

      return {
        cards: [{
          uuid: this.generateUUID(),
          summary: 'Error validating prior authorization requirements',
          indicator: 'critical',
          detail: 'Cannot verify PA/DTR status. Order submission may be blocked.',
          source: {
            label: 'FHIR IQ PAS System'
          }
        }]
      };
    }
  }

  /**
   * Check if a resource requires prior authorization
   */
  private requiresPriorAuthorization(resource: any): boolean {
    if (!resource) return false;

    // Check ServiceRequest
    if (resource.resourceType === 'ServiceRequest') {
      const serviceRequest = resource as ServiceRequest;
      const code = serviceRequest.code?.coding?.[0]?.code;
      return code ? this.PA_REQUIRED_CODES.has(code) : false;
    }

    // Check MedicationRequest
    if (resource.resourceType === 'MedicationRequest') {
      const medicationRequest = resource as MedicationRequest;
      const code = medicationRequest.medicationCodeableConcept?.coding?.[0]?.code;
      return code ? this.PA_REQUIRED_CODES.has(code) : false;
    }

    // Check DeviceRequest
    if (resource.resourceType === 'DeviceRequest') {
      const deviceRequest = resource as DeviceRequest;
      const code = deviceRequest.codeCodeableConcept?.coding?.[0]?.code;
      return code ? this.PA_REQUIRED_CODES.has(code) : false;
    }

    return false;
  }

  /**
   * Create card for orders requiring prior authorization
   */
  private async createPARequiredCard(resource: any, request: CRDHookRequest): Promise<CRDCard | null> {
    const orderCode = this.extractOrderCode(resource);
    const orderDisplay = this.extractOrderDisplay(resource);

    const dtrUrl = await this.generateDTRLaunchUrl(resource, request);

    return {
      uuid: this.generateUUID(),
      summary: `Prior Authorization Required: ${orderDisplay}`,
      indicator: 'warning',
      detail: `The selected order (${orderCode}) requires prior authorization. Complete the DTR questionnaire to expedite the approval process.`,
      source: {
        label: 'FHIR IQ PAS System',
        url: 'https://fhir-iq-pas.example.com'
      },
      links: [
        {
          label: 'Complete DTR Questionnaire',
          url: dtrUrl,
          type: 'smart',
          appContext: JSON.stringify({
            orderId: resource.id,
            patientId: request.context.patientId,
            orderCode: orderCode
          })
        },
        {
          label: 'View PA Requirements',
          url: `https://fhir-iq-pas.example.com/requirements/${orderCode}`,
          type: 'absolute'
        }
      ]
    };
  }

  /**
   * Create blocking card for orders missing DTR completion
   */
  private async createDTRRequiredCard(resource: any, request: CRDHookRequest): Promise<CRDCard | null> {
    const orderDisplay = this.extractOrderDisplay(resource);
    const dtrUrl = await this.generateDTRLaunchUrl(resource, request);

    return {
      uuid: this.generateUUID(),
      summary: `DTR Completion Required: ${orderDisplay}`,
      indicator: 'critical',
      detail: 'This order requires prior authorization with DTR questionnaire completion before it can be submitted. Please complete the DTR process first.',
      source: {
        label: 'FHIR IQ PAS System'
      },
      links: [
        {
          label: 'Complete Required DTR',
          url: dtrUrl,
          type: 'smart',
          appContext: JSON.stringify({
            orderId: resource.id,
            patientId: request.context.patientId,
            required: true
          })
        }
      ]
    };
  }

  /**
   * Create informational card for completed DTR
   */
  private createDTRCompletedCard(resource: any): CRDCard {
    const orderDisplay = this.extractOrderDisplay(resource);

    return {
      uuid: this.generateUUID(),
      summary: `DTR Completed: ${orderDisplay}`,
      indicator: 'info',
      detail: 'Prior authorization questionnaire has been completed for this order. PA request will be automatically submitted.',
      source: {
        label: 'FHIR IQ PAS System'
      }
    };
  }

  /**
   * Check if DTR has been completed for an order
   */
  private async checkDTRCompletion(resource: any, request: CRDHookRequest): Promise<boolean> {
    try {
      // In a real implementation, this would query the FHIR server for
      // QuestionnaireResponse resources related to this order

      // For POC, simulate DTR completion check based on order properties
      const orderId = resource.id;
      const patientId = request.context.patientId;

      if (!orderId || !patientId) {
        return false;
      }

      // Mock logic: assume DTR is completed for orders with certain patterns
      // In real implementation, query: QuestionnaireResponse?subject=Patient/{patientId}&item.answer.value.reference={orderId}

      logger.debug('Checking DTR completion status', {
        orderId,
        patientId,
        resourceType: resource.resourceType
      });

      // For demo purposes, return false to trigger DTR requirement
      return false;

    } catch (error) {
      logger.error('Failed to check DTR completion', {
        error: error.message,
        orderId: resource.id
      });
      return false;
    }
  }

  /**
   * Generate SMART launch URL for DTR application
   */
  private async generateDTRLaunchUrl(resource: any, request: CRDHookRequest): Promise<string> {
    const baseUrl = process.env.DTR_LAUNCH_URL || 'https://fhir-iq-pas.example.com/dtr-launch';
    const orderCode = this.extractOrderCode(resource);

    const params = new URLSearchParams({
      iss: request.fhirServer,
      launch: this.generateLaunchToken(),
      patient: request.context.patientId || '',
      order: resource.id || '',
      code: orderCode || ''
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Extract procedure/medication/device code from order
   */
  private extractOrderCode(resource: any): string {
    if (resource.resourceType === 'ServiceRequest') {
      return resource.code?.coding?.[0]?.code || '';
    }
    if (resource.resourceType === 'MedicationRequest') {
      return resource.medicationCodeableConcept?.coding?.[0]?.code || '';
    }
    if (resource.resourceType === 'DeviceRequest') {
      return resource.codeCodeableConcept?.coding?.[0]?.code || '';
    }
    return '';
  }

  /**
   * Extract display name from order
   */
  private extractOrderDisplay(resource: any): string {
    if (resource.resourceType === 'ServiceRequest') {
      return resource.code?.coding?.[0]?.display || 'Service Request';
    }
    if (resource.resourceType === 'MedicationRequest') {
      return resource.medicationCodeableConcept?.coding?.[0]?.display || 'Medication Request';
    }
    if (resource.resourceType === 'DeviceRequest') {
      return resource.codeCodeableConcept?.coding?.[0]?.display || 'Device Request';
    }
    return 'Unknown Order';
  }

  /**
   * Generate UUID for cards
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Generate launch token for SMART app launch
   */
  private generateLaunchToken(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get service configuration for testing
   */
  getServiceInfo() {
    return {
      name: 'CRD Discovery Service',
      version: '1.0.0',
      supportedHooks: ['order-select', 'order-sign'],
      paRequiredCodes: Array.from(this.PA_REQUIRED_CODES)
    };
  }
}