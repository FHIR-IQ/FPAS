# RFC-0002: DTR Questionnaire and CQL Integration

- **Status**: Draft
- **Author(s)**: FHIR IQ Development Team
- **Created**: 2024-09-28
- **Updated**: 2024-09-28
- **Supersedes**: N/A
- **Superseded by**: N/A

## Summary

This RFC specifies the implementation of HL7 FHIR Documentation Templates and Rules (DTR) integration for automated clinical data collection and questionnaire prepopulation in the FHIR Prior Authorization POC system.

## Motivation

Prior authorization often requires extensive clinical documentation that providers must manually collect and submit. The Da Vinci DTR Implementation Guide enables automated data extraction from EHR systems using Clinical Quality Language (CQL) expressions, reducing provider burden and improving data quality.

### Goals

- Implement **FHIR Questionnaire serving** with DTR profile compliance
- Integrate **CQL execution engine** for automated data extraction
- Support **questionnaire prepopulation** via $populate operation
- Demonstrate **SMART app launch** workflow for DTR applications
- Provide **end-to-end DTR integration** with PAS operations

### Non-Goals

- **Production CQL Engine**: POC uses simplified mock CQL execution
- **Complex Clinical Logic**: Focus on basic lumbar MRI authorization scenario
- **Multi-questionnaire Management**: Single questionnaire for demonstration
- **Advanced SMART Features**: Basic launch context only

## Detailed Design

### DTR Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   EHR System    │───▶│   DTR Service    │───▶│  CQL Engine     │
│                 │    │                  │    │                 │
│ - SMART App     │    │ - Questionnaire  │    │ - Expression    │
│ - EHR Context   │    │   Serving        │    │   Evaluation    │
│ - Patient Data  │    │ - $populate Op   │    │ - Data Extract  │
└─────────────────┘    │ - Validation     │    │ - Mock Results  │
                       └──────────────────┘    └─────────────────┘
                               │                         │
                               ▼                         ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │   FHIR Server    │    │   Patient Data  │
                       │                  │    │                 │
                       │ - Questionnaire  │    │ - Observations  │
                       │ - Library        │    │ - Conditions    │
                       │ - QuestionnaireResp│  │ - Procedures    │
                       └──────────────────┘    └─────────────────┘
```

### Core Components

#### 1. Questionnaire Management

**Questionnaire Resource Structure**
```json
{
  "resourceType": "Questionnaire",
  "id": "imaging-lumbar-mri",
  "meta": {
    "profile": [
      "http://hl7.org/fhir/us/davinci-dtr/StructureDefinition/dtr-questionnaire"
    ]
  },
  "url": "http://fhir-iq.com/Questionnaire/imaging-lumbar-mri",
  "version": "1.0.0",
  "name": "ImagingLumbarMRIQuestionnaire",
  "title": "Lumbar MRI Prior Authorization Questionnaire",
  "status": "active",
  "subjectType": ["Patient"],
  "library": [
    "http://fhir-iq.com/Library/imaging-lumbar-mri"
  ],
  "item": [
    {
      "linkId": "indication",
      "text": "Primary clinical indication (ICD-10)",
      "type": "choice",
      "required": true,
      "answerValueSet": "http://hl7.org/fhir/sid/icd-10"
    },
    {
      "linkId": "failed-conservative",
      "text": "Failure of conservative therapy (>=6 weeks)?",
      "type": "boolean",
      "required": true,
      "initialExpression": {
        "language": "text/cql",
        "expression": "ExistsFailedConservativeTx()"
      }
    }
  ]
}
```

**Questionnaire Serving Endpoint**
```typescript
// GET /Questionnaire?service={serviceType}
interface QuestionnaireQuery {
  service?: string;           // e.g., "lumbar-mri"
  coverage?: string;          // Coverage reference for payer-specific questionnaires
  patient?: string;           // Patient reference for context
}

