# Payer-to-Payer Bulk Export Specification

## Overview

This specification defines the FHIR Bulk Data Export implementation for payer-to-payer data exchange in the FHIR IQ Prior Authorization System (FPAS). This enables secure, efficient transfer of member health data when patients switch health plans, supporting care continuity and reducing administrative burden.

## Regulatory Context

### CMS-0057-F Requirements
- Payers must implement payer-to-payer data exchange
- Support member data portability when switching plans
- Maintain comprehensive health data including prior authorizations
- Comply with HIPAA and state privacy regulations

### Implementation Guide Alignment
- [HL7 FHIR Bulk Data Access IG](http://hl7.org/fhir/uv/bulkdata/)
- [Da Vinci Payer Data Exchange (PDex) IG](http://hl7.org/fhir/us/davinci-pdex/)
- [FHIR R4 Async Pattern](http://hl7.org/fhir/R4/async.html)

## Bulk Export Operation

### Base Operation Endpoint
```
GET [base]/Group/[id]/$export
POST [base]/Group/[id]/$export
```

### Supported Resource Types
The `_type` parameter supports the following FHIR resource types for comprehensive member data export:

#### Core Administrative Resources
- **Patient** - Member demographics and identifiers
- **Coverage** - Insurance coverage details and periods
- **Organization** - Healthcare providers and facilities

#### Prior Authorization Resources
- **Claim** - Prior authorization requests and claims
- **ClaimResponse** - Authorization decisions and responses
- **Task** - Workflow tracking for PA processes

#### Clinical Resources
- **Encounter** - Healthcare visits and episodes
- **Observation** - Lab results, vital signs, assessments
- **Condition** - Diagnoses and medical conditions
- **Procedure** - Medical procedures and interventions
- **MedicationStatement** - Medication history and adherence
- **AllergyIntolerance** - Known allergies and intolerances
- **Immunization** - Vaccination history
- **DiagnosticReport** - Imaging and lab reports

#### Care Management Resources
- **CarePlan** - Treatment plans and goals
- **CareTeam** - Healthcare team members
- **Goal** - Patient care objectives

## Request Parameters

### Required Parameters

#### Group Identifier
```
GET /Group/switching-members-2025/$export
```
- Group must contain Patient resources for members switching plans
- Group membership validated against payer records
- Access restricted to authorized receiving payer

#### Type Filter
```
GET /Group/switching-members-2025/$export?_type=Patient,Coverage,Claim,ClaimResponse
```
- Comma-separated list of FHIR resource types
- Requesting payer specifies needed resource types
- Default includes all supported types if not specified

### Optional Parameters

#### Since Parameter (Incremental Export)
```
GET /Group/switching-members-2025/$export?_since=2020-01-01T00:00:00Z
```
- RFC3339 timestamp for incremental data export
- Returns resources modified since the specified date
- Minimum 5-year lookback window for switching members
- Supports cursor-based pagination for large datasets

#### Output Format
```
GET /Group/switching-members-2025/$export?_outputFormat=application/fhir+ndjson
```
- Default: `application/fhir+ndjson` (Newline Delimited JSON)
- Each line contains a single FHIR resource
- Resources grouped by type in separate files

## Async Workflow Implementation

### Step 1: Export Request Initiation
```http
POST /Group/switching-members-2025/$export
Content-Type: application/fhir+json
Prefer: respond-async

{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "_type",
      "valueString": "Patient,Coverage,Claim,ClaimResponse,Encounter,Observation"
    },
    {
      "name": "_since",
      "valueInstant": "2020-01-01T00:00:00Z"
    }
  ]
}
```

### Step 2: Async Response
```http
HTTP/1.1 202 Accepted
Content-Location: https://api.fhir-iq.com/bulk-export/job/12345
Retry-After: 120

{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "information",
      "code": "informational",
      "details": {
        "text": "Export job initiated. Check status at provided Content-Location URL."
      }
    }
  ]
}
```

### Step 3: Status Polling
```http
GET /bulk-export/job/12345
Authorization: Bearer <access_token>
```

#### Job In Progress Response
```http
HTTP/1.1 202 Accepted
Retry-After: 60
X-Progress: Processing 45% complete

{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "information",
      "code": "informational",
      "details": {
        "text": "Export job in progress. Estimated completion: 2025-09-26T15:30:00Z"
      }
    }
  ]
}
```

#### Job Complete Response
```http
HTTP/1.1 200 OK
Content-Type: application/json
Expires: Fri, 03 Oct 2025 17:00:00 GMT

{
  "transactionTime": "2025-09-26T14:30:00Z",
  "request": "https://api.fhir-iq.com/Group/switching-members-2025/$export?_type=Patient,Coverage,Claim",
  "requiresAccessToken": true,
  "output": [
    {
      "type": "Patient",
      "url": "https://storage.fhir-iq.com/exports/job-12345/Patient.ndjson",
      "count": 150
    },
    {
      "type": "Coverage",
      "url": "https://storage.fhir-iq.com/exports/job-12345/Coverage.ndjson",
      "count": 180
    },
    {
      "type": "Claim",
      "url": "https://storage.fhir-iq.com/exports/job-12345/Claim.ndjson",
      "count": 2450
    },
    {
      "type": "ClaimResponse",
      "url": "https://storage.fhir-iq.com/exports/job-12345/ClaimResponse.ndjson",
      "count": 2380
    }
  ],
  "error": []
}
```

## Data Retention and Access

### Minimum Data Window
- **5-Year Lookback**: Minimum data retention for switching members
- **Prior Authorization History**: Complete PA records within retention period
- **Clinical Context**: Relevant clinical data supporting PA decisions
- **Provider Networks**: Historical provider relationships and referrals

### Fulfillment SLA
- **7-Day Maximum**: Complete export available within 7 calendar days
- **Progress Updates**: Status polling every 2-4 hours during processing
- **Priority Handling**: Urgent requests (e.g., care transitions) expedited
- **Failure Recovery**: Automatic retry with exponential backoff

### Signed URL Security
```json
{
  "type": "Patient",
  "url": "https://storage.fhir-iq.com/exports/job-12345/Patient.ndjson?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...",
  "count": 150,
  "extension": [
    {
      "url": "http://fhir-iq.com/StructureDefinition/signed-url-expiry",
      "valueDateTime": "2025-10-03T17:00:00Z"
    }
  ]
}
```

## Data Format Specification

### NDJSON Structure
Each export file contains newline-delimited JSON with one FHIR resource per line:

```ndjson
{"resourceType":"Patient","id":"patient-001","identifier":[{"system":"http://fhir-iq.com/member-id","value":"M123456789"}],"name":[{"family":"Smith","given":["Jane"]}]}
{"resourceType":"Patient","id":"patient-002","identifier":[{"system":"http://fhir-iq.com/member-id","value":"M987654321"}],"name":[{"family":"Johnson","given":["Michael"]}]}
```

### Resource Filtering and Scope

#### Member-Specific Data Only
- Export limited to resources associated with switching members
- Patient compartment boundaries strictly enforced
- Cross-member data leakage prevention

#### Data Minimization
```json
{
  "resourceType": "Observation",
  "id": "obs-001",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "vital-signs"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "85354-9",
        "display": "Blood pressure panel"
      }
    ]
  },
  "subject": {
    "reference": "Patient/patient-001"
  },
  "meta": {
    "extension": [
      {
        "url": "http://fhir-iq.com/StructureDefinition/data-source",
        "valueString": "payer-system"
      }
    ]
  }
}
```

## Authorization and Security

### OAuth 2.0 Scopes
```
system/Group.read
system/Patient.read
system/Coverage.read
system/Claim.read
system/ClaimResponse.read
system/*.read
```

### Required Token Claims
```json
{
  "iss": "https://auth.requesting-payer.com",
  "sub": "payer-client-12345",
  "aud": "https://api.fhir-iq.com",
  "scope": "system/Group.read system/Patient.read system/Coverage.read",
  "requesting_payer": {
    "npi": "9999999999",
    "name": "Receiving Health Plan Inc"
  },
  "purpose_of_use": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason",
    "code": "PAYMGT",
    "display": "Payment Management"
  }
}
```

### Data Use Agreement
- Requesting payer must have signed data sharing agreement
- Member consent verification required before export initiation
- Audit trail maintained for all export requests and data access

## Implementation Examples

### Member Group Creation
```json
{
  "resourceType": "Group",
  "id": "switching-members-2025-q3",
  "meta": {
    "profile": [
      "http://fhir-iq.com/StructureDefinition/switching-member-group"
    ]
  },
  "active": true,
  "type": "person",
  "actual": true,
  "name": "Q3 2025 Switching Members - Receiving Payer XYZ",
  "quantity": 150,
  "characteristic": [
    {
      "code": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/group-characteristics",
            "code": "switching-member",
            "display": "Member Switching Payers"
          }
        ]
      },
      "valueBoolean": true
    }
  ],
  "member": [
    {
      "entity": {
        "reference": "Patient/patient-001"
      },
      "period": {
        "start": "2020-01-01",
        "end": "2025-09-30"
      }
    }
  ]
}
```

### Error Handling
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "forbidden",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/bulk-export-errors",
            "code": "insufficient-authorization",
            "display": "Requesting payer not authorized for this member group"
          }
        ]
      },
      "diagnostics": "Valid data sharing agreement required for member group access"
    }
  ]
}
```

## Monitoring and Metrics

### Export Job Metrics
- **Job Success Rate**: Percentage of successfully completed exports
- **Average Processing Time**: Mean time from request to completion
- **Data Volume**: Total resources and file sizes exported
- **SLA Compliance**: Percentage meeting 7-day fulfillment requirement

### Performance Targets (POC)
- **Small Export** (< 100 members): 2-4 hours
- **Medium Export** (100-1000 members): 4-24 hours
- **Large Export** (> 1000 members): 24-168 hours (7 days max)

### Audit Requirements
```json
{
  "timestamp": "2025-09-26T14:30:00Z",
  "event_type": "BULK_EXPORT_INITIATED",
  "requesting_payer": "9999999999",
  "source_payer": "1111111111",
  "member_count": 150,
  "data_types": ["Patient", "Coverage", "Claim", "ClaimResponse"],
  "since_date": "2020-01-01T00:00:00Z",
  "job_id": "export-12345",
  "outcome": "ACCEPTED"
}
```

## Production Considerations

### Scalability
- Horizontal scaling for concurrent export jobs
- Distributed storage for large NDJSON files
- Load balancing for status polling endpoints
- Caching for frequently requested member groups

### Data Privacy
- Automatic PHI detection and handling
- Encryption at rest and in transit
- Signed URL expiration (24-72 hours)
- Audit logging for all data access

### Integration Points
- EHR system notifications for member switches
- Claims system integration for PA history
- Member portal updates for data sharing consent
- Analytics platform for export monitoring

## Testing and Validation

### Test Scenarios
1. **Full Member Export**: Complete 5-year data for switching member
2. **Incremental Export**: Only recent data since last export
3. **Filtered Export**: Specific resource types only
4. **Large Volume**: Export for 1000+ switching members
5. **Error Conditions**: Invalid groups, expired tokens, insufficient permissions

### Compliance Validation
- FHIR R4 resource validation for all exported data
- PDex IG profile compliance verification
- Bulk Data IG workflow adherence
- Privacy and security control testing

## References

- [FHIR Bulk Data Access IG](http://hl7.org/fhir/uv/bulkdata/)
- [Da Vinci PDex IG](http://hl7.org/fhir/us/davinci-pdex/)
- [CMS-0057-F Final Rule](https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-and-patient-access-final-rule-cms-9115-f)
- [FHIR R4 Async Pattern](http://hl7.org/fhir/R4/async.html)