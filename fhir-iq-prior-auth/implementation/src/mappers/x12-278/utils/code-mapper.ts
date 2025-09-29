/**
 * Code Mapping Utility for FHIR ↔ X12 278 Transformations
 *
 * Maps between FHIR code systems and X12 code values.
 * Handles terminology differences between standards.
 */

export class CodeMapper {

  /**
   * Map FHIR gender to X12 gender code
   */
  mapGender(fhirGender: string): string {
    const genderMap: Record<string, string> = {
      'male': 'M',
      'female': 'F',
      'other': 'U',
      'unknown': 'U'
    };

    return genderMap[fhirGender.toLowerCase()] || 'U';
  }

  /**
   * Map X12 gender code to FHIR gender
   */
  mapX12Gender(x12Gender: string): string {
    const genderMap: Record<string, string> = {
      'M': 'male',
      'F': 'female',
      'U': 'unknown'
    };

    return genderMap[x12Gender.toUpperCase()] || 'unknown';
  }

  /**
   * Map FHIR ClaimResponse outcome to X12 HCR action code
   */
  mapOutcomeToActionCode(outcome: string): string {
    const outcomeMap: Record<string, string> = {
      'complete': 'A1',      // Approved
      'error': 'A3',         // Denied
      'partial': 'A2'        // Modified
    };

    return outcomeMap[outcome.toLowerCase()] || 'A4'; // Default to Pended
  }

  /**
   * Map X12 HCR action code to FHIR ClaimResponse outcome
   */
  mapActionCodeToOutcome(actionCode: string): string {
    const actionMap: Record<string, string> = {
      'A1': 'complete',      // Approved
      'A2': 'partial',       // Modified
      'A3': 'error',         // Denied
      'A4': 'partial',       // Pended
      'A6': 'error'          // Modified/Denied
    };

    return actionMap[actionCode.toUpperCase()] || 'partial';
  }

  /**
   * Map CPT/HCPCS procedure codes to X12 service type codes
   *
   * Note: This is a simplified mapping. Production systems should
   * reference comprehensive crosswalks from CMS or payer-specific guides.
   */
  mapServiceType(procedureCode: string): string {
    // Imaging services
    if (this.isImagingCode(procedureCode)) {
      return '3'; // Consultation (commonly used for imaging)
    }

    // Surgical procedures
    if (this.isSurgicalCode(procedureCode)) {
      return '1'; // Specialty Care
    }

    // DME codes
    if (this.isDMECode(procedureCode)) {
      return '6'; // Equipment
    }

    // Lab/pathology
    if (this.isLabCode(procedureCode)) {
      return '5'; // Testing
    }

    // Default to specialty care
    return '1';
  }

  /**
   * Map X12 service type code to FHIR service category
   */
  mapX12ServiceType(serviceTypeCode: string): string {
    const serviceTypeMap: Record<string, string> = {
      '1': 'specialty-care',
      '2': 'mental-health',
      '3': 'consultation',
      '4': 'diagnostic',
      '5': 'testing',
      '6': 'equipment',
      '7': 'pharmacy',
      'B': 'prescription-drug'
    };

    return serviceTypeMap[serviceTypeCode] || 'other';
  }

  /**
   * Map FHIR identifier type to X12 ID qualifier
   */
  mapIdentifierType(fhirType: string): string {
    const typeMap: Record<string, string> = {
      'NPI': 'XX',           // National Provider Identifier
      'MB': 'MI',            // Member Identification Number
      'MR': 'MR',            // Medical Record Number
      'SS': 'SY',            // Social Security Number
      'TAX': 'FI'            // Federal Taxpayer ID
    };

    return typeMap[fhirType.toUpperCase()] || 'XX';
  }

  /**
   * Map X12 ID qualifier to FHIR identifier type
   */
  mapX12IdentifierType(x12Qualifier: string): string {
    const qualifierMap: Record<string, string> = {
      'XX': 'NPI',
      'MI': 'MB',
      'MR': 'MR',
      'SY': 'SS',
      'FI': 'TAX'
    };

    return qualifierMap[x12Qualifier.toUpperCase()] || 'usual';
  }

  /**
   * Map FHIR address use to X12 address qualifier
   */
  mapAddressUse(fhirUse: string): string {
    const useMap: Record<string, string> = {
      'home': 'P',           // Permanent
      'work': 'B',           // Business
      'temp': 'T',           // Temporary
      'old': 'F'             // Former
    };

    return useMap[fhirUse.toLowerCase()] || 'P';
  }

  /**
   * Map FHIR telecom system to X12 communication number qualifier
   */
  mapTelecomSystem(system: string): string {
    const systemMap: Record<string, string> = {
      'phone': 'TE',         // Telephone
      'fax': 'FX',           // Facsimile
      'email': 'EM',         // Electronic Mail
      'pager': 'PA',         // Pager
      'url': 'UR'            // Uniform Resource Locator (URL)
    };

    return systemMap[system.toLowerCase()] || 'TE';
  }