class DTRController {
  async getQuestionnaire(request: FastifyRequest<{ Querystring: QuestionnaireQuery }>) {
    const { service, coverage, patient } = request.query;

    // Service-based questionnaire selection
    const questionnaire = await this.questionnaireService.getByService(service);

    // Include referenced CQL libraries
    if (questionnaire.library) {
      const libraries = await this.libraryService.getLibraries(questionnaire.library);
      // Include libraries in response bundle
    }

    return questionnaire;
  }
}
```

#### 2. CQL Library Management

**CQL Library Resource**
```json
{
  "resourceType": "Library",
  "id": "imaging-lumbar-mri",
  "meta": {
    "profile": [
      "http://hl7.org/fhir/us/davinci-dtr/StructureDefinition/dtr-library"
    ]
  },
  "url": "http://fhir-iq.com/Library/imaging-lumbar-mri",
  "version": "1.0.0",
  "name": "ImagingLumbarMRILibrary",
  "status": "active",
  "type": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/library-type",
        "code": "logic-library"
      }
    ]
  },
  "content": [
    {
      "contentType": "text/cql",
      "data": "bGlicmFyeSBJbWFnaW5nTHVtYmFyTVJJIHZlcnNpb24gJzEuMC4wJw=="
    }
  ]
}
```

**CQL Expression Definitions**
```cql
library ImagingLumbarMRI version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

context Patient

// Value sets for POC - simplified for demonstration
valueset "Physical Therapy Codes": 'http://fhir-iq.com/ValueSet/physical-therapy-codes'
valueset "Neurologic Deficit Observations": 'http://fhir-iq.com/ValueSet/neuro-deficit-observations'

// Check if patient has failed conservative therapy for >= 6 weeks
define ExistsFailedConservativeTx:
  exists(
    [ServiceRequest] R
    where R.code in "Physical Therapy Codes"
      and R.status = 'completed'
      and R.occurrence.latest() <= Today() - 6 weeks
  )

// Check if patient has documented neurologic deficit
define HasNeuroDeficit:
  exists(
    [Observation] O
    where O.code in "Neurologic Deficit Observations"
      and O.status in {'final', 'amended', 'corrected'}
      and (O.value as boolean) = true
      and O.effective.latest() within 90 days of Today()
  )

// Check for red flag symptoms requiring urgent imaging
define HasRedFlagSymptoms:
  exists(
    [Condition] C
    where C.code in "Red Flag Symptom Codes"
      and C.clinicalStatus ~ 'active'
      and C.onset.latest() within 30 days of Today()
  )
```

#### 3. CQL Execution Engine

**Mock CQL Engine Implementation**
```typescript
interface CQLResults {
  [expressionName: string]: any;
}

interface CQLContext {
  patientId: string;
  encounterId?: string;
  practitionerId?: string;
}

class MockCQLEngine {
  async executeExpressions(
    libraryUrl: string,
    expressions: string[],
    context: CQLContext
  ): Promise<CQLResults> {

    // Mock implementation for POC - would integrate with actual CQL engine
    const results: CQLResults = {};

    for (const expression of expressions) {
      switch (expression) {
        case 'ExistsFailedConservativeTx()':
          results[expression] = await this.mockConservativeTherapyCheck(context.patientId);
          break;

        case 'HasNeuroDeficit()':
          results[expression] = await this.mockNeuroDeficitCheck(context.patientId);
          break;

        case 'HasRedFlagSymptoms()':
          results[expression] = await this.mockRedFlagCheck(context.patientId);
          break;

        default:
          results[expression] = null;
      }
    }

    return results;
  }

  private async mockConservativeTherapyCheck(patientId: string): Promise<boolean> {
    // Query FHIR server for ServiceRequest resources
    const serviceRequests = await this.fhirClient.search({
      resourceType: 'ServiceRequest',
      searchParams: {
        subject: `Patient/${patientId}`,
        category: 'therapy',
        status: 'completed'
      }
    });

    // Simplified logic for POC
    return serviceRequests.entry?.length > 0;
  }
}
```

#### 4. Questionnaire Response Prepopulation

**$populate Operation Implementation**
```typescript
// POST /QuestionnaireResponse/$populate
interface PopulateRequest {
  questionnaire: string;          // Canonical URL or resource
  subject: Reference;             // Patient reference
  context?: Reference[];          // Encounter, Practitioner references
}

