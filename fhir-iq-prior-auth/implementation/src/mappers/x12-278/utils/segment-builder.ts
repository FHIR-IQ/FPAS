/**
 * X12 Segment Builder Utility
 *
 * Constructs properly formatted X12 segments with element separators
 * and validation according to X12 syntax rules.
 */

import { X12MapperConfig } from '../index';

export class SegmentBuilder {
  private config: X12MapperConfig;

  // X12 syntax characters
  private readonly ELEMENT_SEPARATOR = '*';
  private readonly SEGMENT_TERMINATOR = '~';
  private readonly COMPONENT_SEPARATOR = ':';
  private readonly REPETITION_SEPARATOR = '^';

  constructor(config: X12MapperConfig) {
    this.config = config;
  }

  /**
   * Build a complete X12 segment
   *
   * @param segmentId - The segment identifier (ST, BHT, HL, etc.)
   * @param elements - Array of element values
   * @returns Formatted X12 segment string
   */
  buildSegment(segmentId: string, elements: (string | number | undefined)[]): string {
    // Convert elements to strings and handle empty/undefined values
    const formattedElements = elements.map(element => {
      if (element === undefined || element === null) {
        return '';
      }
      return element.toString().trim();
    });

    // Remove trailing empty elements to comply with X12 syntax
    while (formattedElements.length > 0 && formattedElements[formattedElements.length - 1] === '') {
      formattedElements.pop();
    }

    // Build the segment
    const segment = segmentId + this.ELEMENT_SEPARATOR + formattedElements.join(this.ELEMENT_SEPARATOR);

    // Validate segment length (X12 segments must be <= 104 characters including terminator)
    if (segment.length > 103) {
      throw new Error(`Segment ${segmentId} exceeds maximum length: ${segment.length} characters`);
    }

    return segment;
  }

  /**
   * Build composite element (elements separated by component separator)
   *
   * @param components - Array of component values
   * @returns Formatted composite element string
   */
  buildCompositeElement(components: (string | number | undefined)[]): string {
    return components
      .map(component => component?.toString().trim() || '')
      .filter(component => component !== '') // Remove empty components
      .join(this.COMPONENT_SEPARATOR);
  }

  /**
   * Build repeating element (elements separated by repetition separator)
   *
   * @param repetitions - Array of repeating values
   * @returns Formatted repeating element string
   */
  buildRepeatingElement(repetitions: (string | number)[]): string {
    return repetitions
      .map(repetition => repetition.toString().trim())
      .filter(repetition => repetition !== '') // Remove empty repetitions
      .join(this.REPETITION_SEPARATOR);
  }

  /**
   * Escape special characters in element data
   *
   * @param data - Raw data string
   * @returns Escaped data string
   */
  escapeElementData(data: string): string {
    if (!data) return '';

    return data
      .replace(/\*/g, '') // Remove element separators
      .replace(/~/g, '')  // Remove segment terminators
      .replace(/:/g, '')  // Remove component separators
      .replace(/\^/g, '') // Remove repetition separators
      .trim();
  }

  /**
   * Validate segment ID format
   *
   * @param segmentId - The segment identifier
   * @returns True if valid format
   */
  validateSegmentId(segmentId: string): boolean {
    // X12 segment IDs are 2-3 alphanumeric characters
    return /^[A-Z0-9]{2,3}$/.test(segmentId);
  }

  /**
   * Build hierarchical level (HL) segment with validation
   *
   * @param hierarchicalId - Hierarchical ID number
   * @param parentId - Parent hierarchical ID (empty string for top level)
   * @param levelCode - Hierarchical level code
   * @param childCode - Hierarchical child code (0=no child, 1=has child)
   * @returns Formatted HL segment
   */
  buildHLSegment(
    hierarchicalId: string,
    parentId: string,
    levelCode: string,
    childCode: '0' | '1'
  ): string {
    // Validate HL segment requirements
    if (!hierarchicalId || !levelCode) {
      throw new Error('HL segment requires hierarchicalId and levelCode');
    }

    if (childCode !== '0' && childCode !== '1') {
      throw new Error('HL segment childCode must be "0" or "1"');
    }

    return this.buildSegment('HL', [hierarchicalId, parentId, levelCode, childCode]);
  }