  /**
   * Map FHIR place of service to X12 place of service code
   */
  mapPlaceOfService(fhirLocation: string): string {
    // These codes should match CMS place of service codes
    const locationMap: Record<string, string> = {
      'office': '11',              // Office
      'home': '12',                // Home
      'inpatient-hospital': '21',  // Inpatient Hospital
      'outpatient-hospital': '22', // Outpatient Hospital
      'emergency-room': '23',      // Emergency Room - Hospital
      'ambulatory-surgical': '24', // Ambulatory Surgical Center
      'birthing-center': '25',     // Birthing Center
      'nursing-facility': '31',    // Skilled Nursing Facility
      'custodial-care': '33'       // Custodial Care Facility
    };

    return locationMap[fhirLocation.toLowerCase()] || '11'; // Default to office
  }

  /**
   * Map FHIR priority to X12 priority code
   */
  mapPriority(fhirPriority: string): string {
    const priorityMap: Record<string, string> = {
      'routine': 'R',        // Routine
      'urgent': 'U',         // Urgent
      'asap': 'A',           // As Soon As Possible
      'stat': 'S'            // Stat
    };

    return priorityMap[fhirPriority.toLowerCase()] || 'R';
  }

  /**
   * Get standard X12 entity identifier codes
   */
  getEntityIdentifiers(): Record<string, string> {
    return {
      '1P': 'Provider',
      '40': 'Receiver',
      '41': 'Submitter',
      'QC': 'Patient',
      'DQ': 'Dependent',
      'IL': 'Insured',
      'PR': 'Payer',
      'FA': 'Facility',
      'SJ': 'Service Provider',
      '82': 'Rendering Provider',
      '77': 'Service Facility',
      'DN': 'Referring Provider',
      'P3': 'Primary Care Provider'
    };
  }

  /**
   * Get standard X12 hierarchical level codes
   */
  getHierarchicalLevelCodes(): Record<string, string> {
    return {
      '20': 'Information Source',
      '21': 'Information Receiver',
      '22': 'Billing Provider',
      '23': 'Patient',
      'PT': 'Patient'
    };
  }

  // Helper methods for service type classification

  private isImagingCode(code: string): boolean {
    // Common imaging CPT code ranges
    const imagingRanges = [
      { start: 70010, end: 76499 },  // Radiology
      { start: 78000, end: 78999 }   // Nuclear Medicine
    ];

    const numericCode = parseInt(code, 10);
    if (isNaN(numericCode)) return false;

    return imagingRanges.some(range =>
      numericCode >= range.start && numericCode <= range.end
    );
  }

  private isSurgicalCode(code: string): boolean {
    // Common surgical CPT code ranges
    const surgicalRanges = [
      { start: 10021, end: 69990 }   // Surgery section
    ];

    const numericCode = parseInt(code, 10);
    if (isNaN(numericCode)) return false;

    return surgicalRanges.some(range =>
      numericCode >= range.start && numericCode <= range.end
    );
  }

  private isDMECode(code: string): boolean {
    // HCPCS Level II codes (typically start with letters)
    return /^[A-Z]\d{4}$/.test(code) && ['E', 'K', 'L'].includes(code[0]);
  }

  private isLabCode(code: string): boolean {
    // Common lab/pathology CPT code ranges
    const labRanges = [
      { start: 80047, end: 89398 }   // Pathology and Laboratory
    ];

    const numericCode = parseInt(code, 10);
    if (isNaN(numericCode)) return false;

    return labRanges.some(range =>
      numericCode >= range.start && numericCode <= range.end
    );
  }

  /**
   * Validate X12 code format
   */
  validateX12Code(code: string, codeType: string): boolean {
    const validationPatterns: Record<string, RegExp> = {
      'serviceType': /^[A-Z0-9]{1,3}$/,
      'actionCode': /^[A-Z][0-9]$/,
      'genderCode': /^[MFU]$/,
      'entityId': /^[A-Z0-9]{1,3}$/,
      'hierarchicalLevel': /^[0-9]{1,2}$/
    };

    const pattern = validationPatterns[codeType];
    return pattern ? pattern.test(code) : false;
  }

  /**
   * Get code description for documentation
   */
  getCodeDescription(code: string, codeType: string): string {
    const descriptions: Record<string, Record<string, string>> = {
      'actionCode': {
        'A1': 'Approved',
        'A2': 'Modified',
        'A3': 'Denied',
        'A4': 'Pended',
        'A6': 'Modified/Denied'
      },
      'serviceType': {
        '1': 'Specialty Care',
        '2': 'Mental Health Care',
        '3': 'Consultation',
        '4': 'Diagnostic X-Ray',
        '5': 'Testing',
        '6': 'Equipment',
        '7': 'Pharmacy',
        'B': 'Prescription Drug'
      },
      'genderCode': {
        'M': 'Male',
        'F': 'Female',
        'U': 'Unknown'
      }
    };

    return descriptions[codeType]?.[code] || `Unknown ${codeType} code: ${code}`;
  }
}