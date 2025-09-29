# Acceptance Criteria - FHIR IQ Prior Authorization POC

## Core PA Submission

### ✅ POST Claim/$submit with PAS-conformant Bundle
**GIVEN** a valid PAS request Bundle containing Claim and supporting resources
**WHEN** posted to `/Claim/$submit` endpoint
**THEN** system returns:
- ClaimResponse with disposition (approved/pended/denied)
- Authorization number in response
- Appropriate HTTP status (200 for sync, 202 for async)
- Valid OperationOutcome for errors

### ✅ Async Processing with Task
**GIVEN** a PA request requiring manual review
**WHEN** submitted via $submit operation
**THEN** system returns:
- Task resource with status "requested"
- Polling URL in Task.id
- Updates Task.status as processing continues
- Final ClaimResponse linked when complete

## PA Status Inquiry

### ✅ Retrieve PA Status via Polling
**GIVEN** an existing authorization request
**WHEN** calling `/Claim/$inquire` with authorization reference
**THEN** system returns:
- Current ClaimResponse with latest status
- Task status if still processing
- Decision reasons if available
- Processing time remaining (if pended)

### ✅ Search by Multiple Criteria
**GIVEN** authorized provider credentials
**WHEN** searching `/Claim` or `/ClaimResponse`
**THEN** system supports:
- Filter by patient reference
- Filter by date range
- Filter by status
- Pagination with _count
- Sorting by created date

## DTR Integration

### ✅ Fetch and Render Questionnaire
**GIVEN** a service requiring documentation
**WHEN** DTR app requests questionnaire
**THEN** system provides:
- FHIR Questionnaire resource
- Associated CQL library
- Prepopulation via $populate operation
- Value sets for coded answers

### ✅ CQL Prepopulation
**GIVEN** a questionnaire with CQL expressions
**WHEN** $populate is called with patient context
**THEN** system returns:
- QuestionnaireResponse with prepopulated answers
- Data sourced from mock EHR
- Calculated fields evaluated
- Remaining required fields identified

## Provider Access API

### ✅ Provider Can Query Member Claims
**GIVEN** provider with valid OAuth token
**WHEN** accessing Provider Access endpoints
**THEN** provider can:
- Search claims by member ID
- View authorization decisions
- Access related resources via _include
- See historical PA data

### ✅ Appropriate Access Control
**GIVEN** provider authentication
**WHEN** accessing patient data
**THEN** system enforces:
- Provider can only see their patients
- Appropriate SMART scopes required
- Audit log entry created
- Rate limiting applied

## Patient Access API

### ✅ Patient Views Own PA History
**GIVEN** patient with SMART app authorization
**WHEN** accessing Patient Access API
**THEN** patient can:
- See their PA requests
- View authorization status
- Access decision details
- Export data if needed

## FHIR Validation

### ✅ All Resources Pass Profile Validation
**GIVEN** any FHIR resource in request/response
**WHEN** validated against profiles
**THEN** resource conforms to:
- Base FHIR R4 spec
- US Core profiles where applicable
- Da Vinci PAS profiles
- Required terminology bindings

### ✅ OperationOutcome for Errors
**GIVEN** invalid input or system error
**WHEN** operation fails
**THEN** system returns:
- Appropriate HTTP status code
- OperationOutcome with issue details
- Severity and code populated
- Human-readable diagnostics

## Performance Requirements

### ✅ Response Time SLAs
- Synchronous operations: < 2 seconds
- Search operations: < 1 second
- Questionnaire load: < 2 seconds
- CQL execution: < 1 second

### ✅ Concurrent Users
- Support 10 concurrent PA submissions
- Handle 50 concurrent status queries
- Maintain response times under load

## Security & Compliance

### ✅ OAuth 2.0 Implementation
**GIVEN** client application
**WHEN** requesting access
**THEN** system supports:
- Client credentials flow
- Authorization code flow (for SMART apps)
- JWT token validation
- Scope enforcement

### ✅ SMART on FHIR Scopes
- `user/Claim.read` for provider access
- `patient/Claim.read` for patient access
- `system/Claim.write` for PA submission
- Appropriate scope combinations

## Testing & Quality

### ✅ Inferno Test Compliance
**GIVEN** Inferno DTR test suite
**WHEN** run against POC
**THEN** system passes:
- Basic FHIR operations
- DTR questionnaire retrieval
- Profile validation tests
- Required search parameters

### ✅ Test Data Scenarios
- Simple auto-approval case
- Complex case requiring review
- Denial with specific reasons
- Missing documentation scenario
- Edge cases (timeout, retry)

## Documentation

### ✅ Complete API Documentation
- OpenAPI spec for all endpoints
- FHIR operation definitions
- Authentication flow diagrams
- Example requests/responses
- Error code reference

### ✅ Implementation Guide
- Setup instructions
- Configuration guide
- Deployment steps
- Architecture overview
- Security considerations

## Demo Requirements

### ✅ Working Demo Application
**GIVEN** demo UI
**WHEN** demonstrating POC
**THEN** can show:
- PA submission flow
- Status checking
- DTR questionnaire completion
- Provider and patient views
- Metrics dashboard

### ✅ Test Data Available
- Pre-loaded patients
- Sample providers
- Coverage information
- Various PA scenarios
- Reset capability

## POC Success Metrics

### ✅ Functional Completeness
- [ ] End-to-end PA submission working
- [ ] Status inquiry operational
- [ ] DTR integration functional
- [ ] Access APIs implemented
- [ ] Mock UM decisions generated

### ✅ Technical Quality
- [ ] All tests passing in CI
- [ ] Code coverage > 70%
- [ ] No critical security issues
- [ ] Performance targets met
- [ ] Clean deployment process

### ✅ Demonstrability
- [ ] Can demo to stakeholders
- [ ] Clear value proposition shown
- [ ] CMS compliance path evident
- [ ] Extension points identified
- [ ] Production roadmap defined