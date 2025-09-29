# Implementation Plan - FHIR IQ Prior Authorization POC

## Architecture Choices (POC)

### Core Components

**API Gateway**
- FHIR R4-capable service exposing PAS operations and read APIs for Provider/Patient Access
- REST endpoints for FHIR operations ($submit, $inquire)
- OpenAPI documentation for non-FHIR clients
- Request validation and routing

**Data Layer**
- OSS FHIR server (HAPI FHIR) as persistence tier
- Store PA Bundles, Claim/ClaimResponse, Questionnaire/QuestionnaireResponse
- PostgreSQL for relational data and audit logs
- Redis for caching and session management

**Orchestration**
- Event-driven queue to simulate PA processing
- Mock UM engine with configurable rules
- Async job processing for long-running operations
- Status tracking and notification system

**DTR Module**
- Serve Questionnaire + CQL definitions
- SMART launch context management
- Prepopulation via EHR FHIR (simulated in POC)
- QuestionnaireResponse validation

**Security**
- SMART on FHIR v2-style OAuth scopes
- Static consent toggles for POC
- JWT token validation
- Basic rate limiting

**Testing**
- Inferno DTR test kit integration
- FHIR profile validation in CI
- Automated end-to-end test scenarios
- Load testing harness

## Tech Stack Options

### Option A: Node.js/TypeScript Stack

**Framework & Libraries**
```
- Fastify: High-performance web framework
- @types/fhir: TypeScript FHIR type definitions
- node-fhir-server-core: FHIR server scaffolding
- ajv: JSON schema validation
- bullmq: Redis-based queue for background jobs
```

**Why This Stack**
- Fast development with TypeScript safety
- Excellent FHIR library ecosystem
- Easy async/await patterns for orchestration
- Strong community support

**Project Structure**
```
/src
  /api         # FHIR endpoints
  /operations  # $submit, $inquire implementations
  /dtr         # DTR questionnaire engine
  /auth        # OAuth/SMART handlers
  /queue       # Background job processors
  /validators  # FHIR profile validation
  /db          # Database models/migrations
```

### Option B: Java/Spring Boot Stack

**Framework & Libraries**
```
- Spring Boot 3.x: Enterprise framework
- HAPI FHIR JPA Server: Full FHIR persistence
- Spring Security OAuth: OAuth 2.0 implementation
- Spring Cloud Stream: Event-driven messaging
- Hibernate: ORM for additional tables
```

**Why This Stack**
- HAPI FHIR is industry standard
- Enterprise-grade security and compliance
- Strong typing and compile-time safety
- Better integration with legacy systems

**Project Structure**
```
/src/main/java
  /config      # Spring configuration
  /fhir        # FHIR server customization
  /pas         # PAS operations
  /dtr         # DTR components
  /security    # OAuth/SMART
  /workflow    # Orchestration engine
  /repository  # Data access layer
```

## Why This Design

**Clean Separation**
- FHIR surface cleanly separated from business logic
- Orchestration decoupled from FHIR operations
- UM adapter as pluggable component

**Extensibility**
- Easy to add CRD hooks later
- Can integrate additional IGs incrementally
- Mock components easily replaced with production systems

**Developer Experience**
- Clear module boundaries
- Testable components
- Local development friendly

## Implementation Timeline

### Week 1-2: Foundation
- Repository setup with chosen stack
- FHIR server deployment
- Basic PAS operation stubs
- CI/CD pipeline

### Week 3-4: Core Operations
- Implement Claim/$submit
- Implement Claim/$inquire
- Mock UM decision engine
- Status tracking system

### Week 5-6: DTR Integration
- Questionnaire serving
- CQL engine setup
- SMART app launch
- Prepopulation logic

### Week 7-8: Access APIs
- Provider Access endpoints
- Patient Access endpoints
- Search and filtering
- Pagination support

### Week 9-10: Validation & Testing
- FHIR profile validators
- Inferno test integration
- End-to-end test scenarios
- Performance benchmarking

### Week 11-12: Polish & Documentation
- API documentation
- Deployment guide
- Demo application
- Metrics dashboard

## Development Environment

### Local Setup
```yaml
services:
  fhir-server:
    image: hapiproject/hapi:latest
    ports: [8080]

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: fhir_pas

  redis:
    image: redis:7-alpine
    ports: [6379]

  oauth-mock:
    image: mock-oauth2-server
    ports: [9000]
```

### Cloud Sandbox (POC)
- AWS/Azure/GCP free tier
- Managed PostgreSQL
- Managed Redis
- Container orchestration (ECS/AKS/GKE)

## Monitoring & Metrics

### Basic Dashboard (JSON)
```json
{
  "sla_metrics": {
    "avg_response_time_ms": 0,
    "p95_response_time_ms": 0,
    "availability_percent": 0
  },
  "business_metrics": {
    "total_authorizations": 0,
    "approval_rate": 0,
    "avg_turnaround_hours": 0
  },
  "public_reporting": {
    "cms_compliance_score": 0,
    "interoperability_score": 0
  }
}
```

## Key Decisions Required

1. **Tech Stack**: Node/TS vs Java/Spring (Week 1)
2. **Cloud Provider**: AWS vs Azure vs GCP (Week 1)
3. **FHIR Server**: HAPI vs Microsoft vs Google (Week 2)
4. **Queue System**: Redis vs RabbitMQ vs SQS (Week 2)
5. **DTR Approach**: Full CQL vs Simplified (Week 3)

## Risk Mitigation

### Technical Risks
- **FHIR Complexity**: Use established libraries, don't reinvent
- **DTR/CQL Learning Curve**: Start with simple questionnaire
- **Performance**: Design for async from day 1

### Schedule Risks
- **Scope Creep**: Strictly enforce POC boundaries
- **Integration Delays**: Use mocks aggressively
- **Testing Time**: Automate early and often

## Success Metrics

### POC Completion
- [ ] End-to-end PA submission working
- [ ] DTR questionnaire with prepopulation
- [ ] Provider/Patient Access APIs functional
- [ ] Pass core Inferno tests
- [ ] < 2 second response times
- [ ] Complete documentation

### Demo Readiness
- [ ] Clean UI for submission flow
- [ ] Status dashboard
- [ ] Test data scenarios
- [ ] Performance metrics visible
- [ ] Deployment reproducible