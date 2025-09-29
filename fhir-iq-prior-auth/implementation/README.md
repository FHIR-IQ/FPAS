# FHIR IQ Prior Authorization System - Implementation Guide

## Overview

This guide provides step-by-step instructions for setting up and testing the FHIR IQ Prior Authorization System (FPAS) POC. The implementation demonstrates end-to-end prior authorization workflows using FHIR PAS, DTR, and bulk export operations.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   EHR System    │───▶│   API Gateway    │───▶│  HAPI FHIR      │
│  (Client App)   │    │ (Node.js/Spring) │    │   Server        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                               │
                               ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │   UM Engine      │───▶│   PostgreSQL    │
                       │   (Mock Rules)   │    │   Database      │
                       └──────────────────┘    └─────────────────┘
```

## Prerequisites

### Required Software
- **Docker & Docker Compose** (v20.10+)
- **Node.js** (v18+) OR **Java 17+** (depending on tech stack choice)
- **Git** for version control
- **curl** for API testing
- **jq** for JSON processing (optional but recommended)

### Development Tools
- **FHIR Validator** (HL7 official validator)
- **Inferno DTR Test Suite** (for questionnaire validation)
- **REST Client** (Postman, Insomnia, or VS Code REST Client)

## Quick Start

### 1. Environment Setup

#### Clone Repository
```bash
git clone https://github.com/your-org/fhir-iq-prior-auth.git
cd fhir-iq-prior-auth/implementation
```

#### Start Infrastructure Services
```bash
# Start HAPI FHIR server and PostgreSQL
docker-compose up -d

# Verify services are running
docker-compose ps
```

Expected output:
```
NAME                 COMMAND              SERVICE             STATUS
fpas-fhir-server     "java -jar ..."      fhir-server         running (healthy)
fpas-postgres        "docker-entrypoint..." postgres          running (healthy)
fpas-redis           "redis-server ..."   redis              running (healthy)
```

#### Configure Base URLs
```bash
# Set environment variables
export FHIR_BASE_URL="http://localhost:8080/fhir"
export PAS_API_BASE_URL="http://localhost:3000/fhir"
export DTR_SERVICE_URL="http://localhost:3001"
```

### 2. API Gateway Setup

#### Option A: Node.js/TypeScript Implementation
```bash
cd api-gateway-node
npm install
npm run build

# Configure environment
cp .env.example .env
# Edit .env file with your settings

# Start the API gateway
npm start
```

#### Option B: Java/Spring Boot Implementation
```bash
cd api-gateway-spring
./mvnw clean install

# Configure application properties
cp application-example.yml application.yml
# Edit application.yml with your settings

# Start the API gateway
./mvnw spring-boot:run
```

### 3. Seed Test Data

#### Load Base Resources
```bash
# Load test patients, coverage, and organizations
curl -X POST "$FHIR_BASE_URL/Patient" \
  -H "Content-Type: application/fhir+json" \
  -d @test-fixtures/sample-requests/patient-example.json

curl -X POST "$FHIR_BASE_URL/Coverage" \
  -H "Content-Type: application/fhir+json" \
  -d @test-fixtures/sample-requests/coverage-example.json

curl -X POST "$FHIR_BASE_URL/Organization" \
  -H "Content-Type: application/fhir+json" \
  -d @test-fixtures/sample-requests/provider-example.json
```

#### Load DTR Artifacts
```bash
# Load questionnaire and CQL library
curl -X POST "$FHIR_BASE_URL/Questionnaire" \
  -H "Content-Type: application/fhir+json" \
  -d @../specs/dtr/questionnaires/imaging-lumbar-mri.json

curl -X POST "$FHIR_BASE_URL/Library" \
  -H "Content-Type: application/fhir+json" \
  -d @test-fixtures/cql-libraries/imaging-lumbar-mri-library.json
