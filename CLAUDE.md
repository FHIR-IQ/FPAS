# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **FHIR IQ Prior Authorization System (FPAS)** - a comprehensive FHIR-based Prior Authorization POC implementing:
- **FHIR PAS (Prior Authorization Support) IG** for authorization requests/responses
- **FHIR DTR (Documentation Templates and Rules) IG** for intelligent questionnaires
- **SMART on FHIR v2** for secure authentication and authorization
- **X12 278** transaction mapping for legacy system integration
- **Bulk FHIR Operations** for payer-to-payer data exchange

## Repository Structure

```
fhir-iq-prior-auth/
├── .specify/                    # Business requirements and technical specifications
│   ├── plan.md                 # Implementation plan with tech stack options
│   ├── proposal.md             # Business proposal and POC scope
│   └── acceptance-criteria.md  # Detailed acceptance criteria
├── specs/                      # Technical specifications
│   ├── fhir/                   # FHIR profiles, operations, capability statements
│   │   ├── profiles/           # FHIR profile examples (no custom profiles)
│   │   ├── operations/         # $submit and $inquire operation definitions
│   │   └── capabilitystatements/ # PAS and Provider Access capabilities
│   ├── dtr/                    # DTR questionnaires and CQL libraries
│   ├── security/               # OAuth/SMART authentication specs
│   ├── openapi/                # REST API specifications
│   └── mappings/               # X12 278 mapping specifications
├── implementation/             # Reference implementation code (when added)
│   └── test-fixtures/          # Sample FHIR resources for testing
└── diagrams/                   # Architecture and workflow diagrams
```

## Key Architecture Components

### Core FHIR Operations
- **Claim/$submit**: Submit prior authorization requests (PAS Bundle)
- **Claim/$inquire**: Query authorization status and decisions
- **Provider Access API**: Query historical PA decisions by service type
- **Patient Access API**: Patient view of their PA history

### DTR Integration
- Dynamic questionnaire generation based on coverage requirements
- CQL (Clinical Quality Language) for automated data extraction
- SMART app launch for provider EHR integration
- Questionnaire prepopulation via $populate operation

