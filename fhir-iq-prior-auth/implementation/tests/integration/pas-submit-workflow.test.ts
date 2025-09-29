import { buildApp } from '../../src/app';
import { generateMockToken } from '../../src/middleware/auth-middleware';
import request from 'supertest';
import { FastifyInstance } from 'fastify';

describe('PAS Submit Workflow Integration', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Generate auth token for testing
    authToken = generateMockToken('smart-ehr-client', ['user/Claim.write', 'user/*.read'], {
      sub: 'test-practitioner',
      practitioner: 'practitioner-dr-smith',
      organization: 'provider-organization-spine-clinic'
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /fhir/Claim/$submit', () => {
    it('should successfully submit valid PAS Bundle', async () => {
      const pasBundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            resource: {
              resourceType: 'Claim',
              id: 'test-claim-001',
              status: 'active',
              type: {
                coding: [{
                  system: 'http://terminology.hl7.org/CodeSystem/claim-type',
                  code: 'professional'
                }]
              },
              patient: {
                reference: 'Patient/patient-example-jane-doe'
              },
              created: new Date().toISOString(),
              provider: {
                reference: 'Practitioner/practitioner-dr-smith'
              },
              item: [{
                sequence: 1,
                productOrService: {
                  coding: [{
                    system: 'http://www.ama-assn.org/go/cpt',
                    code: '72148',
                    display: 'MRI lumbar spine without contrast'
                  }]
                }
              }]
            }
          },
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-example-jane-doe',
              name: [{
                family: 'Doe',
                given: ['Jane']
              }],
              birthDate: '1980-01-01'
            }
          },
          {
            resource: {
              resourceType: 'Practitioner',
              id: 'practitioner-dr-smith',
              name: [{
                family: 'Smith',
                given: ['John'],
                prefix: ['Dr.']
              }]
            }
          }
        ]
      };

      const response = await request(app.server)
        .post('/fhir/Claim/$submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(pasBundle)
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 202]);

      if (response.status === 202) {
        // Async processing
        expect(response.body.resourceType).toBe('Task');
        expect(response.body.status).toBe('accepted');
        expect(response.body.focus.reference).toBeDefined();
      } else {
        // Sync processing
        expect(response.body.resourceType).toBe('Bundle');
        expect(response.body.type).toBe('collection');
        expect(response.body.entry).toBeDefined();
        expect(response.body.entry.length).toBeGreaterThan(0);
      }
    });

    it('should return 401 for missing authentication', async () => {
      const pasBundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: []
      };

      const response = await request(app.server)
        .post('/fhir/Claim/$submit')
        .send(pasBundle)
        .expect(401);

      expect(response.body.resourceType).toBe('OperationOutcome');
      expect(response.body.issue[0].severity).toBe('error');
      expect(response.body.issue[0].code).toBe('security');
    });

    it('should return 403 for insufficient scopes', async () => {
      const limitedToken = generateMockToken('patient-app-client', ['patient/*.read']);

      const pasBundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: []
      };

      const response = await request(app.server)
        .post('/fhir/Claim/$submit')
        .set('Authorization', `Bearer ${limitedToken}`)
        .send(pasBundle)
        .expect(403);

      expect(response.body.resourceType).toBe('OperationOutcome');
      expect(response.body.issue[0].severity).toBe('error');
      expect(response.body.issue[0].code).toBe('forbidden');
    });

    it('should return 403 for provider not attributed to patient', async () => {
      const unattributedToken = generateMockToken('smart-ehr-client', ['user/Claim.write'], {
        practitioner: 'practitioner-dr-jones',
        organization: 'provider-organization-ortho-group'
      });

      const pasBundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'patient-example-jane-doe' // Dr. Jones is not attributed to Jane Doe
            }
          }
        ]
      };

      const response = await request(app.server)
        .post('/fhir/Claim/$submit')
        .set('Authorization', `Bearer ${unattributedToken}`)
        .send(pasBundle)
        .expect(403);

      expect(response.body.resourceType).toBe('OperationOutcome');
      expect(response.body.issue[0].details.coding[0].code).toBe('provider-not-attributed');
    });

    it('should return 400 for invalid Bundle structure', async () => {
      const invalidBundle = {
        resourceType: 'Bundle',
        type: 'invalid-type',
        entry: []
      };

      const response = await request(app.server)
        .post('/fhir/Claim/$submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidBundle)
        .expect(400);

      expect(response.body.resourceType).toBe('OperationOutcome');
      expect(response.body.issue[0].severity).toBe('error');
    });
  });

  describe('POST /fhir/Claim/$inquire', () => {
    it('should successfully inquire about authorization status', async () => {
      const inquiryParams = {
        resourceType: 'Parameters',
        parameter: [
          {
            name: 'patient',
            valueReference: {
              reference: 'Patient/patient-example-jane-doe'
            }
          }
        ]
      };

      const response = await request(app.server)
        .post('/fhir/Claim/$inquire')
        .set('Authorization', `Bearer ${authToken}`)
        .send(inquiryParams)
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 404]);

      if (response.status === 200) {
        expect(response.body.resourceType).toBe('Bundle');
        expect(response.body.type).toBe('searchset');
        expect(response.body.total).toBeDefined();
        expect(response.body.entry).toBeDefined();
      } else {
        expect(response.body.resourceType).toBe('OperationOutcome');
        expect(response.body.issue[0].code).toBe('not-found');
      }
    });

    it('should return 401 for missing authentication', async () => {
      const inquiryParams = {
        resourceType: 'Parameters',
        parameter: []
      };

      await request(app.server)
        .post('/fhir/Claim/$inquire')
        .send(inquiryParams)
        .expect(401);
    });
  });
});