class DTRPopulateService {
  async populateQuestionnaire(request: PopulateRequest): Promise<QuestionnaireResponse> {
    // Load questionnaire and extract CQL expressions
    const questionnaire = await this.loadQuestionnaire(request.questionnaire);
    const cqlExpressions = this.extractCQLExpressions(questionnaire);

    // Execute CQL expressions
    const cqlResults = await this.cqlEngine.executeExpressions(
      questionnaire.library[0],
      cqlExpressions,
      {
        patientId: request.subject.reference.split('/')[1],
        encounterId: request.context?.find(ref => ref.reference.startsWith('Encounter/'))?.reference.split('/')[1]
      }
    );

    // Build prepopulated response
    const response: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      questionnaire: request.questionnaire,
      status: 'in-progress',
      subject: request.subject,
      authored: new Date().toISOString(),
      item: []
    };

    // Map CQL results to questionnaire items
    for (const item of questionnaire.item) {
      if (item.initialExpression) {
        const expression = item.initialExpression.expression;
        const value = cqlResults[expression];

        response.item.push({
          linkId: item.linkId,
          text: item.text,
          answer: value !== null ? [this.formatAnswer(item.type, value)] : []
        });
      }
    }

    return response;
  }
}
```

### SMART App Launch Integration

**DTR SMART App Context**
```typescript
interface SMARTContext {
  iss: string;                    // FHIR server base URL
  launch: string;                 // Launch context token
  patient?: string;               // Patient ID
  encounter?: string;             // Encounter ID
  practitioner?: string;          // Practitioner ID
}

class SMARTLaunchHandler {
  async handleLaunch(context: SMARTContext): Promise<LaunchResponse> {
    // Validate launch context
    const launchContext = await this.validateLaunchContext(context.launch);

    // Determine appropriate questionnaire based on context
    const questionnaire = await this.selectQuestionnaire(launchContext);

    // Prepare DTR application URL with context
    const appUrl = this.buildDTRAppUrl({
      questionnaire: questionnaire.url,
      patient: context.patient,
      encounter: context.encounter,
      fhirServer: context.iss
    });

    return {
      questionnaire,
      appUrl,
      context: launchContext
    };
  }
}
```

### Validation and Error Handling

**DTR-Specific Validation Rules**
```typescript
interface DTRValidationRule {
  name: string;
  check: (questionnaire: Questionnaire) => ValidationResult;
}

const dtrValidationRules: DTRValidationRule[] = [
  {
    name: 'CQL Expression Syntax',
    check: (q) => this.validateCQLSyntax(q.item)
  },
  {
    name: 'Required Value Sets',
    check: (q) => this.validateValueSets(q.item)
  },
  {
    name: 'Library References',
    check: (q) => this.validateLibraryReferences(q.library)
  }
];

class DTRValidator {
  async validateQuestionnaire(questionnaire: Questionnaire): Promise<OperationOutcome> {
    const issues: OperationOutcomeIssue[] = [];

    for (const rule of dtrValidationRules) {
      const result = await rule.check(questionnaire);
      if (!result.valid) {
        issues.push({
          severity: 'error',
          code: 'invalid',
          details: {
            coding: [{
              system: 'http://fhir-iq.com/CodeSystem/dtr-error-codes',
              code: 'questionnaire-validation-failed',
              display: `DTR validation failed: ${rule.name}`
            }]
          },
          diagnostics: result.message
        });
      }
    }

    return { resourceType: 'OperationOutcome', issue: issues };
  }
}
```

## Implementation Requirements

### Technical Specifications

**API Endpoints**
```yaml
DTR Endpoints:
  GET /Questionnaire:
    description: "Retrieve questionnaires by service type"
    parameters:
      - service: string (required)
      - coverage: reference (optional)
    responses:
      200: Questionnaire resource or Bundle

  POST /QuestionnaireResponse/$populate:
    description: "Prepopulate questionnaire with CQL execution"
    body: Parameters resource with questionnaire and subject
    responses:
      200: Prepopulated QuestionnaireResponse

  GET /Library/{id}:
    description: "Retrieve CQL library resources"
    responses:
      200: Library resource with base64-encoded CQL

  POST /$cql-evaluate:
    description: "Execute CQL expressions (development endpoint)"
    body: Parameters with library and context
    responses:
      200: Parameters with expression results
