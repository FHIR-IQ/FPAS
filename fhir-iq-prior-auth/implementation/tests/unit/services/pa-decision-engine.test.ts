import { PADecisionEngine } from '../../../src/services/pa-decision-engine';

describe('PADecisionEngine', () => {
  let decisionEngine: PADecisionEngine;

  beforeEach(() => {
    decisionEngine = new PADecisionEngine();
  });

  describe('evaluateAuthorization', () => {
    it('should approve when both failed conservative therapy and neuro deficit are present', async () => {
      const clinicalInfo = {
        failedConservativeTx: true,
        neuroDeficit: true,
        symptomDurationWeeks: 8,
        hasRedFlags: false
      };

      const result = await decisionEngine.evaluateAuthorization(clinicalInfo, {
        serviceType: 'lumbar-mri',
        requestDate: new Date().toISOString(),
        patientAge: 45
      });

      expect(result.disposition).toBe('approved');
      expect(result.preAuthNumber).toBeDefined();
      expect(result.reviewNotes).toContain('Conservative therapy attempted');
      expect(result.reviewNotes).toContain('Neurologic deficit documented');
    });

    it('should pend when failed conservative therapy is present but no neuro deficit', async () => {
      const clinicalInfo = {
        failedConservativeTx: true,
        neuroDeficit: false,
        symptomDurationWeeks: 6,
        hasRedFlags: false
      };

      const result = await decisionEngine.evaluateAuthorization(clinicalInfo, {
        serviceType: 'lumbar-mri',
        requestDate: new Date().toISOString(),
        patientAge: 35
      });

      expect(result.disposition).toBe('pended');
      expect(result.preAuthNumber).toBeDefined();
      expect(result.reviewNotes).toContain('Conservative therapy attempted');
      expect(result.reviewNotes).toContain('Additional clinical review required');
    });

    it('should deny when no conservative therapy is documented', async () => {
      const clinicalInfo = {
        failedConservativeTx: false,
        neuroDeficit: false,
        symptomDurationWeeks: 4,
        hasRedFlags: false
      };

      const result = await decisionEngine.evaluateAuthorization(clinicalInfo, {
        serviceType: 'lumbar-mri',
        requestDate: new Date().toISOString(),
        patientAge: 28
      });

      expect(result.disposition).toBe('denied');
      expect(result.preAuthNumber).toBeUndefined();
      expect(result.reviewNotes).toContain('Conservative therapy not documented');
    });

    it('should approve immediately when red flags are present regardless of other factors', async () => {
      const clinicalInfo = {
        failedConservativeTx: false,
        neuroDeficit: false,
        symptomDurationWeeks: 2,
        hasRedFlags: true
      };

      const result = await decisionEngine.evaluateAuthorization(clinicalInfo, {
        serviceType: 'lumbar-mri',
        requestDate: new Date().toISOString(),
        patientAge: 55
      });

      expect(result.disposition).toBe('approved');
      expect(result.preAuthNumber).toBeDefined();
      expect(result.reviewNotes).toContain('Red flag symptoms present');
    });

    it('should handle unknown service types gracefully', async () => {
      const clinicalInfo = {
        failedConservativeTx: true,
        neuroDeficit: true,
        symptomDurationWeeks: 8,
        hasRedFlags: false
      };

      const result = await decisionEngine.evaluateAuthorization(clinicalInfo, {
        serviceType: 'unknown-service',
        requestDate: new Date().toISOString(),
        patientAge: 45
      });

      expect(result.disposition).toBe('pended');
      expect(result.reviewNotes).toContain('Unknown service type');
    });
  });

  describe('generatePreAuthNumber', () => {
    it('should generate unique pre-auth numbers', () => {
      const num1 = decisionEngine.generatePreAuthNumber();
      const num2 = decisionEngine.generatePreAuthNumber();

      expect(num1).toBeDefined();
      expect(num2).toBeDefined();
      expect(num1).not.toBe(num2);
      expect(num1).toMatch(/^PA-\d{4}-\d{8}$/);
    });
  });

  describe('extractClinicalInfo', () => {
    it('should extract clinical information from questionnaire response', () => {
      const questionnaireResponse = {
        resourceType: 'QuestionnaireResponse',
        id: 'test-response',
        item: [
          {
            linkId: 'conservative-therapy',
            answer: [{ valueBoolean: true }]
          },
          {
            linkId: 'neurologic-deficit',
            answer: [{ valueBoolean: true }]
          },
          {
            linkId: 'symptom-duration',
            answer: [{ valueInteger: 8 }]
          },
          {
            linkId: 'red-flags',
            answer: [{ valueBoolean: false }]
          }
        ]
      };

      const result = decisionEngine.extractClinicalInfo(questionnaireResponse);

      expect(result.failedConservativeTx).toBe(true);
      expect(result.neuroDeficit).toBe(true);
      expect(result.symptomDurationWeeks).toBe(8);
      expect(result.hasRedFlags).toBe(false);
    });

    it('should handle missing questionnaire items gracefully', () => {
      const questionnaireResponse = {
        resourceType: 'QuestionnaireResponse',
        id: 'incomplete-response',
        item: [
          {
            linkId: 'conservative-therapy',
            answer: [{ valueBoolean: true }]
          }
        ]
      };

      const result = decisionEngine.extractClinicalInfo(questionnaireResponse);

      expect(result.failedConservativeTx).toBe(true);
      expect(result.neuroDeficit).toBe(false); // Default value
      expect(result.symptomDurationWeeks).toBe(0); // Default value
      expect(result.hasRedFlags).toBe(false); // Default value
    });

    it('should handle empty questionnaire response', () => {
      const questionnaireResponse = {
        resourceType: 'QuestionnaireResponse',
        id: 'empty-response',
        item: []
      };

      const result = decisionEngine.extractClinicalInfo(questionnaireResponse);

      expect(result.failedConservativeTx).toBe(false);
      expect(result.neuroDeficit).toBe(false);
      expect(result.symptomDurationWeeks).toBe(0);
      expect(result.hasRedFlags).toBe(false);
    });
  });
});