```

#### Verify Data Loading
```bash
# Check loaded resources
curl "$FHIR_BASE_URL/Patient?name=Patient" | jq '.total'
curl "$FHIR_BASE_URL/Questionnaire?url=http://fhir-iq.com/Questionnaire/imaging-lumbar-mri" | jq '.total'
```

## Testing Workflows

### 1. DTR Questionnaire Workflow

#### Retrieve Questionnaire
```bash
# Get questionnaire for lumbar MRI
curl -X GET "$DTR_SERVICE_URL/Questionnaire?service=lumbar-mri" \
  -H "Accept: application/fhir+json" | jq '.'
```

#### Execute CQL Prepopulation (Mock)
```bash
# POST questionnaire response with prepopulated data
curl -X POST "$FHIR_BASE_URL/QuestionnaireResponse" \
  -H "Content-Type: application/fhir+json" \
  -d @test-fixtures/sample-requests/questionnaire-response-prepopulated.json
```

### 2. Prior Authorization Submission

#### Submit PAS Request
```bash
# Submit complete PAS bundle
curl -X POST "$PAS_API_BASE_URL/Claim/\$submit" \
  -H "Content-Type: application/fhir+json" \
  -H "Authorization: Bearer <access_token>" \
  -d @../specs/fhir/profiles/examples/pas-request-bundle.json \
  -v
```

Expected response (synchronous approval):
```json
{
  "resourceType": "ClaimResponse",
  "status": "active",
  "outcome": "complete",
  "disposition": "Approved",
  "preAuthRef": "PA2025092600123456",
  "preAuthPeriod": {
    "start": "2025-09-26",
    "end": "2026-09-26"
  }
}
```

#### Submit Async Request (Pend Scenario)
```bash
# Submit request that requires manual review
curl -X POST "$PAS_API_BASE_URL/Claim/\$submit" \
  -H "Content-Type: application/fhir+json" \
  -H "Prefer: respond-async" \
  -d @test-fixtures/sample-requests/pas-request-complex.json \
  -v
```

Expected response:
```http
HTTP/1.1 202 Accepted
Content-Location: http://localhost:3000/fhir/Task/task-12345
```

#### Poll for Async Results
```bash
# Check task status
curl -X GET "$PAS_API_BASE_URL/Task/task-12345" \
  -H "Accept: application/fhir+json" | jq '.status'

# Get final result when complete
curl -X GET "$PAS_API_BASE_URL/ClaimResponse?request=Claim/claim-001" \
  -H "Accept: application/fhir+json"
```

### 3. Provider Access API Testing

#### OAuth Authentication (Mock)
```bash
# Get access token (simplified for POC)
ACCESS_TOKEN=$(curl -X POST "$PAS_API_BASE_URL/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=provider-12345&client_secret=secret&scope=user/Claim.read" \
  | jq -r '.access_token')
```

#### Query Prior Authorizations
```bash
# Search by patient
curl -X GET "$PAS_API_BASE_URL/Claim?patient=Patient/patient-example&use=preauthorization" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Accept: application/fhir+json" | jq '.'

# Search with date filter
curl -X GET "$PAS_API_BASE_URL/Claim?patient=Patient/patient-example&_lastUpdated=ge2024-01-01" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Accept: application/fhir+json"
```

### 4. Bulk Export Testing

#### Initiate Export Job
```bash
# Start bulk export for switching members
curl -X POST "$PAS_API_BASE_URL/Group/switching-members-2025/\$export" \
  -H "Content-Type: application/fhir+json" \
  -H "Authorization: Bearer $SYSTEM_TOKEN" \
  -H "Prefer: respond-async" \
  -d '{
    "resourceType": "Parameters",
    "parameter": [
      {
        "name": "_type",
        "valueString": "Patient,Coverage,Claim,ClaimResponse"
      },
      {
        "name": "_since",
        "valueInstant": "2020-01-01T00:00:00Z"
      }
    ]
  }'
```

#### Monitor Export Progress
```bash
# Poll export status
JOB_URL="http://localhost:3000/fhir/bulk-export/job/12345"
curl -X GET "$JOB_URL" \
  -H "Authorization: Bearer $SYSTEM_TOKEN"

