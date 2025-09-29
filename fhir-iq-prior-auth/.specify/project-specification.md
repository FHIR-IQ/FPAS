# Project Specification - FHIR Prior Authorization POC

## Executive Summary

Create a payer-focused FHIR Prior Authorization POC demonstrating compliance with CMS-0057-F interoperability requirements using HL7 Da Vinci PAS/DTR Implementation Guides.

## Core Objectives

### Primary Goals
- **FHIR PAS Operations**: Implement Claim/$submit and Claim/$inquire operations
- **DTR Integration**: Minimal questionnaire with CQL-based prepopulation
- **Provider/Patient Access**: Read APIs for authorization history
- **Payer-to-Payer Export**: Bulk data export scaffold for member switching
- **CMS Compliance**: Demonstrate path to CMS-0057-F requirements

### Explicit Non-Goals
- **Production UM Integration**: Use mock decision engine with simple rules
- **Full CRD Implementation**: Basic hooks only, not complete CRD service
- **Multi-tenant Architecture**: Single payer configuration for POC
- **Production Security**: Simplified OAuth with static allowlists

## Technical Scope

### FHIR Operations
1. **POST [base]/Claim/$submit** - Submit prior authorization requests
2. **GET [base]/Claim/$inquire** - Query authorization status
3. **GET [base]/Claim** - Provider/Patient access to PA history
4. **POST [base]/Group/[id]/$export** - Payer-to-payer bulk export

### DTR Implementation
- Single questionnaire: Lumbar MRI prior authorization
- CQL library with basic clinical logic (conservative therapy, neurologic deficit)
- Prepopulation demonstration with mock EHR data

### Data Standards
- **FHIR R4 (4.0.1)** as base specification
- **Da Vinci PAS IG STU 2.0.1** for prior authorization profiles
- **Da Vinci DTR IG STU 2.0** for questionnaire and CQL
- **US Core 3.1.1** for patient demographics and provider data

## Success Criteria

### Functional Requirements
- ✅ End-to-end PA submission with automated decision
- ✅ DTR questionnaire with CQL prepopulation
- ✅ Provider access to PA history with proper authorization
- ✅ Patient access to their authorization data
- ✅ Bulk export operation for member switching scenarios

### Technical Requirements
- ✅ All FHIR resources validate against IG profiles
- ✅ OAuth 2.0 authentication with SMART on FHIR v2 scopes
- ✅ Async processing with progress tracking
- ✅ Error handling with proper OperationOutcome responses
- ✅ Performance targets: <2s sync operations, <1s searches

### Compliance Requirements
- ✅ Pass relevant Inferno DTR test scenarios
- ✅ FHIR profile validation in CI/CD pipeline
- ✅ Audit logging for all data access
- ✅ Basic rate limiting and security controls

## Business Context

### Value Proposition
- **Provider Burden Reduction**: Automated documentation collection via DTR
- **Real-time Decisions**: Immediate PA responses for qualifying procedures
- **Transparency**: Provider and patient visibility into authorization status
- **Interoperability**: Standards-based data exchange between payers

### Stakeholders
- **Providers/EHRs**: Submit PA requests, retrieve authorization status
- **Payers/UM Teams**: Process requests, return timely decisions
- **Patients**: View PA status via patient access APIs
- **Regulators**: Demonstrate CMS-0057-F compliance path

## Technical Architecture

### System Components
```
EHR System → API Gateway → FHIR Server → UM Engine
                ↓              ↓          ↓
         OAuth Provider    Database    Queue System
```

### Tech Stack Alignment
- **API Gateway**: Node.js/TypeScript with Fastify
- **FHIR Storage**: HAPI FHIR JPA Server (Docker)
- **Queue Processing**: BullMQ with Redis
- **Authentication**: OpenID Connect mock issuer
- **Validation**: fhir-validator CLI in CI
- **Documentation**: Mermaid diagrams

## Risk Mitigation

### Technical Risks
- **FHIR Complexity**: Use established libraries (HAPI FHIR, @types/fhir)
- **DTR/CQL Learning Curve**: Start with simplified questionnaire
- **Performance**: Design for async processing from day 1

### Schedule Risks
- **Scope Creep**: Maintain strict POC boundaries
- **Integration Complexity**: Use mocks aggressively
- **Testing Time**: Automate validation early

## Deliverables

### Phase 1: Foundation (Weeks 1-2)
- FHIR server deployment with basic profiles
- API gateway scaffolding with OAuth mock
- Basic PAS operation stubs

### Phase 2: Core Operations (Weeks 3-4)
- Claim/$submit operation with validation
- Mock UM engine with simple approval rules
- Async processing with Task resources

### Phase 3: DTR Integration (Weeks 5-6)
- Questionnaire serving with CQL library
- Prepopulation logic and validation
- End-to-end DTR workflow

### Phase 4: Access APIs (Weeks 7-8)
- Provider Access API with OAuth scopes
- Patient Access API implementation
- Bulk export operation scaffold

### Phase 5: Validation & Testing (Weeks 9-10)
- FHIR profile validation automation
- Inferno DTR test integration
- Performance testing and optimization

## Quality Assurance

### Testing Strategy
- **Unit Tests**: 80%+ code coverage for business logic
- **Integration Tests**: End-to-end workflow validation
- **Profile Validation**: Automated FHIR IG compliance checking
- **Performance Tests**: Load testing for concurrent operations

### Validation Tools
- **HL7 FHIR Validator**: Profile compliance in CI/CD
- **Inferno DTR Suite**: Questionnaire and CQL validation
- **Custom Test Suite**: PAS-specific operation testing
- **Load Testing**: Artillery for performance validation

## Success Metrics

### POC Completion Criteria
- [ ] End-to-end PA submission working with mock approval
- [ ] DTR questionnaire with CQL prepopulation functional
- [ ] Provider/Patient Access APIs returning proper data
- [ ] Bulk export operation initiating and completing
- [ ] Pass core Inferno DTR tests
- [ ] Meet performance targets (<2s sync, <1s search)
- [ ] Complete API documentation and deployment guide

### Demo Readiness
- [ ] Clean UI for PA submission workflow
- [ ] Status dashboard showing authorization pipeline
- [ ] Test scenarios demonstrating key capabilities
- [ ] Performance metrics visible and meeting targets
- [ ] Reproducible deployment process documented