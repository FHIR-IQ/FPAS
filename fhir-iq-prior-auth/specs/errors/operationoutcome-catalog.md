# OperationOutcome Error Catalog

## Overview

This document defines the standardized error model for the FHIR IQ Prior Authorization System (FPAS) using FHIR OperationOutcome resources. It provides consistent error reporting across all API endpoints, operations, and workflows to support proper error handling and system integration.

## Error Classification Framework

### FHIR OperationOutcome Structure
All errors return an OperationOutcome resource with structured issue details:

```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error|warning|information",
      "code": "invalid|forbidden|processing|information-required",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "specific-error-code",
            "display": "Human readable error"
          }
        ]
      },
      "diagnostics": "Additional technical details",
      "location": ["Resource.field.path"],
      "expression": ["FHIRPath expression"]
    }
  ]
}
```

## Error Categories

### 1. Validation Errors (HTTP 400 - Bad Request)

#### Invalid Request Structure
**Trigger**: Missing required PAS elements, malformed FHIR resources
**HTTP Status**: 400 Bad Request
**Issue Code**: `invalid`

```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "invalid",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "missing-required-element",
            "display": "Required PAS element missing"
          }
        ]
      },
      "diagnostics": "Claim.patient reference is required for prior authorization requests",
      "location": ["Claim.patient"],
      "expression": ["Claim.patient"]
    }
  ]
}
```

#### Profile Validation Failures
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "invalid",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "profile-validation-failed",
            "display": "Resource does not conform to required profile"
          }
        ]
      },
      "diagnostics": "Claim resource must conform to http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claim",
      "location": ["Claim.meta.profile"]
    }
  ]
}
```

#### Invalid Business Logic
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "invalid",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "invalid-service-date",
            "display": "Service date cannot be in the past"
          }
        ]
      },
      "diagnostics": "Claim.item.servicedDate must be current date or future date",
      "location": ["Claim.item[0].servicedDate"],
      "expression": ["Claim.item.servicedDate"]
    }
  ]
}
```

### 2. Authorization Errors (HTTP 401/403)

#### Unauthorized Access (HTTP 401)
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "login",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "authentication-required",
            "display": "Valid authentication required"
          }
        ]
      },
      "diagnostics": "Access token missing or expired. Please authenticate and retry."
    }
  ]
}
```

#### Forbidden Access (HTTP 403)
**Trigger**: Provider not attributed to member, insufficient scopes
**HTTP Status**: 403 Forbidden
**Issue Code**: `forbidden`

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
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "provider-not-attributed",
            "display": "Provider not attributed to member"
          }
        ]
      },
      "diagnostics": "Provider NPI 1234567890 is not authorized to submit prior authorization requests for member M123456789",
      "location": ["Claim.provider"],
      "expression": ["Claim.provider"]
    }
  ]
}
```

#### Insufficient Scope
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
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "insufficient-scope",
            "display": "Insufficient OAuth scope for requested operation"
          }
        ]
      },
      "diagnostics": "Required scope 'user/Claim.write' not present in access token"
    }
  ]
}
```

### 3. Processing Errors (HTTP 500/503)

#### Temporary System Failure (HTTP 503)
**Trigger**: UM engine temporary failure, database connectivity issues
**HTTP Status**: 503 Service Unavailable
**Issue Code**: `processing`

```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "processing",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "um-engine-unavailable",
            "display": "Utilization management engine temporarily unavailable"
          }
        ]
      },
      "diagnostics": "Prior authorization processing temporarily unavailable. Please retry after 300 seconds."
    }
  ]
}
```

#### Internal System Error (HTTP 500)
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "processing",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "internal-error",
            "display": "Internal system error"
          }
        ]
      },
      "diagnostics": "An unexpected error occurred. Support reference: ERR-2025-092601-12345"
    }
  ]
}
```

### 4. Information Required (HTTP 200 with Pending Status)

#### Additional Documentation Required
**Trigger**: Pend decision requiring more information
**HTTP Status**: 200 OK
**Issue Code**: `information-required`