### Implementation Guides Referenced
- [HL7 FHIR PAS IG](http://hl7.org/fhir/us/davinci-pas/) - Prior Authorization Support
- [HL7 FHIR DTR IG](http://hl7.org/fhir/us/davinci-dtr/) - Documentation Templates and Rules
- [HL7 FHIR PDex IG](http://hl7.org/fhir/us/davinci-pdex/) - Payer Data Exchange
- [SMART App Launch v2](http://hl7.org/fhir/smart-app-launch/) - Authentication

## Development Approach

### Profile Strategy
- **No custom FHIR profiles** - POC uses existing IG profiles
- Validate against published Da Vinci PAS/DTR profiles
- Reference profiles via canonical URLs in resource.meta.profile
- Examples in `specs/fhir/profiles/examples/`

### Tech Stack Options (from plan.md)
Two primary options identified:
1. **Node.js/TypeScript**: Fastify, @types/fhir, node-fhir-server-core, bullmq
2. **Java/Spring Boot**: HAPI FHIR JPA Server, Spring Security OAuth

### POC Scope (Non-Goals)
- No full production UM integration (mock decision engine)
- No complete CRD hooks service (basic order-select only)
- No full security policy orchestration (simplified auth)
- No X12 278 bidirectional gateway (one-way mapping demo)
- Single payer configuration (no multi-tenant)

## Testing Strategy

### Validation Requirements
- All FHIR resources must validate against base R4 + applicable IG profiles
- Use FHIR validator: `fhir-validator -profile [resource] -ig hl7.fhir.us.davinci-pas`
- Inferno DTR test suite integration for questionnaire validation
- Custom PAS operation tests

### Performance Targets
- Synchronous operations: < 2 seconds
- Search operations: < 1 second
- Support 10 concurrent PA submissions
- Support 50 concurrent status queries

### Required Test Scenarios
- Simple auto-approval case
- Complex case requiring manual review
- Denial with specific reasons
- Missing documentation scenario
- Edge cases (timeout, retry)

## Security & Compliance

### OAuth 2.0 / SMART on FHIR v2
- Client credentials flow for system access
- Authorization code flow for SMART apps
- POC scopes: `user/*.read`, `patient/*.read` (simplified)
- Production scopes: `user/Claim.read`, `user/ClaimResponse.read`, etc. (granular)
- Required token claims: organization ID, purpose-of-use
- Static allowlist enforcement for POC validation

### Standards Compliance
- FHIR R4 (4.0.1)
- X12 278 (5010)
- OAuth 2.0 / OpenID Connect
- CQL 1.5

## Key File Locations

### Business Requirements
- `.specify/proposal.md` - Business case and POC scope
- `.specify/plan.md` - Technical implementation plan with architecture options
- `.specify/acceptance-criteria.md` - Detailed functional requirements

### FHIR Specifications
- `specs/fhir/operations/claim-$submit.operation.json` - PA submission operation
- `specs/fhir/operations/claim-$inquire.operation.json` - Status inquiry operation
- `specs/fhir/profiles/examples/` - Sample PAS request/response bundles

### Implementation References
- `implementation/test-fixtures/` - Sample FHIR resources for development/testing
- `specs/dtr/questionnaires/` - DTR questionnaire definitions
- `specs/dtr/libraries/` - CQL libraries for data extraction

### DTR Artifacts (POC Implementation)
- `specs/dtr/questionnaires/imaging-lumbar-mri.json` - Lumbar MRI authorization questionnaire with CQL-based prepopulation
- `specs/dtr/libraries/imaging-lumbar-mri.cql` - CQL library for automated data extraction from EHR

#### DTR Implementation Notes
- **Questionnaire Features**: Clinical indication selection, conservative therapy validation, neurologic deficit assessment
- **CQL Functions**: `ExistsFailedConservativeTx()`, `HasNeuroDeficit()`, `HasPriorLumbarImaging()`, `HasRedFlagSymptoms()`
- **POC Limitations**: Simplified value sets, mock EHR data sources, basic prepopulation logic
- **Production Path**: Requires proper terminology bindings, EHR FHIR API integration, enhanced CQL expressions

### PAS Bundle Examples (POC Implementation)
- `specs/fhir/profiles/examples/pas-request-bundle.json` - Complete prior authorization request with DTR questionnaire response
- `specs/fhir/profiles/examples/pas-response-bundle.json` - Authorization response with decision and communication

#### PAS Bundle Features
- **Request Bundle**: Patient, Provider, Coverage, Claim with lumbar MRI (CPT 72148), completed DTR QuestionnaireResponse
- **Response Bundle**: ClaimResponse with approval, authorization number, benefit adjudication, process notes, communication request
- **Profile Compliance**: All resources reference appropriate Da Vinci PAS/DTR and US Core profiles
- **End-to-End Flow**: Demonstrates complete authorization workflow from submission through decision communication

### Security & OAuth Scopes (POC Implementation)
- `specs/security/oauth-scopes-smartv2.md` - SMART on FHIR v2 OAuth scopes and security model

#### Security Implementation Features
- **Provider Access**: `user/*.read`, `patient/*.read` (POC) → granular `user/Claim.read`, `user/ClaimResponse.read` (production)
- **PA Submission**: `user/Claim.write` or `system/Claim.write` for EHR-to-payer server-to-server
- **Patient Access**: `patient/*.read` via user-consented applications
- **Token Claims**: Required organization ID and purpose-of-use validation
- **POC Enforcement**: Static allowlist for organization validation and scope checking

### Payer-to-Payer Bulk Export (POC Implementation)
- `specs/bulk/payer-to-payer-export.md` - FHIR Bulk Data export for member switching scenarios

#### Bulk Export Features
- **$export Operation**: Support for Group-based export with `_type` filtering (Patient, Coverage, Claim, ClaimResponse, Encounter, Observation, etc.)
- **Incremental Export**: `_since` cursor support with minimum 5-year lookback window for switching members
- **Async Workflow**: 7-day fulfillment SLA with progress tracking and signed URL delivery
- **NDJSON Format**: Newline-delimited JSON output per resource type with comprehensive member data
- **Security Model**: OAuth 2.0 system scopes with payer authorization and data use agreements

### Error Handling & OperationOutcome (POC Implementation)
- `specs/errors/operationoutcome-catalog.md` - Standardized error model with FHIR OperationOutcome patterns

#### Error Model Features
- **Validation Errors**: HTTP 400 + `invalid` code for missing required PAS elements, profile validation failures
- **Authorization Errors**: HTTP 403 + `forbidden` code for provider not attributed to member, insufficient scopes
- **Processing Errors**: HTTP 503 + `processing` code for UM engine temporary failures with retry-after headers
- **Information Required**: HTTP 200 + `information-required` code with CommunicationRequest guidance for pended decisions
- **Comprehensive Catalog**: Operation-specific error patterns for Claim/$submit, DTR, bulk export, with client retry guidance

### Workflow Diagrams (Mermaid)
- `diagrams/pa-end-to-end.mmd` - Complete prior authorization workflow from DTR questionnaire through UM decision
- `diagrams/provider-access.mmd` - Provider Access API authentication and PA data retrieval workflow
- `diagrams/payer-to-payer-bulk.mmd` - Bulk export workflow for member switching scenarios with async processing

#### Diagram Features
- **End-to-End PA Flow**: DTR questionnaire retrieval → CQL prepopulation → PAS submission → UM processing → authorization decision
- **Provider Access Pattern**: OAuth 2.0 authentication → FHIR API queries → provider attribution validation → audit logging
- **Bulk Export Process**: Member consent → Group-based export → async job processing → signed URL delivery → data integration

## Getting Started

1. Review `.specify/proposal.md` for business context and POC scope
2. Read `.specify/plan.md` for technical architecture and implementation options
3. Examine `.specify/acceptance-criteria.md` for detailed functional requirements
4. Check `specs/fhir/profiles/examples/` for sample FHIR resources
5. Follow `implementation/README.md` for POC setup and testing walkthrough
6. Review referenced Implementation Guide documentation for FHIR profiles and operations

## Implementation Quick Start

### Prerequisites
- Docker & Docker Compose (v20.10+)
- Node.js (v18+) OR Java 17+ (depending on tech stack choice)
- FHIR Validator and Inferno DTR test suite for validation

### POC Setup Steps
1. **Infrastructure**: `docker-compose up -d` (HAPI FHIR, PostgreSQL, Redis)
2. **API Gateway**: Start Node.js/TypeScript or Java/Spring Boot implementation
3. **Test Data**: Seed patients, coverage, DTR questionnaires, and CQL libraries
4. **Validation**: Submit PAS requests via curl, observe async decisions, run FHIR validator
5. **Testing**: Execute DTR workflow, Provider Access API, bulk export scenarios

### Key Testing Commands
```bash
# Submit PA request
curl -X POST "$PAS_API_BASE_URL/Claim/\$submit" -d @pas-request-bundle.json

# Query provider access
curl "$PAS_API_BASE_URL/Claim?patient=Patient/123&use=preauthorization"

# Validate FHIR resources
java -jar validator_cli.jar pas-request-bundle.json -ig hl7.fhir.us.davinci-pas
```

See `implementation/README.md` for complete setup instructions, testing scenarios, and troubleshooting guidance.