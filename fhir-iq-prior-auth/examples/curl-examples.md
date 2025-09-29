# FHIR IQ PAS API - cURL Examples

This document provides practical cURL examples for interacting with the FHIR IQ Prior Authorization System API.

## Prerequisites

1. **Server Running**: Ensure the FHIR server is running on `http://localhost:8080`
2. **Authentication**: Generate a JWT token using the provided mock token generator
3. **Content-Type**: Always use `application/fhir+json` for FHIR operations

## Generate Authentication Token

First, generate a JWT token for authentication:

```bash
# Using Node.js (from implementation directory)
node -e "
const { generateMockToken } = require('./src/middleware/auth-middleware');
const token = generateMockToken('smart-ehr-client', ['user/*.read', 'user/Claim.write'], {
  practitioner: 'practitioner-dr-smith',
  organization: 'provider-organization-spine-clinic'
});
console.log('JWT_TOKEN=' + token);
"
```

Save the output token as an environment variable:
```bash
export JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Server Metadata & Health

### Get Server CapabilityStatement

```bash
curl -X GET \
  "http://localhost:8080/fhir/metadata" \
  -H "Accept: application/fhir+json" \
  | jq .
```

### Health Check

```bash
curl -X GET \
  "http://localhost:8080/health" \
  -H "Accept: application/json" \
  | jq .
```

## Prior Authorization Operations

### 1. Submit Prior Authorization Request (Claim/$submit)

#### Complete PAS Bundle with DTR

```bash
curl -X POST \
  "http://localhost:8080/fhir/Claim/\$submit" \
  -H "Content-Type: application/fhir+json" \
  -H "Accept: application/fhir+json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "resourceType": "Bundle",
    "type": "collection",
    "timestamp": "'$(date -Iseconds)'",
    "entry": [
      {
        "fullUrl": "http://fhir-iq.com/Claim/demo-claim-001",
        "resource": {
          "resourceType": "Claim",
          "id": "demo-claim-001",
          "status": "active",
          "type": {
            "coding": [{
              "system": "http://terminology.hl7.org/CodeSystem/claim-type",
              "code": "professional",
              "display": "Professional"
            }]
          },
          "use": "preauthorization",
          "patient": {
            "reference": "Patient/patient-example-jane-doe"
          },
          "created": "'$(date -Iseconds)'",
          "provider": {
            "reference": "Practitioner/practitioner-dr-smith"
          },
          "item": [{
            "sequence": 1,
            "productOrService": {
              "coding": [{
                "system": "http://www.ama-assn.org/go/cpt",
                "code": "72148",
                "display": "MRI lumbar spine without contrast"
              }]
            },
            "quantity": { "value": 1 },
            "unitPrice": { "value": 1200.00, "currency": "USD" }
          }]
        }
      },
      {
        "fullUrl": "http://fhir-iq.com/Patient/patient-example-jane-doe",
        "resource": {
          "resourceType": "Patient",
          "id": "patient-example-jane-doe",
          "name": [{
            "use": "official",
            "family": "Doe",
            "given": ["Jane", "Marie"]
          }],
          "gender": "female",
          "birthDate": "1985-03-15"
        }
      },
      {
        "fullUrl": "http://fhir-iq.com/QuestionnaireResponse/dtr-response-001",
        "resource": {
          "resourceType": "QuestionnaireResponse",
          "id": "dtr-response-001",
          "status": "completed",
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
            },
            {
              "linkId": "symptom-duration",
              "answer": [{ "valueInteger": 8 }]
            }
          ]
        }
      }
    ]
  }' | jq .