```

**Performance Requirements**
- Questionnaire retrieval: < 2 seconds
- CQL expression execution: < 1 second
- $populate operation: < 3 seconds (including CQL execution)
- Library loading: < 1 second

**Data Requirements**
```yaml
Test Data Sets:
  Patients:
    - Conservative therapy completed (PT records)
    - Neurologic deficit documented (observation records)
    - Red flag symptoms present (condition records)
    - Mixed scenarios for complex decision making

  Clinical Data:
    - ServiceRequest resources for physical therapy
    - Observation resources for neurologic assessments
    - Condition resources for diagnoses and symptoms
    - Procedure resources for previous treatments
```

### Integration Points

**PAS Integration**
- QuestionnaireResponse resources linked to Claim submissions
- DTR completion status tracked in PA workflow
- CQL results influence UM decision making

**EHR Integration**
- SMART app launch from EHR workflow context
- Patient and encounter context passed to DTR service
- Completed questionnaires returned to EHR for submission

## Testing Strategy

### Unit Testing
```typescript
describe('DTR Service', () => {
  test('should retrieve questionnaire by service type', async () => {
    const questionnaire = await dtrService.getQuestionnaire('lumbar-mri');
    expect(questionnaire.url).toBe('http://fhir-iq.com/Questionnaire/imaging-lumbar-mri');
  });

  test('should execute CQL expressions', async () => {
    const results = await cqlEngine.executeExpressions(
      'http://fhir-iq.com/Library/imaging-lumbar-mri',
      ['ExistsFailedConservativeTx()'],
      { patientId: 'patient-001' }
    );
    expect(results['ExistsFailedConservativeTx()']).toBeDefined();
  });

  test('should prepopulate questionnaire response', async () => {
    const response = await dtrService.populateQuestionnaire({
      questionnaire: 'http://fhir-iq.com/Questionnaire/imaging-lumbar-mri',
      subject: { reference: 'Patient/patient-001' }
    });
    expect(response.item.length).toBeGreaterThan(0);
  });
});
```

### Integration Testing
```yaml
DTR Workflow Tests:
  - Complete DTR workflow from questionnaire retrieval to submission
  - SMART app launch with proper context handling
  - CQL execution with realistic patient data
  - Error handling for missing clinical data

Inferno DTR Tests:
  - Questionnaire retrieval conformance
  - $populate operation validation
  - CQL expression syntax validation
  - SMART app launch workflow
```

## Security Considerations

### Authentication and Authorization
- DTR endpoints require valid SMART on FHIR tokens
- Patient context enforced for questionnaire access
- CQL execution limited to authorized clinical data

### Data Privacy
- CQL expressions execute against authorized patient data only
- Questionnaire responses contain only necessary clinical information
- Audit logging for all DTR operations and data access

## Migration Path

### POC to Production
1. **CQL Engine Integration**: Replace mock with production CQL engine (cql-engine-fhir)
2. **Value Set Management**: Integrate with terminology services
3. **Advanced Questionnaires**: Support multiple questionnaires and complex logic
4. **EHR Integration**: Production SMART app deployment and testing

### Success Criteria
- [ ] Questionnaire retrieval passes DTR IG validation
- [ ] CQL expressions execute with realistic results
- [ ] $populate operation completes end-to-end workflow
- [ ] SMART app launch works with test EHR
- [ ] Inferno DTR tests pass successfully

## Open Questions

1. **CQL Engine Choice**: Should POC include embedded CQL engine or external service?
2. **Value Set Management**: How should terminology bindings be handled in POC?
3. **Questionnaire Complexity**: What level of conditional logic should be demonstrated?
4. **SMART Integration**: How deep should EHR integration testing go?

## References

- [Da Vinci DTR Implementation Guide](http://hl7.org/fhir/us/davinci-dtr/)
- [Clinical Quality Language Specification](https://cql.hl7.org/)
- [SMART App Launch Framework](http://hl7.org/fhir/smart-app-launch/)
- [CQL Engine FHIR](https://github.com/DBCG/cql-engine-fhir)
- [Inferno DTR Test Suite](https://github.com/inferno-framework/davinci-dtr-test-kit)