# DTR Workflow Examples

This document provides examples of how to use the DTR (Documentation Templates and Rules) prepopulation functionality implemented in Stage D.

## Overview

The DTR implementation provides:
- **SMART-like launcher endpoints** for questionnaire retrieval
- **Naive prepopulation engine** that queries FHIR store for Observations/Conditions
- **Automatic QuestionnaireResponse generation** for PAS Bundles missing DTR documentation
- **Complete end-to-end workflow** from clinical data to authorization decision

## API Endpoints

### 1. SMART App Launch for DTR

```http
GET /fhir/smart/launch?iss=http://localhost:8080/fhir&launch=patient-123&service=lumbar-mri
```

**Response:**
```json
{
  "questionnaire": {
    "resourceType": "Questionnaire",
    "id": "imaging-lumbar-mri",
    "title": "Lumbar MRI Prior Authorization Questionnaire",
    "item": [...]
  },
  "context": {
    "patient": "patient-example-jane-doe",
    "practitioner": "practitioner-dr-smith",
    "organization": "provider-organization-spine-clinic"
  },
  "launchUrl": "https://dtr.fhir-iq.com/launch?questionnaire=imaging-lumbar-mri&patient=patient-example-jane-doe"
}
```

### 2. Get DTR Questionnaire by Service

```http
GET /fhir/dtr/questionnaire?service=lumbar-mri
```

**Response:** Returns the Questionnaire resource with CQL expressions for prepopulation.

### 3. Prepopulate Questionnaire with Patient Data

```http
POST /fhir/dtr/prepopulate
Authorization: Bearer {oauth_token}
Content-Type: application/fhir+json

{
  "questionnaire": "imaging-lumbar-mri",
  "context": {
    "patient": "patient-example-jane-doe",
    "practitioner": "practitioner-dr-smith",
    "organization": "provider-organization-spine-clinic"
  }
}
```

**Response:** Returns prepopulated QuestionnaireResponse based on patient's clinical data.

### 4. Complete DTR Workflow (Questionnaire + Prepopulation)

```http
POST /fhir/dtr/launch-and-prepopulate
Authorization: Bearer {oauth_token}
Content-Type: application/fhir+json

{
  "service": "lumbar-mri",
  "context": {
    "patient": "patient-example-jane-doe",
    "encounter": "encounter-spine-visit",
    "practitioner": "practitioner-dr-smith"
  }
}
```

**Response:**
```json
{
  "questionnaire": {
    "resourceType": "Questionnaire",
    "id": "imaging-lumbar-mri",
    "item": [...]
  },
  "questionnaireResponse": {
    "resourceType": "QuestionnaireResponse",
    "id": "generated-uuid",
    "status": "in-progress",
    "questionnaire": "http://fhir-iq.com/Questionnaire/imaging-lumbar-mri",
    "subject": {
      "reference": "Patient/patient-example-jane-doe"
    },
    "item": [
      {
        "linkId": "conservative-therapy",
        "answer": [{ "valueBoolean": true }]
      },
      {
        "linkId": "neurologic-deficit",
        "answer": [{ "valueBoolean": true }]
      }
    ]
  },
  "prepopulationSummary": {
    "itemsPopulated": 4,
    "itemsTotal": 6,
    "dataSourcesQueried": ["Observation", "Condition", "Procedure", "MedicationStatement"],
    "populationSuccess": true
  }
}
```

## Naive Prepopulation Logic

The DTR prepopulation service uses the following naive FHIR queries to populate questionnaire items:

### Clinical Data Queries

1. **Observations** - Recent vital signs, lab results, physical exam findings
2. **Conditions** - Active and past medical conditions
3. **Procedures** - Previous treatments and therapies
4. **MedicationStatements** - Current and past medications
5. **DiagnosticReports** - Imaging and lab reports

### Prepopulation Rules

#### Conservative Therapy (`conservative-therapy`)
- **Searches for:** Physical therapy procedures (CPT codes: 91251008, 229060009)
- **Searches for:** NSAID medications (Ibuprofen, Naproxen, Diclofenac)
- **Logic:** `hasConservativeTherapy = !!(physicalTherapy || conservativeMeds)`

#### Neurologic Deficit (`neurologic-deficit`)
- **Searches for:** Neurologic conditions (Radiculopathy, Spinal stenosis)
- **Searches for:** Neurologic exam observations (Decreased reflexes, Paralysis)
- **Logic:** `hasNeuroDeficit = !!(neuroCondition || neuroExam)`

#### Symptom Duration (`symptom-duration`)
- **Searches for:** Back pain conditions with onset dates
- **Logic:** Calculate weeks between condition onset and current date

## PAS Bundle Auto-Generation

When a PAS Bundle is submitted **without** a QuestionnaireResponse, the system automatically:

1. **Analyzes Claim** to determine service type from CPT codes
2. **Retrieves appropriate Questionnaire** for the service
3. **Queries patient clinical data** from FHIR store
4. **Generates prepopulated QuestionnaireResponse** using naive rules
5. **Adds QuestionnaireResponse to PAS Bundle** before processing

### Example: PAS Bundle without DTR

**Submitted Bundle:**
```json
{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    {
      "resource": {
        "resourceType": "Claim",
        "item": [{
          "productOrService": {
            "coding": [{
              "system": "http://www.ama-assn.org/go/cpt",
              "code": "72148",
              "display": "MRI lumbar spine"
            }]
          }
        }]
      }
    },
    {
      "resource": {
        "resourceType": "Patient",
        "id": "patient-example-jane-doe"
      }
    }
  ]
}
```

**Auto-Enhanced Bundle:**
```json
{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    // ... original entries ...
    {
      "resource": {
        "resourceType": "QuestionnaireResponse",
        "id": "auto-generated-uuid",
        "status": "completed",
        "extension": [{
          "url": "http://fhir-iq.com/StructureDefinition/extension-auto-generated",
          "valueBoolean": true
        }],
        "item": [
          // Auto-populated based on patient clinical data
        ]
      }
    }
  ]
}
```

## Service Type Mapping

The system maps CPT codes to service types for questionnaire selection:

| CPT Code | Description | Service Type |
|----------|-------------|--------------|
| 72148 | MRI lumbar spine without contrast | `lumbar-mri` |
| 72149 | MRI lumbar spine with contrast | `lumbar-mri` |
| 93451 | Cardiac catheterization | `cardiac-catheterization` |
| 29881 | Arthroscopy knee | `knee-arthroscopy` |
| 70450 | CT head without contrast | `ct-head` |

## Clinical Decision Integration

The auto-generated QuestionnaireResponse feeds directly into the Stage C clinical decision engine:

- **If** `conservative-therapy=true` AND `neurologic-deficit=true` ’ **APPROVED**
- **Else if** `conservative-therapy=true` AND `neurologic-deficit=false` ’ **PENDED**
- **Else** ’ **DENIED**

## Error Handling

- If questionnaire cannot be found for service type ’ Proceeds without DTR
- If patient clinical data is insufficient ’ Uses default values where possible
- If prepopulation fails ’ Returns empty QuestionnaireResponse structure
- All errors logged but don't fail PAS submission

## Testing the DTR Workflow

1. **Create test patient data** in FHIR server with relevant Conditions/Observations
2. **Submit PAS Bundle** without QuestionnaireResponse
3. **Verify auto-generation** occurs and Bundle is enhanced
4. **Check decision logic** uses prepopulated DTR data for authorization

The DTR prepopulation provides a seamless bridge between clinical documentation and prior authorization requirements, reducing provider burden while ensuring appropriate clinical data is captured for decision-making.