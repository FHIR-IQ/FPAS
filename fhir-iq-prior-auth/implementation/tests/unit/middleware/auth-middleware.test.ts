import { generateMockToken } from '../../../src/middleware/auth-middleware';
import jwt from 'jsonwebtoken';

// Mock JWT secret for testing
const TEST_JWT_SECRET = 'test-jwt-secret-for-unit-tests';
process.env.JWT_SECRET = TEST_JWT_SECRET;

describe('Auth Middleware', () => {
  describe('generateMockToken', () => {
    it('should generate valid JWT token for smart-ehr-client', () => {
      const scopes = ['user/*.read', 'user/Claim.write'];
      const additionalClaims = {
        sub: 'test-practitioner-123',
        practitioner: 'practitioner-dr-smith',
        organization: 'provider-organization-spine-clinic'
      };

      const token = generateMockToken('smart-ehr-client', scopes, additionalClaims);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token can be decoded
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      expect(decoded.sub).toBe('test-practitioner-123');
      expect(decoded.scopes).toEqual(scopes);
      expect(decoded.client_id).toBe('smart-ehr-client');
      expect(decoded.practitioner).toBe('practitioner-dr-smith');
      expect(decoded.organization).toBe('provider-organization-spine-clinic');
    });

    it('should generate valid JWT token for patient-app-client', () => {
      const scopes = ['patient/*.read', 'patient/Claim.read'];
      const additionalClaims = {
        sub: 'test-patient-456',
        patient: 'patient-example-jane-doe'
      };

      const token = generateMockToken('patient-app-client', scopes, additionalClaims);

      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      expect(decoded.sub).toBe('test-patient-456');
      expect(decoded.scopes).toEqual(scopes);
      expect(decoded.client_id).toBe('patient-app-client');
      expect(decoded.patient).toBe('patient-example-jane-doe');
    });

    it('should generate valid JWT token for system-client', () => {
      const scopes = ['system/*.read', 'system/*.write', 'system/export'];
      const additionalClaims = {
        sub: 'system-client-user'
      };

      const token = generateMockToken('system-client', scopes, additionalClaims);

      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      expect(decoded.sub).toBe('system-client-user');
      expect(decoded.scopes).toEqual(scopes);
      expect(decoded.client_id).toBe('system-client');
    });

    it('should filter invalid scopes for client', () => {
      const requestedScopes = ['user/*.read', 'admin/superuser', 'patient/*.read'];
      const expectedScopes = ['user/*.read']; // Only user scopes allowed for smart-ehr-client

      const token = generateMockToken('smart-ehr-client', requestedScopes);

      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      expect(decoded.scopes).toEqual(expectedScopes);
    });

    it('should handle wildcard scope matching', () => {
      const requestedScopes = ['user/Claim.read', 'user/Patient.read', 'user/Observation.read'];

      const token = generateMockToken('smart-ehr-client', requestedScopes);

      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      expect(decoded.scopes).toContain('user/Claim.read');
      expect(decoded.scopes).toContain('user/Patient.read');
      expect(decoded.scopes).toContain('user/Observation.read');
    });

    it('should throw error for unknown client', () => {
      expect(() => {
        generateMockToken('unknown-client', ['user/*.read']);
      }).toThrow('Unknown client: unknown-client');
    });

    it('should include standard JWT claims', () => {
      const token = generateMockToken('smart-ehr-client', ['user/*.read']);

      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      expect(decoded.iss).toBe('http://fhir-iq.com');
      expect(decoded.aud).toBe('http://fhir-iq.com/pas');
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(decoded.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    });

    it('should generate tokens with 1 hour expiration', () => {
      const token = generateMockToken('smart-ehr-client', ['user/*.read']);

      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      const expectedExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour
      expect(decoded.exp).toBeCloseTo(expectedExp, -1); // Allow 10 second variance
    });
  });
});