# When complete, download files
curl -X GET "https://storage.example.com/exports/job-12345/Patient.ndjson?signature=..." \
  -H "Authorization: Bearer $SYSTEM_TOKEN" \
  -o patient-export.ndjson
```

## Validation and Testing

### 1. FHIR Profile Validation

#### Install FHIR Validator
```bash
# Download HL7 FHIR Validator
wget https://github.com/hapifhir/org.hl7.fhir.core/releases/latest/download/validator_cli.jar
```

#### Validate PAS Bundle
```bash
# Validate request bundle against PAS IG
java -jar validator_cli.jar \
  ../specs/fhir/profiles/examples/pas-request-bundle.json \
  -version 4.0.1 \
  -ig hl7.fhir.us.davinci-pas
```

#### Validate DTR Questionnaire
```bash
# Validate questionnaire against DTR IG
java -jar validator_cli.jar \
  ../specs/dtr/questionnaires/imaging-lumbar-mri.json \
  -version 4.0.1 \
  -ig hl7.fhir.us.davinci-dtr
```

### 2. Inferno DTR Testing

#### Setup Inferno
```bash
# Clone and start Inferno DTR test suite
git clone https://github.com/inferno-framework/davinci-dtr-test-kit.git
cd davinci-dtr-test-kit
docker-compose up -d
```

#### Run DTR Tests
1. Navigate to `http://localhost:4567`
2. Configure test session:
   - **FHIR Endpoint**: `http://host.docker.internal:8080/fhir`
   - **DTR Endpoint**: `http://host.docker.internal:3001`
3. Run questionnaire retrieval tests
4. Validate CQL expression execution

### 3. End-to-End Testing

#### Test Script: Complete PA Workflow
```bash
#!/bin/bash
set -e

echo "=== FPAS End-to-End Test ==="

# 1. Load test data
echo "Loading test data..."
PATIENT_ID=$(curl -s -X POST "$FHIR_BASE_URL/Patient" \
  -H "Content-Type: application/fhir+json" \
  -d @test-fixtures/sample-requests/patient-example.json \
  | jq -r '.id')

# 2. Submit PA request
echo "Submitting PA request..."
RESPONSE=$(curl -s -X POST "$PAS_API_BASE_URL/Claim/\$submit" \
  -H "Content-Type: application/fhir+json" \
  -d @../specs/fhir/profiles/examples/pas-request-bundle.json)

# 3. Verify response
STATUS=$(echo "$RESPONSE" | jq -r '.disposition')
AUTH_NUMBER=$(echo "$RESPONSE" | jq -r '.preAuthRef')

echo "PA Status: $STATUS"
echo "Authorization Number: $AUTH_NUMBER"

if [ "$STATUS" = "Approved" ]; then
    echo "✅ End-to-end test PASSED"
else
    echo "❌ End-to-end test FAILED"
    echo "$RESPONSE" | jq '.'
fi
```

## Error Testing and Debugging

### 1. Common Error Scenarios

#### Invalid Request Format
```bash
# Test with missing required field
curl -X POST "$PAS_API_BASE_URL/Claim/\$submit" \
  -H "Content-Type: application/fhir+json" \
  -d '{
    "resourceType": "Bundle",
    "type": "collection",
    "entry": []
  }' \
  -v
```

Expected: HTTP 400 with OperationOutcome

#### Authorization Failure
```bash
# Test with invalid token
curl -X GET "$PAS_API_BASE_URL/Claim?patient=Patient/patient-example" \
  -H "Authorization: Bearer invalid-token" \
  -v
```

Expected: HTTP 401 with authentication error

#### Provider Attribution Error
```bash
# Test with non-attributed provider
curl -X POST "$PAS_API_BASE_URL/Claim/\$submit" \
  -H "Authorization: Bearer $VALID_TOKEN" \
  -d @test-fixtures/sample-requests/pas-request-wrong-provider.json \
  -v
```