**OperationOutcome Response:**
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "information",
      "code": "information-required",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "additional-documentation-required",
            "display": "Additional clinical documentation required"
          }
        ]
      },
      "diagnostics": "Prior authorization pended pending submission of recent imaging studies and conservative therapy documentation"
    }
  ]
}
```

**With CommunicationRequest for Guidance:**
```json
{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    {
      "resource": {
        "resourceType": "ClaimResponse",
        "id": "cr-pended-001",
        "status": "active",
        "outcome": "queued",
        "disposition": "Pended - Additional Information Required",
        "request": {
          "reference": "Claim/claim-001"
        },
        "processNote": [
          {
            "number": 1,
            "type": "display",
            "text": "Prior authorization pended. Additional clinical documentation required before final determination."
          }
        ]
      }
    },
    {
      "resource": {
        "resourceType": "CommunicationRequest",
        "id": "comm-req-001",
        "status": "active",
        "category": [
          {
            "coding": [
              {
                "system": "http://terminology.hl7.org/CodeSystem/communication-category",
                "code": "instruction",
                "display": "Instruction"
              }
            ]
          }
        ],
        "priority": "routine",
        "subject": {
          "reference": "Patient/patient-001"
        },
        "about": [
          {
            "reference": "Claim/claim-001"
          }
        ],
        "recipient": [
          {
            "reference": "Organization/provider-001"
          }
        ],
        "payload": [
          {
            "contentString": "Please submit the following additional documentation: 1) Recent MRI results (within 30 days), 2) Documentation of 6+ weeks conservative therapy including physical therapy notes, 3) Current neurological examination findings"
          }
        ]
      }
    }
  ]
}
```

## Operation-Specific Error Patterns

### Claim/$submit Operation Errors

#### Duplicate Submission
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "duplicate",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "duplicate-claim-submission",
            "display": "Duplicate prior authorization request"
          }
        ]
      },
      "diagnostics": "Prior authorization request already exists for this member and service. Existing authorization: PA2025092600123456"
    }
  ]
}
```

#### Coverage Verification Failure
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "not-found",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "coverage-not-found",
            "display": "Member coverage not found or inactive"
          }
        ]
      },
      "diagnostics": "No active coverage found for member ID M123456789 on service date 2025-10-01",
      "location": ["Coverage.beneficiary"]
    }
  ]
}
```

### Claim/$inquire Operation Errors

#### Authorization Not Found
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "not-found",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "authorization-not-found",
            "display": "Prior authorization not found"
          }
        ]
      },
      "diagnostics": "No prior authorization found matching the provided criteria"
    }
  ]
}
```

### DTR Operation Errors

#### Questionnaire Not Available
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "not-found",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "questionnaire-not-available",
            "display": "Required questionnaire not available for service type"
          }
        ]
      },
      "diagnostics": "No DTR questionnaire configured for CPT code 72148"
    }
  ]
}
```

#### CQL Execution Failure
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "warning",
      "code": "processing",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "cql-execution-failed",
            "display": "CQL expression evaluation failed"
          }
        ]
      },
      "diagnostics": "Unable to evaluate CQL expression 'ExistsFailedConservativeTx()' - required data not available in patient record"
    }
  ]
}
```

### Bulk Export Operation Errors

#### Group Not Found
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "not-found",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "group-not-found",
            "display": "Specified group not found or not accessible"
          }
        ]
      },
      "diagnostics": "Group 'switching-members-2025' not found or requesting payer not authorized for access"
    }
  ]
}
```

#### Export Job Failure
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "processing",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "export-job-failed",
            "display": "Bulk export job failed"
          }
        ]
      },
      "diagnostics": "Export job failed due to storage system error. Job ID: export-12345"
    }
  ]
}
```

## HTTP Status Code Mapping

| HTTP Status | Issue Code | Use Case |
|-------------|------------|----------|
| 400 | `invalid` | Validation errors, malformed requests |
| 401 | `login` | Authentication required |
| 403 | `forbidden` | Authorization failures, insufficient permissions |
| 404 | `not-found` | Resource not found |
| 409 | `duplicate` | Duplicate submissions, conflicts |
| 422 | `business-rule` | Business logic violations |
| 429 | `throttled` | Rate limiting exceeded |
| 500 | `processing` | Internal system errors |
| 503 | `processing` | Temporary service unavailable |

## Retry-After Header Usage

### Temporary Failures (HTTP 503)
```http
HTTP/1.1 503 Service Unavailable
Retry-After: 300
Content-Type: application/fhir+json

{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "processing",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "um-engine-unavailable",
            "display": "Utilization management engine temporarily unavailable"
          }
        ]
      },
      "diagnostics": "Please retry after 300 seconds"
    }
  ]
}
```

### Rate Limiting (HTTP 429)
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1695737400