  /**
   * Build name (NM1) segment with validation
   *
   * @param entityIdentifier - Entity identifier code
   * @param entityType - Entity type qualifier (1=person, 2=non-person)
   * @param lastName - Last name or organization name
   * @param firstName - First name
   * @param middleName - Middle name
   * @param namePrefix - Name prefix
   * @param nameSuffix - Name suffix
   * @param idQualifier - Identification code qualifier
   * @param idCode - Identification code
   * @returns Formatted NM1 segment
   */
  buildNM1Segment(
    entityIdentifier: string,
    entityType: '1' | '2',
    lastName: string,
    firstName?: string,
    middleName?: string,
    namePrefix?: string,
    nameSuffix?: string,
    idQualifier?: string,
    idCode?: string
  ): string {
    // Validate required fields
    if (!entityIdentifier || !entityType || !lastName) {
      throw new Error('NM1 segment requires entityIdentifier, entityType, and lastName');
    }

    if (entityType !== '1' && entityType !== '2') {
      throw new Error('NM1 segment entityType must be "1" (person) or "2" (non-person)');
    }

    // For person entities, validate name structure
    if (entityType === '1' && !firstName) {
      throw new Error('Person entities (entityType=1) require firstName');
    }

    return this.buildSegment('NM1', [
      entityIdentifier,
      entityType,
      this.escapeElementData(lastName),
      firstName ? this.escapeElementData(firstName) : '',
      middleName ? this.escapeElementData(middleName) : '',
      namePrefix ? this.escapeElementData(namePrefix) : '',
      nameSuffix ? this.escapeElementData(nameSuffix) : '',
      idQualifier || '',
      idCode || ''
    ]);
  }

  /**
   * Build reference (REF) segment
   *
   * @param qualifier - Reference identification qualifier
   * @param identification - Reference identification
   * @param description - Description (optional)
   * @returns Formatted REF segment
   */
  buildREFSegment(qualifier: string, identification: string, description?: string): string {
    if (!qualifier || !identification) {
      throw new Error('REF segment requires qualifier and identification');
    }

    return this.buildSegment('REF', [
      qualifier,
      this.escapeElementData(identification),
      description ? this.escapeElementData(description) : ''
    ]);
  }

  /**
   * Build date/time period (DTP) segment
   *
   * @param qualifier - Date/time qualifier
   * @param formatQualifier - Date/time format qualifier (D8, TM, etc.)
   * @param dateTime - Date/time value
   * @returns Formatted DTP segment
   */
  buildDTPSegment(qualifier: string, formatQualifier: string, dateTime: string): string {
    if (!qualifier || !formatQualifier || !dateTime) {
      throw new Error('DTP segment requires qualifier, formatQualifier, and dateTime');
    }

    return this.buildSegment('DTP', [qualifier, formatQualifier, dateTime]);
  }

  /**
   * Build utilization management (UM) segment
   *
   * @param serviceTypeCode - Service type code
   * @param serviceTypeCode2 - Additional service type code (optional)
   * @param procedureCode - Procedure code
   * @param procedureModifier - Procedure modifier (optional)
   * @param diagnosisPointer - Diagnosis code pointer (optional)
   * @param quantity - Service quantity (optional)
   * @param apgCode - Ambulatory patient group code (optional)
   * @param serviceTypeCode3 - Additional service type code (optional)
   * @param serviceModifier - Service type modifier (optional)
   * @returns Formatted UM segment
   */
  buildUMSegment(
    serviceTypeCode: string,
    serviceTypeCode2?: string,
    procedureCode?: string,
    procedureModifier?: string,
    diagnosisPointer?: string,
    quantity?: string,
    apgCode?: string,
    serviceTypeCode3?: string,
    serviceModifier?: string
  ): string {
    if (!serviceTypeCode) {
      throw new Error('UM segment requires serviceTypeCode');
    }

    return this.buildSegment('UM', [
      serviceTypeCode,
      serviceTypeCode2 || '',
      procedureCode || '',
      procedureModifier || '',
      diagnosisPointer || '',
      quantity || '',
      apgCode || '',
      serviceTypeCode3 || '',
      serviceModifier || ''
    ]);
  }

  /**
   * Build healthcare services review (HCR) segment
   *
   * @param actionCode - Review action code
   * @param authorizationNumber - Authorization number (optional)
   * @param reviewTypeCode - Review type code (optional)
   * @param secondOpinion - Second surgical opinion code (optional)
   * @param secondOpinion2 - Additional second surgical opinion code (optional)
   * @returns Formatted HCR segment
   */
  buildHCRSegment(
    actionCode: string,
    authorizationNumber?: string,
    reviewTypeCode?: string,
    secondOpinion?: string,
    secondOpinion2?: string
  ): string {
    if (!actionCode) {
      throw new Error('HCR segment requires actionCode');
    }

    return this.buildSegment('HCR', [
      actionCode,
      authorizationNumber || '',
      reviewTypeCode || '',
      secondOpinion || '',
      secondOpinion2 || ''
    ]);
  }

  /**
   * Get segment statistics
   *
   * @param segments - Array of segment strings
   * @returns Statistics about the segments
   */
  getSegmentStatistics(segments: string[]): {
    totalSegments: number;
    totalLength: number;
    averageLength: number;
    segmentTypes: Record<string, number>;
  } {
    const segmentTypes: Record<string, number> = {};
    let totalLength = 0;

    segments.forEach(segment => {
      const segmentId = segment.split(this.ELEMENT_SEPARATOR)[0];
      segmentTypes[segmentId] = (segmentTypes[segmentId] || 0) + 1;
      totalLength += segment.length;
    });

    return {
      totalSegments: segments.length,
      totalLength,
      averageLength: segments.length > 0 ? Math.round(totalLength / segments.length) : 0,
      segmentTypes
    };
  }
}