Expected: HTTP 403 with provider attribution error

### 2. Debugging Tools

#### Enable Debug Logging
```bash
# Node.js implementation
export LOG_LEVEL=debug
export DEBUG=fpas:*

# Spring Boot implementation
export LOGGING_LEVEL_COM_FHIRIQ=DEBUG
```

#### Monitor FHIR Server Logs
```bash
# View HAPI FHIR logs
docker-compose logs -f fhir-server

# View specific operations
docker-compose logs fhir-server | grep "POST.*Claim"
```

#### Database Inspection
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U fhir_user -d fhir_db

# Query recent transactions
SELECT * FROM hfj_res_link WHERE updated > NOW() - INTERVAL '1 hour';
```

## Performance Testing

### 1. Load Testing with Artillery

#### Install Artillery
```bash
npm install -g artillery
```

#### PA Submission Load Test
```yaml
# load-test-pas.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "PA Submission"
    requests:
      - post:
          url: "/fhir/Claim/$submit"
          headers:
            Content-Type: "application/fhir+json"
            Authorization: "Bearer test-token"
          json:
            resourceType: "Bundle"
            type: "collection"
            entry: []
```

#### Run Load Test
```bash
artillery run load-test-pas.yml
```

### 2. Performance Monitoring

#### API Response Times
```bash
# Monitor endpoint performance
curl -w "@curl-format.txt" -o /dev/null -s "$PAS_API_BASE_URL/Claim/\$submit" \
  -X POST -H "Content-Type: application/fhir+json" \
  -d @../specs/fhir/profiles/examples/pas-request-bundle.json
```

#### Resource Usage
```bash
# Monitor container resource usage
docker stats fpas-fhir-server fpas-postgres fpas-redis
```

## Production Readiness Checklist

### Security
- [ ] Replace mock OAuth with production identity provider
- [ ] Implement proper JWT validation with certificate chains
- [ ] Enable HTTPS/TLS for all endpoints
- [ ] Configure rate limiting and API throttling
- [ ] Implement audit logging for all operations

### Scalability
- [ ] Configure load balancer for API gateway
- [ ] Set up database connection pooling
- [ ] Implement Redis clustering for session storage
- [ ] Configure horizontal pod autoscaling
- [ ] Set up database read replicas

### Monitoring
- [ ] Deploy application performance monitoring (APM)
- [ ] Configure health check endpoints
- [ ] Set up alerting for error rates and response times
- [ ] Implement business metrics dashboard
- [ ] Configure log aggregation and analysis

### Compliance
- [ ] Complete HIPAA compliance assessment
- [ ] Implement data encryption at rest
- [ ] Configure secure backup and recovery
- [ ] Document security controls and procedures
- [ ] Conduct penetration testing

## Troubleshooting

### Common Issues

#### "FHIR server not responding"
```bash
# Check container status
docker-compose ps

# Restart services
docker-compose restart fhir-server

# Check logs
docker-compose logs fhir-server
```

#### "Profile validation failed"
- Verify FHIR IG packages are loaded
- Check resource meta.profile references
- Validate against base FHIR R4 specification

#### "OAuth token invalid"
- Check token expiration
- Verify client credentials
- Confirm required scopes are granted

### Support Resources

- **FHIR Community Chat**: https://chat.fhir.org/
- **Da Vinci Implementation Guides**: http://hl7.org/fhir/us/davinci/
- **HAPI FHIR Documentation**: https://hapifhir.io/
- **Inferno Testing**: https://inferno.healthit.gov/

## Next Steps

1. **Review Business Requirements**: See `.specify/` folder for detailed requirements
2. **Choose Tech Stack**: Implement either Node.js or Java version based on team preferences
3. **Security Integration**: Replace mock authentication with production OAuth provider
4. **UM Engine Integration**: Connect to real utilization management system
5. **Production Deployment**: Follow production readiness checklist above

For detailed technical specifications, see the parent directory documentation and FHIR Implementation Guides referenced throughout this system.