{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "throttled",
      "details": {
        "coding": [
          {
            "system": "http://fhir-iq.com/CodeSystem/pas-error-codes",
            "code": "rate-limit-exceeded",
            "display": "API rate limit exceeded"
          }
        ]
      },
      "diagnostics": "Rate limit of 100 requests per minute exceeded. Retry after 60 seconds."
    }
  ]
}
```

## Error Code System

### Custom CodeSystem Definition
```json
{
  "resourceType": "CodeSystem",
  "id": "pas-error-codes",
  "url": "http://fhir-iq.com/CodeSystem/pas-error-codes",
  "version": "1.0.0",
  "name": "PASErrorCodes",
  "title": "Prior Authorization System Error Codes",
  "status": "active",
  "experimental": false,
  "publisher": "FHIR IQ Prior Authorization POC",
  "description": "Error codes specific to the Prior Authorization System",
  "concept": [
    {
      "code": "missing-required-element",
      "display": "Required PAS element missing",
      "definition": "A required element for PAS processing is missing from the request"
    },
    {
      "code": "provider-not-attributed",
      "display": "Provider not attributed to member",
      "definition": "The requesting provider is not attributed to the specified member"
    },
    {
      "code": "um-engine-unavailable",
      "display": "UM engine temporarily unavailable",
      "definition": "The utilization management engine is temporarily unavailable"
    },
    {
      "code": "additional-documentation-required",
      "display": "Additional clinical documentation required",
      "definition": "Prior authorization requires additional clinical documentation for decision"
    }
  ]
}
```

## Client Error Handling Guidelines

### Retry Logic
```javascript
async function submitPriorAuth(claimBundle) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await fetch('/Claim/$submit', {
        method: 'POST',
        body: JSON.stringify(claimBundle),
        headers: { 'Content-Type': 'application/fhir+json' }
      });

      if (response.status === 503) {
        const retryAfter = response.headers.get('Retry-After');
        await sleep(parseInt(retryAfter) * 1000);
        attempt++;
        continue;
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        await sleep(parseInt(retryAfter) * 1000);
        attempt++;
        continue;
      }

      return await response.json();

    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      attempt++;
      await sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
    }
  }
}
```

### Error Categorization
```javascript
function categorizeError(operationOutcome) {
  const issue = operationOutcome.issue[0];

  switch (issue.code) {
    case 'invalid':
      return 'CLIENT_ERROR'; // Fix request and retry
    case 'forbidden':
      return 'AUTHORIZATION_ERROR'; // Check credentials/permissions
    case 'processing':
      if (issue.details?.coding?.[0]?.code === 'um-engine-unavailable') {
        return 'TEMPORARY_ERROR'; // Retry with backoff
      }
      return 'SYSTEM_ERROR'; // Contact support
    case 'information-required':
      return 'PENDED'; // Handle additional information request
    default:
      return 'UNKNOWN_ERROR';
  }
}
```

## Monitoring and Alerting

### Error Metrics
- **Error Rate by Type**: Track percentage of requests by error category
- **Retry Success Rate**: Monitor effectiveness of retry mechanisms
- **Resolution Time**: Time from error to successful resolution
- **Top Error Patterns**: Most common error scenarios for improvement

### Alert Thresholds
- **High Error Rate**: > 5% of requests returning 4xx/5xx status
- **System Unavailable**: > 10% of requests returning 503 status
- **Authorization Failures**: > 2% of requests returning 403 status
- **Processing Delays**: > 50% of requests taking > 30 seconds

## Testing Error Scenarios

### Automated Error Testing
1. **Validation Errors**: Submit malformed FHIR resources
2. **Authorization Errors**: Use invalid/expired tokens
3. **Business Logic Errors**: Submit invalid business scenarios
4. **System Errors**: Simulate backend failures
5. **Rate Limiting**: Exceed API rate limits

### Error Recovery Testing
1. **Retry Logic**: Verify proper retry behavior with exponential backoff
2. **Graceful Degradation**: Ensure system remains stable during errors
3. **Error Message Clarity**: Validate error messages provide actionable guidance
4. **Monitoring Integration**: Confirm errors trigger appropriate alerts

## References

- [FHIR R4 OperationOutcome](http://hl7.org/fhir/R4/operationoutcome.html)
- [HTTP Status Codes](https://tools.ietf.org/html/rfc7231#section-6)
- [FHIR HTTP API](http://hl7.org/fhir/R4/http.html)
- [Da Vinci PAS Error Handling](http://hl7.org/fhir/us/davinci-pas/)