/**
 * FHIR to X12 278 Transformation Mapper
 *
 * Transforms FHIR R4 PAS resources to X12 EDI 278 format.
 * Implements field mappings defined in pas-to-x12-278-map.md
 */

import { Bundle, Claim, ClaimResponse, Patient, Practitioner, Organization } from 'fhir/r4';
import { X12MapperConfig, X12Transaction } from './index';
import { SegmentBuilder } from './utils/segment-builder';
import { DateFormatter } from './utils/date-formatter';
import { CodeMapper } from './utils/code-mapper';
import { logger } from '../../utils/logger';

export class FHIRToX12Mapper {
  private segmentBuilder: SegmentBuilder;
  private dateFormatter: DateFormatter;
  private codeMapper: CodeMapper;
  private config: X12MapperConfig;

  constructor(config: X12MapperConfig) {
    this.config = config;
    this.segmentBuilder = new SegmentBuilder(config);
    this.dateFormatter = new DateFormatter();
    this.codeMapper = new CodeMapper();
  }

  /**
   * Transform FHIR Bundle to X12 278 Transaction
   */
  async transform(bundle: Bundle): Promise<X12Transaction> {
    const controlNumber = this.generateControlNumber();
    const segments: string[] = [];

    try {
      // Extract resources from bundle
      const claim = this.extractResource<Claim>(bundle, 'Claim');
      const patient = this.extractResource<Patient>(bundle, 'Patient');
      const practitioner = this.extractResource<Practitioner>(bundle, 'Practitioner');
      const organization = this.extractResource<Organization>(bundle, 'Organization');

      if (!claim || !patient) {
        throw new Error('Bundle must contain Claim and Patient resources');
      }

      // Build X12 transaction structure
      segments.push(this.buildTransactionHeader(controlNumber));
      segments.push(this.buildBeginningHierarchicalTransaction(bundle, claim));

      // Hierarchical levels
      segments.push(...this.buildSubmitterHierarchy());
      segments.push(...this.buildReceiverHierarchy());
      segments.push(...this.buildProviderHierarchy(practitioner, organization));
      segments.push(...this.buildPatientHierarchy(patient));
      segments.push(...this.buildServiceHierarchy(claim));

      segments.push(this.buildTransactionTrailer(segments.length + 1, controlNumber));

      const transaction: X12Transaction = {
        transactionSetId: '278',
        controlNumber,
        segments,
        rawEdi: segments.join('~\n') + '~\n'
      };

      logger.debug('FHIR to X12 transformation completed', {
        bundleId: bundle.id,
        segmentCount: segments.length,
        controlNumber
      });

      return transaction;

    } catch (error) {
      logger.error('FHIR to X12 transformation failed', {
        error: error.message,
        bundleId: bundle.id
      });
      throw error;
    }
  }

  /**
   * Transform FHIR ClaimResponse to X12 278 Response
   */
  async transformResponse(claimResponse: ClaimResponse): Promise<X12Transaction> {
    const controlNumber = this.generateControlNumber();
    const segments: string[] = [];

    try {
      segments.push(this.buildTransactionHeader(controlNumber));
      segments.push(this.buildResponseBHT(claimResponse));
      segments.push(...this.buildResponseHierarchy(claimResponse));
      segments.push(this.buildTransactionTrailer(segments.length + 1, controlNumber));

      const transaction: X12Transaction = {
        transactionSetId: '278',
        controlNumber,
        segments,
        rawEdi: segments.join('~\n') + '~\n'
      };

      return transaction;

    } catch (error) {
      logger.error('ClaimResponse to X12 transformation failed', {
        error: error.message,
        claimResponseId: claimResponse.id
      });
      throw error;
    }
  }

  /**
   * Build ST (Transaction Set Header) segment
   */
  private buildTransactionHeader(controlNumber: string): string {
    return this.segmentBuilder.buildSegment('ST', [
      '278',           // Transaction Set Identifier Code
      controlNumber    // Transaction Set Control Number
    ]);
  }

  /**
   * Build BHT (Beginning of Hierarchical Transaction) segment
   */
  private buildBeginningHierarchicalTransaction(bundle: Bundle, claim: Claim): string {
    const hierarchicalStructure = '0007'; // Prior Authorization Request
    const transactionSetPurpose = '00';    // Original
    const referenceId = claim.identifier?.[0]?.value || bundle.identifier?.value || controlNumber;
    const date = this.dateFormatter.toX12Date(bundle.timestamp || new Date().toISOString());
    const time = this.dateFormatter.toX12Time(bundle.timestamp || new Date().toISOString());

    return this.segmentBuilder.buildSegment('BHT', [
      hierarchicalStructure,
      transactionSetPurpose,
      referenceId,
      date,
      time
    ]);
  }

