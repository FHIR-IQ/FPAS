# Open Questions - FHIR IQ Prior Authorization POC

## Critical Decisions (Week 1)

### 1. Technology Stack Selection
**Question**: Node.js/TypeScript vs Java/Spring Boot?
**Considerations**:
- Team expertise
- Time to market
- FHIR library maturity
- Enterprise requirements
**Decision needed by**: Day 2

### 2. Cloud Provider
**Question**: AWS vs Azure vs GCP for POC deployment?
**Considerations**:
- Existing infrastructure
- FHIR service offerings
- Cost/credits available
- Client preferences
**Decision needed by**: Week 1

### 3. FHIR Server Choice
**Question**: HAPI FHIR vs Azure FHIR Service vs Google Healthcare API?
**Considerations**:
- Feature completeness
- Customization needs
- Operational overhead
- Licensing costs
**Decision needed by**: Week 1

## Architecture Decisions (Week 2)

### 4. Pure FHIR vs X12 278 Bridge
**Question**: Will production require X12 278 translation?
**Impact**: Need to design adapter interface
**Decision needed by**: Week 2

### 5. UM System Integration
**Question**: Which UM vendor will be used in production?
**Impact**: Interface design, rule complexity
**Decision needed by**: Week 3

### 6. Queue System
**Question**: Redis/BullMQ vs RabbitMQ vs AWS SQS?
**Impact**: Async processing architecture
**Decision needed by**: Week 2

## Scope Decisions (Week 1-2)

### 7. Service Types for Demo
**Question**: Which procedures to support in POC?
- Imaging (MRI, CT)
- Surgery
- DME
- Medications
**Decision needed by**: Week 2

### 8. CRD Hook Implementation
**Question**: Include basic order-select hook in POC?
**Impact**: Additional 1-2 weeks effort
**Decision needed by**: Week 3

### 9. Bulk Operations
**Question**: Include payer-to-payer export in POC?
**Impact**: Scope expansion
**Decision needed by**: Week 2

## DTR Decisions (Week 3)

### 10. CQL Complexity
**Question**: Full CQL engine vs simplified expressions?
**Considerations**:
- Performance requirements
- Library availability
- Learning curve
**Decision needed by**: Week 3

### 11. Questionnaire Complexity
**Question**: How complex should sample questionnaire be?
- Simple (5-10 questions)
- Medium (15-20 questions)
- Complex (20+ with branching)
**Decision needed by**: Week 3

### 12. SMART App Approach
**Question**: Embedded iframe vs standalone app?
**Impact**: User experience, integration complexity
**Decision needed by**: Week 4

## Security Decisions (Week 2-3)

### 13. OAuth Implementation
**Question**: Mock OAuth server vs real implementation?
**Considerations**:
- Demo requirements
- Security compliance
- Development time
**Decision needed by**: Week 2

### 14. Consent Model
**Question**: How to handle consent in POC?
- Static toggles
- Basic consent resources
- Full consent management
**Decision needed by**: Week 3

## Data Decisions (Week 1-2)

### 15. Test Data Strategy
**Question**: Synthetic data generation approach?
- Use Synthea
- Custom generation
- Manual creation
**Decision needed by**: Week 2

### 16. Data Persistence
**Question**: How much history to maintain?
- Current requests only
- 30 days
- Full history
**Decision needed by**: Week 2

## Integration Decisions (Week 4+)

### 17. EHR Mock Strategy
**Question**: How to simulate EHR for prepopulation?
- Static FHIR server
- Dynamic mock service
- Real sandbox EHR
**Decision needed by**: Week 4

### 18. Notification Approach
**Question**: How to handle status updates?
- Polling only
- Webhooks
- FHIR Subscriptions
**Decision needed by**: Week 5

## Demo Decisions (Week 8+)

### 19. UI Framework
**Question**: React vs Vue vs vanilla JS for demo UI?
**Impact**: Development speed, maintainability
**Decision needed by**: Week 8

### 20. Demo Scenarios
**Question**: Which scenarios to showcase?
- Auto-approval
- Manual review
- Denial/appeal
- Missing documentation
**Decision needed by**: Week 9

## Performance Targets (Week 5)

### 21. Load Requirements
**Question**: Concurrent users for demo?
- 10 users
- 50 users
- 100 users
**Decision needed by**: Week 5

### 22. Response Time Goals
**Question**: Acceptable latency for operations?
- < 1 second
- < 2 seconds
- < 5 seconds
**Decision needed by**: Week 5

## Compliance Decisions (Week 6+)

### 23. Inferno Scope
**Question**: Which Inferno tests must pass?
- Core FHIR operations only
- Full DTR suite
- Custom PA tests
**Decision needed by**: Week 6

### 24. IG Version
**Question**: Which IG versions to target?
- PAS STU 2.0.1
- DTR STU 2.0
- Latest balloted versions
**Decision needed by**: Week 1

## Post-POC Planning (Week 10+)

### 25. Production Timeline
**Question**: Target date for production system?
**Impact**: Architecture decisions, team sizing
**Decision needed by**: Week 10

### 26. Pilot Partners
**Question**: Which providers for pilot?
**Impact**: Integration requirements
**Decision needed by**: Week 11

### 27. Scaling Strategy
**Question**: Multi-tenant from start or later?
**Impact**: Database design, security model
**Decision needed by**: Week 10

## Decision Framework

### Immediate (This Week)
- [ ] Tech stack
- [ ] Cloud provider
- [ ] FHIR server
- [ ] POC scope boundaries

### Next Sprint (Weeks 2-3)
- [ ] Architecture patterns
- [ ] Security approach
- [ ] DTR complexity
- [ ] Data strategy

### Mid-Project (Weeks 4-6)
- [ ] Integration points
- [ ] Performance targets
- [ ] Compliance scope
- [ ] Demo approach

### End of POC (Weeks 8-12)
- [ ] Production planning
- [ ] Pilot strategy
- [ ] Investment decision
- [ ] Team expansion