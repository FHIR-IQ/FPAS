import { logger } from '../utils/logger';

interface AttributionMapping {
  practitioner: string;
  organization: string;
  patients: string[];
}

const PROVIDER_ATTRIBUTION_MAP: AttributionMapping[] = [
  {
    practitioner: 'practitioner-dr-smith',
    organization: 'provider-organization-spine-clinic',
    patients: [
      'patient-example-jane-doe',
      'patient-example-john-smith',
      'patient-123',
      'patient-456'
    ]
  },
  {
    practitioner: 'practitioner-dr-jones',
    organization: 'provider-organization-ortho-group',
    patients: [
      'patient-example-robert-johnson',
      'patient-789',
      'patient-101'
    ]
  },
  {
    practitioner: 'practitioner-dr-williams',
    organization: 'provider-organization-cardiac-center',
    patients: [
      'patient-example-mary-williams',
      'patient-202',
      'patient-303'
    ]
  },
  {
    practitioner: 'practitioner-dr-brown',
    organization: 'provider-organization-general-practice',
    patients: [
      'patient-404',
      'patient-505',
      'patient-606',
      'patient-707'
    ]
  }
];

class ProviderAttributionService {
  private attributionMap: Map<string, Set<string>>;
  private orgMap: Map<string, Set<string>>;

  constructor() {
    this.attributionMap = new Map();
    this.orgMap = new Map();
    this.initializeAttributionMap();
  }

  private initializeAttributionMap(): void {
    for (const mapping of PROVIDER_ATTRIBUTION_MAP) {
      const practitionerKey = mapping.practitioner;
      const orgKey = mapping.organization;

      if (!this.attributionMap.has(practitionerKey)) {
        this.attributionMap.set(practitionerKey, new Set());
      }

      if (!this.orgMap.has(orgKey)) {
        this.orgMap.set(orgKey, new Set());
      }

      for (const patient of mapping.patients) {
        this.attributionMap.get(practitionerKey)!.add(patient);
        this.orgMap.get(orgKey)!.add(patient);
      }
    }

    logger.info('Provider attribution map initialized', {
      practitioners: this.attributionMap.size,
      organizations: this.orgMap.size,
      totalMappings: PROVIDER_ATTRIBUTION_MAP.length
    });
  }

  async checkAttribution(
    user: any,
    requestBody: any,
    requestParams: any
  ): Promise<boolean> {
    try {
      const patientId = this.extractPatientId(requestBody, requestParams);

      if (!patientId) {
        logger.debug('No patient ID found in request');
        return true;
      }

      if (user.practitioner) {
        const attributedPatients = this.attributionMap.get(user.practitioner);
        if (!attributedPatients) {
          logger.debug('Practitioner not found in attribution map', {
            practitioner: user.practitioner
          });
          return false;
        }

        const isAttributed = attributedPatients.has(patientId);
        logger.debug('Practitioner attribution check', {
          practitioner: user.practitioner,
          patient: patientId,
          attributed: isAttributed
        });
        return isAttributed;
      }

      if (user.organization) {
        const attributedPatients = this.orgMap.get(user.organization);
        if (!attributedPatients) {
          logger.debug('Organization not found in attribution map', {
            organization: user.organization
          });
          return false;
        }

        const isAttributed = attributedPatients.has(patientId);
        logger.debug('Organization attribution check', {
          organization: user.organization,
          patient: patientId,
          attributed: isAttributed
        });
        return isAttributed;
      }

      logger.debug('No practitioner or organization in user context');
      return false;

    } catch (error) {
      logger.error('Error checking provider attribution', {
        error: error.message
      });
      return false;
    }
  }

  private extractPatientId(requestBody: any, requestParams: any): string | null {
    if (requestParams?.id && requestParams.id.startsWith('patient-')) {
      return requestParams.id;
    }

    if (requestBody?.resourceType === 'Bundle') {
      const patientEntry = requestBody.entry?.find(
        (e: any) => e.resource?.resourceType === 'Patient'
      );
      if (patientEntry?.resource?.id) {
        return patientEntry.resource.id;
      }
    }

    if (requestBody?.resourceType === 'Claim') {
      const patientRef = requestBody.patient?.reference;
      if (patientRef) {
        return patientRef.split('/').pop();
      }
    }

    if (requestBody?.resourceType === 'QuestionnaireResponse') {
      const subjectRef = requestBody.subject?.reference;
      if (subjectRef) {
        return subjectRef.split('/').pop();
      }
    }

    if (requestBody?.patient?.reference) {
      return requestBody.patient.reference.split('/').pop();
    }

    if (requestBody?.subject?.reference) {
      return requestBody.subject.reference.split('/').pop();
    }

    return null;
  }

  isProviderAttributedToPatient(
    providerId: string,
    patientId: string,
    isOrganization: boolean = false
  ): boolean {
    const map = isOrganization ? this.orgMap : this.attributionMap;
    const attributedPatients = map.get(providerId);

    if (!attributedPatients) {
      return false;
    }

    return attributedPatients.has(patientId);
  }

  getAttributedPatients(
    providerId: string,
    isOrganization: boolean = false
  ): string[] {
    const map = isOrganization ? this.orgMap : this.attributionMap;
    const attributedPatients = map.get(providerId);

    if (!attributedPatients) {
      return [];
    }

    return Array.from(attributedPatients);
  }

  getAttributedProviders(patientId: string): {
    practitioners: string[];
    organizations: string[];
  } {
    const practitioners: string[] = [];
    const organizations: string[] = [];

    for (const [practitioner, patients] of this.attributionMap) {
      if (patients.has(patientId)) {
        practitioners.push(practitioner);
      }
    }

    for (const [organization, patients] of this.orgMap) {
      if (patients.has(patientId)) {
        organizations.push(organization);
      }
    }

    return { practitioners, organizations };
  }
}

export const providerAttributionService = new ProviderAttributionService();