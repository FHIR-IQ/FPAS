import { providerAttributionService } from '../../../src/services/provider-attribution';

describe('ProviderAttributionService', () => {
  describe('checkAttribution', () => {
    it('should return true for practitioner with attributed patient', async () => {
      const user = {
        sub: 'test-user',
        scopes: ['user/*.read'],
        practitioner: 'practitioner-dr-smith',
        organization: 'provider-organization-spine-clinic'
      };

      const requestBody = {
        resourceType: 'Bundle',
        entry: [{
          resource: {
            resourceType: 'Patient',
            id: 'patient-example-jane-doe'
          }
        }]
      };

      const result = await providerAttributionService.checkAttribution(user, requestBody, {});

      expect(result).toBe(true);
    });

    it('should return false for practitioner with non-attributed patient', async () => {
      const user = {
        sub: 'test-user',
        scopes: ['user/*.read'],
        practitioner: 'practitioner-dr-smith',
        organization: 'provider-organization-spine-clinic'
      };

      const requestBody = {
        resourceType: 'Bundle',
        entry: [{
          resource: {
            resourceType: 'Patient',
            id: 'patient-not-attributed'
          }
        }]
      };

      const result = await providerAttributionService.checkAttribution(user, requestBody, {});

      expect(result).toBe(false);
    });

    it('should return true for organization with attributed patient', async () => {
      const user = {
        sub: 'test-user',
        scopes: ['user/*.read'],
        organization: 'provider-organization-spine-clinic'
      };

      const requestBody = {
        resourceType: 'Claim',
        patient: {
          reference: 'Patient/patient-example-jane-doe'
        }
      };

      const result = await providerAttributionService.checkAttribution(user, requestBody, {});

      expect(result).toBe(true);
    });

    it('should return false for organization with non-attributed patient', async () => {
      const user = {
        sub: 'test-user',
        scopes: ['user/*.read'],
        organization: 'provider-organization-spine-clinic'
      };

      const requestBody = {
        resourceType: 'Claim',
        patient: {
          reference: 'Patient/patient-not-attributed'
        }
      };

      const result = await providerAttributionService.checkAttribution(user, requestBody, {});

      expect(result).toBe(false);
    });

    it('should extract patient ID from QuestionnaireResponse', async () => {
      const user = {
        sub: 'test-user',
        scopes: ['user/*.read'],
        practitioner: 'practitioner-dr-smith'
      };

      const requestBody = {
        resourceType: 'QuestionnaireResponse',
        subject: {
          reference: 'Patient/patient-example-jane-doe'
        }
      };

      const result = await providerAttributionService.checkAttribution(user, requestBody, {});

      expect(result).toBe(true);
    });

    it('should return true when no patient ID is found', async () => {
      const user = {
        sub: 'test-user',
        scopes: ['user/*.read'],
        practitioner: 'practitioner-dr-smith'
      };

      const requestBody = {
        resourceType: 'Observation',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '72133-2'
          }]
        }
      };

      const result = await providerAttributionService.checkAttribution(user, requestBody, {});

      expect(result).toBe(true);
    });

    it('should return false when user has no practitioner or organization', async () => {
      const user = {
        sub: 'test-user',
        scopes: ['user/*.read']
      };

      const requestBody = {
        resourceType: 'Claim',
        patient: {
          reference: 'Patient/patient-example-jane-doe'
        }
      };

      const result = await providerAttributionService.checkAttribution(user, requestBody, {});

      expect(result).toBe(false);
    });

    it('should handle request params with patient ID', async () => {
      const user = {
        sub: 'test-user',
        scopes: ['user/*.read'],
        practitioner: 'practitioner-dr-smith'
      };

      const result = await providerAttributionService.checkAttribution(
        user,
        {},
        { id: 'patient-example-jane-doe' }
      );

      expect(result).toBe(true);
    });
  });

  describe('isProviderAttributedToPatient', () => {
    it('should return true for attributed practitioner-patient pair', () => {
      const result = providerAttributionService.isProviderAttributedToPatient(
        'practitioner-dr-smith',
        'patient-example-jane-doe',
        false
      );

      expect(result).toBe(true);
    });

    it('should return false for non-attributed practitioner-patient pair', () => {
      const result = providerAttributionService.isProviderAttributedToPatient(
        'practitioner-dr-smith',
        'patient-not-attributed',
        false
      );

      expect(result).toBe(false);
    });

    it('should return true for attributed organization-patient pair', () => {
      const result = providerAttributionService.isProviderAttributedToPatient(
        'provider-organization-spine-clinic',
        'patient-example-jane-doe',
        true
      );

      expect(result).toBe(true);
    });

    it('should return false for unknown provider', () => {
      const result = providerAttributionService.isProviderAttributedToPatient(
        'unknown-provider',
        'patient-example-jane-doe',
        false
      );

      expect(result).toBe(false);
    });
  });

  describe('getAttributedPatients', () => {
    it('should return attributed patients for practitioner', () => {
      const patients = providerAttributionService.getAttributedPatients(
        'practitioner-dr-smith',
        false
      );

      expect(patients).toContain('patient-example-jane-doe');
      expect(patients).toContain('patient-example-john-smith');
      expect(patients).toContain('patient-123');
      expect(patients).toContain('patient-456');
      expect(patients.length).toBeGreaterThan(0);
    });

    it('should return attributed patients for organization', () => {
      const patients = providerAttributionService.getAttributedPatients(
        'provider-organization-spine-clinic',
        true
      );

      expect(patients).toContain('patient-example-jane-doe');
      expect(patients).toContain('patient-example-john-smith');
      expect(patients).toContain('patient-123');
      expect(patients).toContain('patient-456');
    });

    it('should return empty array for unknown provider', () => {
      const patients = providerAttributionService.getAttributedPatients(
        'unknown-provider',
        false
      );

      expect(patients).toEqual([]);
    });
  });

  describe('getAttributedProviders', () => {
    it('should return attributed providers for patient', () => {
      const providers = providerAttributionService.getAttributedProviders('patient-example-jane-doe');

      expect(providers.practitioners).toContain('practitioner-dr-smith');
      expect(providers.organizations).toContain('provider-organization-spine-clinic');
    });

    it('should return empty arrays for unknown patient', () => {
      const providers = providerAttributionService.getAttributedProviders('patient-unknown');

      expect(providers.practitioners).toEqual([]);
      expect(providers.organizations).toEqual([]);
    });
  });
});