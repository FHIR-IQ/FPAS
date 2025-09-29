# Tasks - FHIR IQ Prior Authorization POC

## Setup & Infrastructure

- [ ] Scaffold repo with chosen stack (Node/TS or Java/Spring)
- [ ] Set up CI pipeline (GitHub Actions/GitLab CI)
- [ ] Add code formatter (Prettier/Spotless) and linter (ESLint/Checkstyle)
- [ ] Create Docker compose for local development
- [ ] Add Spec Kit docs & initial README
- [ ] Set up project structure and module boundaries

## FHIR Conformance

- [ ] Define CapabilityStatement for Payer PAS server
- [ ] Define CapabilityStatement for Provider Access API
- [ ] Create OperationDefinition for Claim/$submit
- [ ] Create OperationDefinition for Claim/$inquire
- [ ] Document supported FHIR profiles (US Core, PAS)
- [ ] Add resource validation schemas

## API Gateway & Routing

- [ ] Implement base FHIR server endpoints
- [ ] Add OpenAPI spec for operation paths
- [ ] Configure request validation middleware
- [ ] Set up error handling and OperationOutcome generation
- [ ] Implement request/response logging
- [ ] Add CORS configuration

## PAS Operations

### Claim/$submit Implementation
- [ ] Parse and validate PAS request Bundle
- [ ] Extract Claim and supporting resources
- [ ] Implement synchronous response path
- [ ] Implement asynchronous response with Task
- [ ] Generate authorization numbers
- [ ] Create ClaimResponse with decision

### Claim/$inquire Implementation
- [ ] Accept authorization reference
- [ ] Query status from data store
- [ ] Return current ClaimResponse
- [ ] Include Task status if async
- [ ] Add filtering by date/status

## DTR Module

### Questionnaire Management
- [ ] Create sample Questionnaire for lumbar MRI
- [ ] Add conditional logic and skip patterns
- [ ] Define value sets for coded answers
- [ ] Implement questionnaire versioning
- [ ] Add $populate operation stub

### CQL Integration
- [ ] Set up CQL execution engine
- [ ] Create sample CQL library for prepopulation
- [ ] Mock EHR data retrieval
- [ ] Implement expression evaluation
- [ ] Cache compiled libraries

### SMART App Support
- [ ] Implement launch sequence handler
- [ ] Generate launch context
- [ ] Mock patient/provider selection
- [ ] Return access token with DTR scopes

## Mock UM Engine

- [ ] Define simple rule set (auto-approve/pend/deny)
- [ ] Check service codes against rule list
- [ ] Validate member eligibility (mock)
- [ ] Apply authorization limits
- [ ] Generate decision reasons
- [ ] Add configurable processing delay

## Provider Access API

- [ ] Implement /Claim search by patient
- [ ] Add /ClaimResponse search by request
- [ ] Support _include for related resources
- [ ] Add date range filtering
- [ ] Implement pagination
- [ ] Add sorting by created date

## Patient Access API

- [ ] Implement /Claim search for patient's own records
- [ ] Add /ClaimResponse patient search
- [ ] Filter by authorization status
- [ ] Include coverage information
- [ ] Add consent check (mock)
- [ ] Support SMART patient scopes

## Processing Pipeline

- [ ] Set up job queue (BullMQ/Spring Batch)
- [ ] Create worker for async PA processing
- [ ] Implement status transition logic
- [ ] Add retry mechanism for failures
- [ ] Create notification dispatcher (stub)
- [ ] Add job monitoring endpoint

## Security Implementation

- [ ] Set up OAuth 2.0 authorization server (mock)
- [ ] Define SMART on FHIR v2 scopes
- [ ] Implement JWT token validation
- [ ] Add backend service authentication
- [ ] Create scope enforcement middleware
- [ ] Add rate limiting per client

## Data Persistence

- [ ] Set up HAPI FHIR JPA server or equivalent
- [ ] Configure PostgreSQL schema
- [ ] Add indexes for common queries
- [ ] Implement audit log table
- [ ] Create migration scripts
- [ ] Add Redis for caching

## Validation & Testing

### FHIR Profile Validation
- [ ] Integrate FHIR validator library
- [ ] Add PAS profile validation
- [ ] Validate US Core compliance
- [ ] Check terminology bindings
- [ ] Add custom business rules

### Test Fixtures
- [ ] Create sample PAS request Bundles
- [ ] Generate PAS response Bundles
- [ ] Add DTR QuestionnaireResponses
- [ ] Create test patient data
- [ ] Generate provider credentials
- [ ] Add coverage scenarios

### Automated Testing
- [ ] Write unit tests for operations
- [ ] Add integration tests for API
- [ ] Create end-to-end test scenarios
- [ ] Add FHIR validation tests
- [ ] Implement load tests
- [ ] Set up test coverage reporting

### Inferno Integration
- [ ] Configure Inferno DTR test suite
- [ ] Map POC endpoints to test requirements
- [ ] Fix failing test cases
- [ ] Document test results
- [ ] Add to CI pipeline

## Monitoring & Metrics

- [ ] Create metrics collection service
- [ ] Track API response times
- [ ] Monitor authorization decisions
- [ ] Calculate SLA compliance
- [ ] Add health check endpoints
- [ ] Create basic dashboard (JSON/HTML)

## Documentation

### API Documentation
- [ ] Generate OpenAPI spec
- [ ] Document FHIR operations
- [ ] Add authentication guide
- [ ] Create example requests
- [ ] Document error codes
- [ ] Add troubleshooting section

### Implementation Guide
- [ ] Write setup instructions
- [ ] Document configuration options
- [ ] Add deployment guide
- [ ] Create architecture diagrams
- [ ] Document data flows
- [ ] Add security considerations

## Demo Application

- [ ] Create simple web UI for PA submission
- [ ] Add status checking interface
- [ ] Implement DTR questionnaire renderer
- [ ] Add provider login flow
- [ ] Create patient view
- [ ] Add test data loader

## Deployment

- [ ] Create container images
- [ ] Write Kubernetes manifests or cloud configs
- [ ] Set up cloud environment (sandbox)
- [ ] Configure environment variables
- [ ] Deploy to cloud
- [ ] Run smoke tests

## Project Management

- [ ] Set up issue tracking
- [ ] Create sprint boards
- [ ] Schedule demo sessions
- [ ] Prepare status reports
- [ ] Document decisions
- [ ] Maintain risk log

## Phase 2 Preparation (Post-POC)

- [ ] Document production requirements
- [ ] Identify UM system integration points
- [ ] Plan CRD hooks implementation
- [ ] Design multi-tenant architecture
- [ ] Scope X12 278 gateway
- [ ] Estimate production timeline