```

#### Minimal PAS Bundle (Auto-DTR)

```bash
curl -X POST \
  "http://localhost:8080/fhir/Claim/\$submit" \
  -H "Content-Type: application/fhir+json" \
  -H "Accept: application/fhir+json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "resourceType": "Bundle",
    "type": "collection",
    "entry": [
      {
        "resource": {
          "resourceType": "Claim",
          "status": "active",
          "type": {
            "coding": [{
              "system": "http://terminology.hl7.org/CodeSystem/claim-type",
              "code": "professional"
            }]
          },
          "use": "preauthorization",
          "patient": { "reference": "Patient/patient-example-jane-doe" },
          "provider": { "reference": "Practitioner/practitioner-dr-smith" },
          "item": [{
            "sequence": 1,
            "productOrService": {
              "coding": [{
                "system": "http://www.ama-assn.org/go/cpt",
                "code": "72148"
              }]
            }
          }]
        }
      },
      {
        "resource": {
          "resourceType": "Patient",
          "id": "patient-example-jane-doe",
          "name": [{ "family": "Doe", "given": ["Jane"] }],
          "birthDate": "1985-03-15"
        }
      }
    ]
  }' | jq .
```

### 2. Inquire About Authorization Status (Claim/$inquire)

#### Inquire by Patient

```bash
curl -X POST \
  "http://localhost:8080/fhir/Claim/\$inquire" \
  -H "Content-Type: application/fhir+json" \
  -H "Accept: application/fhir+json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "resourceType": "Parameters",
    "parameter": [
      {
        "name": "patient",
        "valueReference": {
          "reference": "Patient/patient-example-jane-doe"
        }
      }
    ]
  }' | jq .
```

#### Inquire by Authorization Number

```bash
curl -X POST \
  "http://localhost:8080/fhir/Claim/\$inquire" \
  -H "Content-Type: application/fhir+json" \
  -H "Accept: application/fhir+json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "resourceType": "Parameters",
    "parameter": [
      {
        "name": "authorizationNumber",
        "valueString": "PA-2024-12345678"
      }
    ]
  }' | jq .
```

#### Inquire by Claim Identifier

```bash
curl -X POST \
  "http://localhost:8080/fhir/Claim/\$inquire" \
  -H "Content-Type: application/fhir+json" \
  -H "Accept: application/fhir+json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "resourceType": "Parameters",
    "parameter": [
      {
        "name": "identifier",
        "valueIdentifier": {
          "system": "http://fhir-iq.com/identifier/claim",
          "value": "demo-claim-001"
        }
      }
    ]
  }' | jq .
```

## DTR (Documentation Templates and Rules) Operations

### 1. SMART App Launch for DTR

```bash
curl -X GET \
  "http://localhost:8080/fhir/smart/launch?iss=http://localhost:8080/fhir&launch=patient-123&service=lumbar-mri" \
  -H "Accept: application/fhir+json" \
  | jq .
```

### 2. Get DTR Questionnaire by Service

```bash
curl -X GET \
  "http://localhost:8080/fhir/dtr/questionnaire?service=lumbar-mri" \
  -H "Accept: application/fhir+json" \
  | jq .
```

### 3. DTR Prepopulation

```bash
curl -X POST \
  "http://localhost:8080/fhir/dtr/prepopulate" \
  -H "Content-Type: application/fhir+json" \
  -H "Accept: application/fhir+json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "questionnaire": "imaging-lumbar-mri",
    "context": {
      "patient": "patient-example-jane-doe",
      "practitioner": "practitioner-dr-smith",
      "organization": "provider-organization-spine-clinic"
    }
  }' | jq .
```

### 4. Complete DTR Workflow (Launch + Prepopulate)

```bash
curl -X POST \
  "http://localhost:8080/fhir/dtr/launch-and-prepopulate" \
  -H "Content-Type: application/fhir+json" \
  -H "Accept: application/fhir+json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "service": "lumbar-mri",
    "context": {
      "patient": "patient-example-jane-doe",
      "encounter": "encounter-spine-visit",
      "practitioner": "practitioner-dr-smith",
      "organization": "provider-organization-spine-clinic"
    }
  }' | jq .
```

## Questionnaire Operations

### 1. Search Questionnaires

```bash
curl -X GET \
  "http://localhost:8080/fhir/Questionnaire?context=lumbar-mri&_count=10" \
  -H "Accept: application/fhir+json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq .
```

### 2. Read Specific Questionnaire

```bash
curl -X GET \
  "http://localhost:8080/fhir/Questionnaire/imaging-lumbar-mri" \
  -H "Accept: application/fhir+json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq .
```

### 3. Populate Questionnaire with Patient Data

```bash
curl -X POST \
  "http://localhost:8080/fhir/Questionnaire/imaging-lumbar-mri/\$populate" \
  -H "Content-Type: application/fhir+json" \
  -H "Accept: application/fhir+json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "resourceType": "Parameters",
    "parameter": [
      {
        "name": "subject",
        "valueReference": { "reference": "Patient/patient-example-jane-doe" }
      },
      {
        "name": "practitioner",
        "valueReference": { "reference": "Practitioner/practitioner-dr-smith" }
      }
    ]
  }' | jq .
```

### 4. Create QuestionnaireResponse

```bash
curl -X POST \
  "http://localhost:8080/fhir/QuestionnaireResponse" \
  -H "Content-Type: application/fhir+json" \
  -H "Accept: application/fhir+json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "resourceType": "QuestionnaireResponse",
    "status": "completed",
    "questionnaire": "http://fhir-iq.com/Questionnaire/imaging-lumbar-mri",
    "subject": { "reference": "Patient/patient-example-jane-doe" },
    "item": [
      {
        "linkId": "conservative-therapy",
        "text": "Has the patient tried conservative therapy?",
        "answer": [{ "valueBoolean": true }]
      },
      {
        "linkId": "neurologic-deficit",
        "text": "Are there signs of neurologic deficit?",
        "answer": [{ "valueBoolean": true }]
      }
    ]
  }' | jq .
```

## ClaimResponse Search Operations

### 1. Search ClaimResponses by Patient

```bash
curl -X GET \
  "http://localhost:8080/fhir/ClaimResponse?patient=Patient/patient-example-jane-doe&_count=10" \
  -H "Accept: application/fhir+json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq .
```

### 2. Search by Outcome

```bash
curl -X GET \
  "http://localhost:8080/fhir/ClaimResponse?outcome=complete&_count=20" \
  -H "Accept: application/fhir+json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq .
```

### 3. Read Specific ClaimResponse

```bash
curl -X GET \
  "http://localhost:8080/fhir/ClaimResponse/claim-response-001" \
  -H "Accept: application/fhir+json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq .
```

## Error Examples

### Unauthorized Request (Missing Token)

```bash
curl -X POST \
  "http://localhost:8080/fhir/Claim/\$submit" \
  -H "Content-Type: application/fhir+json" \
  -d '{"resourceType": "Bundle", "type": "collection", "entry": []}'
```

**Expected Response: 401 Unauthorized**

### Insufficient Scopes

```bash
# Generate token with limited scopes
PATIENT_TOKEN=$(node -e "
const { generateMockToken } = require('./src/middleware/auth-middleware');
console.log(generateMockToken('patient-app-client', ['patient/*.read']));
")

curl -X POST \
  "http://localhost:8080/fhir/Claim/\$submit" \
  -H "Content-Type: application/fhir+json" \
  -H "Authorization: Bearer $PATIENT_TOKEN" \
  -d '{"resourceType": "Bundle", "type": "collection", "entry": []}'
```

**Expected Response: 403 Forbidden**

### Provider Attribution Error

```bash
# Generate token for different provider
UNATTRIBUTED_TOKEN=$(node -e "
const { generateMockToken } = require('./src/middleware/auth-middleware');
console.log(generateMockToken('smart-ehr-client', ['user/Claim.write'], {
  practitioner: 'practitioner-dr-jones',
  organization: 'provider-organization-ortho-group'
}));
")

curl -X POST \
  "http://localhost:8080/fhir/Claim/\$submit" \
  -H "Content-Type: application/fhir+json" \
  -H "Authorization: Bearer $UNATTRIBUTED_TOKEN" \
  -d '{
    "resourceType": "Bundle",
    "type": "collection",
    "entry": [{
      "resource": {
        "resourceType": "Patient",
        "id": "patient-example-jane-doe"
      }
    }]
  }'
```

**Expected Response: 403 Forbidden (provider-not-attributed)**

## Batch Operations

### Multiple Authorization Requests

```bash
curl -X POST \
  "http://localhost:8080/fhir/Claim/\$submit" \
  -H "Content-Type: application/fhir+json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "resourceType": "Bundle",
    "type": "batch",
    "entry": [
      {
        "request": {
          "method": "POST",
          "url": "Claim/$submit"
        },
        "resource": {
          "resourceType": "Bundle",
          "type": "collection",
          "entry": [
            {
              "resource": {
                "resourceType": "Claim",
                "status": "active",
                "use": "preauthorization",
                "patient": { "reference": "Patient/patient-example-jane-doe" },
                "item": [{
                  "productOrService": {
                    "coding": [{ "system": "http://www.ama-assn.org/go/cpt", "code": "72148" }]
                  }
                }]
              }
            }
          ]
        }
      }
    ]
  }' | jq .