  /**
   * Build response BHT for ClaimResponse
   */
  private buildResponseBHT(claimResponse: ClaimResponse): string {
    const hierarchicalStructure = '0011'; // Response
    const transactionSetPurpose = '00';    // Original
    const referenceId = claimResponse.identifier?.[0]?.value || claimResponse.id;
    const date = this.dateFormatter.toX12Date(claimResponse.created || new Date().toISOString());
    const time = this.dateFormatter.toX12Time(claimResponse.created || new Date().toISOString());

    return this.segmentBuilder.buildSegment('BHT', [
      hierarchicalStructure,
      transactionSetPurpose,
      referenceId,
      date,
      time
    ]);
  }

  /**
   * Build submitter hierarchy (HL*1**20*1)
   */
  private buildSubmitterHierarchy(): string[] {
    const segments: string[] = [];

    // HL segment - Submitter level
    segments.push(this.segmentBuilder.buildSegment('HL', [
      '1',    // Hierarchical ID Number
      '',     // Hierarchical Parent ID Number (empty for top level)
      '20',   // Hierarchical Level Code (Information Source)
      '1'     // Hierarchical Child Code (has child)
    ]));

    // NM1 segment - Submitter name
    segments.push(this.segmentBuilder.buildSegment('NM1', [
      '41',                           // Entity Identifier Code (Submitter)
      '2',                           // Entity Type Qualifier (Non-Person Entity)
      'FHIR IQ PAS System',          // Name Last or Organization Name
      '',                            // Name First
      '',                            // Name Middle
      '',                            // Name Prefix
      '',                            // Name Suffix
      'XX',                          // Identification Code Qualifier (NPI)
      this.config.submitterNPI       // Identification Code
    ]));

    return segments;
  }

  /**
   * Build receiver hierarchy (HL*2*1*21*1)
   */
  private buildReceiverHierarchy(): string[] {
    const segments: string[] = [];

    segments.push(this.segmentBuilder.buildSegment('HL', [
      '2',    // Hierarchical ID Number
      '1',    // Hierarchical Parent ID Number (Submitter)
      '21',   // Hierarchical Level Code (Information Receiver)
      '1'     // Hierarchical Child Code (has child)
    ]));

    segments.push(this.segmentBuilder.buildSegment('NM1', [
      '40',                    // Entity Identifier Code (Receiver)
      '2',                     // Entity Type Qualifier (Non-Person Entity)
      'Target Payer System',   // Name Last or Organization Name
      '',                      // Name First
      '',                      // Name Middle
      '',                      // Name Prefix
      '',                      // Name Suffix
      'XX',                    // Identification Code Qualifier (NPI)
      this.config.receiverId   // Identification Code
    ]));

    return segments;
  }

  /**
   * Build provider hierarchy (HL*3*2*22*1)
   */
  private buildProviderHierarchy(practitioner?: Practitioner, organization?: Organization): string[] {
    const segments: string[] = [];

    segments.push(this.segmentBuilder.buildSegment('HL', [
      '3',    // Hierarchical ID Number
      '2',    // Hierarchical Parent ID Number (Receiver)
      '22',   // Hierarchical Level Code (Information Source)
      '1'     // Hierarchical Child Code (has child)
    ]));

    if (practitioner) {
      const npi = this.extractNPI(practitioner.identifier || []);
      const name = practitioner.name?.[0];

      segments.push(this.segmentBuilder.buildSegment('NM1', [
        '1P',                        // Entity Identifier Code (Provider)
        '1',                         // Entity Type Qualifier (Person)
        name?.family || '',          // Name Last
        name?.given?.[0] || '',      // Name First
        name?.given?.[1] || '',      // Name Middle
        name?.prefix?.[0] || '',     // Name Prefix
        name?.suffix?.[0] || '',     // Name Suffix
        'XX',                        // Identification Code Qualifier (NPI)
        npi || ''                    // Identification Code
      ]));
    } else if (organization) {
      const npi = this.extractNPI(organization.identifier || []);

      segments.push(this.segmentBuilder.buildSegment('NM1', [
        '1P',                        // Entity Identifier Code (Provider)
        '2',                         // Entity Type Qualifier (Non-Person Entity)
        organization.name || '',     // Name Last or Organization Name
        '',                          // Name First
        '',                          // Name Middle
        '',                          // Name Prefix
        '',                          // Name Suffix
        'XX',                        // Identification Code Qualifier (NPI)
        npi || ''                    // Identification Code
      ]));
    }

    return segments;
  }

  /**
   * Build patient hierarchy (HL*4*3*23*0)
   */
  private buildPatientHierarchy(patient: Patient): string[] {
    const segments: string[] = [];

    segments.push(this.segmentBuilder.buildSegment('HL', [
      '4',    // Hierarchical ID Number
      '3',    // Hierarchical Parent ID Number (Provider)
      '23',   // Hierarchical Level Code (Patient)
      '0'     // Hierarchical Child Code (no child)
    ]));

    const memberId = this.extractMemberId(patient.identifier || []);
    const name = patient.name?.[0];

    segments.push(this.segmentBuilder.buildSegment('NM1', [
      'QC',                        // Entity Identifier Code (Patient)
      '1',                         // Entity Type Qualifier (Person)
      name?.family || '',          // Name Last
      name?.given?.[0] || '',      // Name First
      name?.given?.[1] || '',      // Name Middle
      name?.prefix?.[0] || '',     // Name Prefix
      name?.suffix?.[0] || '',     // Name Suffix
      'MI',                        // Identification Code Qualifier (Member ID)
      memberId || ''               // Identification Code
    ]));

    // DMG segment - Patient demographics
    if (patient.birthDate || patient.gender) {
      const birthDate = patient.birthDate
        ? this.dateFormatter.toX12Date(patient.birthDate + 'T00:00:00Z')
        : '';

      const gender = this.codeMapper.mapGender(patient.gender || '');

      segments.push(this.segmentBuilder.buildSegment('DMG', [
        'D8',        // Date Time Period Format Qualifier
        birthDate,   // Date Time Period
        gender       // Gender Code
      ]));
    }

    return segments;
  }

  /**
   * Build service hierarchy and UM segments
   */
  private buildServiceHierarchy(claim: Claim): string[] {
    const segments: string[] = [];

    if (claim.item) {
      claim.item.forEach((item, index) => {
        // UM segment - Health Care Services Review Information
        const serviceTypeCode = this.codeMapper.mapServiceType(
          item.productOrService?.coding?.[0]?.code || ''
        );

        segments.push(this.segmentBuilder.buildSegment('UM', [
          serviceTypeCode,                    // Service Type Code
          '',                                 // Service Type Code (additional)
          item.productOrService?.coding?.[0]?.code || '', // Procedure Code
          item.modifier?.map(m => m.coding?.[0]?.code).join(':') || '', // Procedure Modifier
          '',                                 // Diagnosis Code Pointer
          item.quantity?.value?.toString() || '1', // Quantity
          '',                                 // Ambulatory Patient Group
          '',                                 // Service Type Code
          ''                                  // Service Type Modifier
        ]));

        // DTP segment - Service date
        if (claim.created) {
          segments.push(this.segmentBuilder.buildSegment('DTP', [
            '472',                           // Date Time Qualifier (Service Date)
            'D8',                           // Date Time Period Format Qualifier
            this.dateFormatter.toX12Date(claim.created)
          ]));
        }

        // QTY segment - Quantity
        if (item.quantity?.value) {
          segments.push(this.segmentBuilder.buildSegment('QTY', [
            'CA',                           // Quantity Qualifier (Covered - Actual)
            item.quantity.value.toString() // Quantity
          ]));
        }
      });
    }

    return segments;
  }

  /**
   * Build response hierarchy for ClaimResponse
   */
  private buildResponseHierarchy(claimResponse: ClaimResponse): string[] {
    const segments: string[] = [];

    // HCR segment - Health Care Services Review
    const actionCode = this.codeMapper.mapOutcomeToActionCode(claimResponse.outcome || '');

    segments.push(this.segmentBuilder.buildSegment('HCR', [
      actionCode,                          // Action Code
      claimResponse.preAuthRef || '',      // Authorization Number
      claimResponse.disposition || '',     // Review Type Code
      '',                                  // Second Surgical Opinion Code
      ''                                   // Second Surgical Opinion Code
    ]));

    // MSG segment - Message Text
    if (claimResponse.disposition) {
      segments.push(this.segmentBuilder.buildSegment('MSG', [
        claimResponse.disposition           // Free Form Message Text
      ]));
    }

    // REF segment - Prior Authorization Number
    if (claimResponse.preAuthRef) {
      segments.push(this.segmentBuilder.buildSegment('REF', [
        'G1',                              // Reference Identification Qualifier
        claimResponse.preAuthRef           // Reference Identification
      ]));
    }

    return segments;
  }

  /**
   * Build SE (Transaction Set Trailer) segment
   */
  private buildTransactionTrailer(segmentCount: number, controlNumber: string): string {
    return this.segmentBuilder.buildSegment('SE', [
      segmentCount.toString(),    // Number of Included Segments
      controlNumber              // Transaction Set Control Number
    ]);
  }

  /**
   * Extract resource from Bundle by type
   */
  private extractResource<T>(bundle: Bundle, resourceType: string): T | undefined {
    return bundle.entry?.find(
      entry => entry.resource?.resourceType === resourceType
    )?.resource as T;
  }

  /**
   * Extract NPI from identifier array
   */
  private extractNPI(identifiers: any[]): string {
    const npiIdentifier = identifiers.find(
      id => id.type?.coding?.[0]?.code === 'NPI' ||
            id.system?.includes('npi') ||
            id.use === 'official'
    );
    return npiIdentifier?.value || '';
  }

  /**
   * Extract member ID from patient identifiers
   */
  private extractMemberId(identifiers: any[]): string {
    const memberIdentifier = identifiers.find(
      id => id.type?.coding?.[0]?.code === 'MB' ||
            id.system?.includes('member') ||
            id.use === 'usual'
    );
    return memberIdentifier?.value || '';
  }

  /**
   * Generate control number for transaction
   */
  private generateControlNumber(): string {
    if (this.config.generateControlNumbers) {
      return Date.now().toString().slice(-9);
    }
    return '000000001';
  }
}