```

## Performance Testing

### Concurrent Requests

```bash
# Submit multiple requests in parallel
for i in {1..5}; do
  curl -X POST \
    "http://localhost:8080/fhir/Claim/\$submit" \
    -H "Content-Type: application/fhir+json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d '{
      "resourceType": "Bundle",
      "type": "collection",
      "entry": [
        {
          "resource": {
            "resourceType": "Claim",
            "id": "load-test-claim-'$i'",
            "status": "active",
            "use": "preauthorization",
            "patient": { "reference": "Patient/patient-example-jane-doe" },
            "item": [{
              "productOrService": {
                "coding": [{ "system": "http://www.ama-assn.org/go/cpt", "code": "72148" }]
              }
            }]
          }
        }
      ]
    }' &
done
wait
```

## Useful Bash Functions

Add these to your `.bashrc` or `.zshrc` for convenient testing:

```bash
# Generate PAS auth token
pas_token() {
  node -e "
    const { generateMockToken } = require('./src/middleware/auth-middleware');
    console.log(generateMockToken('smart-ehr-client', ['user/*.read', 'user/Claim.write'], {
      practitioner: 'practitioner-dr-smith',
      organization: 'provider-organization-spine-clinic'
    }));
  "
}

# Submit simple PAS request
pas_submit() {
  local patient=${1:-"patient-example-jane-doe"}
  local token=$(pas_token)

  curl -X POST "http://localhost:8080/fhir/Claim/\$submit" \
    -H "Content-Type: application/fhir+json" \
    -H "Authorization: Bearer $token" \
    -d "{
      \"resourceType\": \"Bundle\",
      \"type\": \"collection\",
      \"entry\": [{
        \"resource\": {
          \"resourceType\": \"Claim\",
          \"status\": \"active\",
          \"use\": \"preauthorization\",
          \"patient\": { \"reference\": \"Patient/$patient\" },
          \"item\": [{
            \"productOrService\": {
              \"coding\": [{ \"system\": \"http://www.ama-assn.org/go/cpt\", \"code\": \"72148\" }]
            }
          }]
        }
      }]
    }" | jq .
}

# Check PAS status
pas_status() {
  local patient=${1:-"patient-example-jane-doe"}
  local token=$(pas_token)

  curl -X POST "http://localhost:8080/fhir/Claim/\$inquire" \
    -H "Content-Type: application/fhir+json" \
    -H "Authorization: Bearer $token" \
    -d "{
      \"resourceType\": \"Parameters\",
      \"parameter\": [{
        \"name\": \"patient\",
        \"valueReference\": { \"reference\": \"Patient/$patient\" }
      }]
    }" | jq .
}
```

## Notes

- All timestamps in examples use ISO 8601 format
- Replace `localhost:8080` with your actual server URL
- JWT tokens expire after 1 hour by default
- Use `jq` for pretty-printing JSON responses
- Add `--verbose` flag to cURL for debugging
- Set `FHIR_BASE_URL` environment variable to override base URL

For more examples and interactive testing, visit the OpenAPI documentation at `http://localhost:8080/docs` when the server is running.