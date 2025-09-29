# CMS API Compliance Framework
## January 1, 2027 Deadline Requirements

### Overview

This document outlines the FHIR IQ Prior Authorization System's compliance framework for CMS API requirements effective January 1, 2027. The system demonstrates the four critical API patterns required for CMS-0057-F compliance:

1. **Prior Authorization API** (PA API)
2. **Patient Access API**
3. **Provider Access API**
4. **Payer-to-Payer Bulk Data Exchange**

### Canonical Version Control

All Implementation Guides are pinned to specific versions to ensure compliance stability:

```json
{
  "implementationGuides": {
    "davinci-pas": "2.0.1",
    "davinci-dtr": "2.0.1",
    "davinci-hrex": "1.1.0",
    "us-core": "6.1.0",
    "davinci-pdex": "2.1.0",
    "davinci-pdex-plan-net": "1.1.0"
  },
  "lastUpdated": "2024-12-15",
  "complianceDeadline": "2027-01-01"
}
```

### 1. Prior Authorization API (PA API)

**Compliance Status**: ✅ Implemented
**Implementation Guide**: Da Vinci PAS v2.0.1

#### Required Operations

| Operation | Endpoint | Status | Notes |
|-----------|----------|---------|-------|
| `$submit` | `POST /Claim/$submit` | ✅ | Submit PA request with DTR |
| `$inquire` | `POST /Claim/$inquire` | ✅ | Query PA status |
| `$cancel` | `POST /Claim/$cancel` | ✅ | Cancel pending PA |

#### Required Resources

| Resource | Profile | Status | Validation |
|----------|---------|---------|------------|
| Claim | `PASClaim` | ✅ | FHIR Validator |
| ClaimResponse | `PASClaimResponse` | ✅ | Profile validation |
| Task | `PASTask` | ✅ | Business rules |
| Bundle | `PASRequestBundle` | ✅ | Bundle validation |

#### DTR Integration Requirements

- ✅ CDS Hooks integration (order-select, order-sign)
- ✅ SMART on FHIR v2 launch capability
- ✅ CQL-based prepopulation (Inferno DTR kit validation pending)
- ✅ QuestionnaireResponse generation

### 2. Patient Access API

**Compliance Status**: 🚧 Requires Implementation
**Implementation Guide**: Da Vinci PDex v2.1.0

#### Required Endpoints

```
GET /Patient/{id}/$everything
GET /ExplanationOfBenefit
GET /Coverage
GET /Claim
GET /ClaimResponse
```

#### Required Scopes

```
patient/Patient.read
patient/ExplanationOfBenefit.read
patient/Coverage.read
patient/Claim.read
patient/ClaimResponse.read
```

#### Bulk Data Export

```
GET /Patient/$export
GET /Group/{id}/$export
```

### 3. Provider Access API

**Compliance Status**: 🚧 Requires Implementation
**Implementation Guide**: US Core v6.1.0 + Da Vinci HRex v1.1.0

#### Required Endpoints

```
GET /Patient
GET /Claim
GET /ClaimResponse
GET /Coverage
GET /Practitioner
GET /Organization
```

#### Required Scopes

```
user/Patient.read
user/Claim.read
user/ClaimResponse.read
user/Coverage.read
user/Practitioner.read
user/Organization.read
```

### 4. Payer-to-Payer Bulk Data Exchange

**Compliance Status**: 🚧 Requires Implementation
**Implementation Guide**: Da Vinci PDex v2.1.0

#### Required Operations

```
POST /Patient/$export
POST /Group/{id}/$export
GET /{bulk-data-endpoint}
DELETE /{bulk-data-endpoint}
```

#### Required Data Elements

- Claims and claims-related information
- Prior authorization decisions
- Clinical data (as permitted)
- Provider directory information

### Architecture Decisions

#### Pure FHIR Approach

Following CMS guidance, the system implements pure FHIR workflows without mandatory X12 278 transformation:

```typescript
// X12 adapter remains optional
const x12Adapter = config.enableX12 ? new X12Adapter() : null;

// Core workflow remains FHIR-native
const paResponse = await processPARequest(fhirBundle);
```

#### Deployment Patterns

1. **Pure FHIR** (CMS Preferred)
   - Direct FHIR API consumption
   - No X12 transformation required
   - Faster implementation timeline

2. **Hybrid FHIR + X12** (Legacy Support)
   - Optional X12 278 bridge
   - Vendor adapter pattern
   - Gradual migration support

### Testing Strategy

#### Inferno DTR Test Kit Integration

```bash
# Inferno DTR validation
npm run test:inferno-dtr

# CQL prepopulation validation
npm run test:cql-prepopulation

# SMART launch validation
npm run test:smart-launch
```

#### CMS Compliance Validation

```bash
# PA API compliance tests
npm run test:cms-pa-api

# Patient Access API tests
npm run test:cms-patient-api

# Provider Access API tests
npm run test:cms-provider-api

# Bulk data exchange tests
npm run test:cms-bulk-data
```

### Implementation Timeline

#### Phase 1: Core PA API (Complete)
- ✅ PAS operations ($submit, $inquire, $cancel)
- ✅ DTR integration with CDS Hooks
- ✅ SMART on FHIR v2 launch
- ✅ Vendor adapter framework

#### Phase 2: Patient/Provider Access APIs (Q1 2025)
- 🚧 Patient Access API implementation
- 🚧 Provider Access API implementation
- 🚧 OAuth 2.0 scope enforcement
- 🚧 Bulk data export capability

#### Phase 3: Payer-to-Payer Exchange (Q2 2025)
- 🚧 Bulk data operations
- 🚧 Member attribution logic
- 🚧 Data sharing agreements
- 🚧 Privacy and security controls

#### Phase 4: Production Hardening (Q3-Q4 2025)
- 🚧 Scale testing
- 🚧 Security audit
- 🚧 Performance optimization
- 🚧 Monitoring and alerting

### Compliance Monitoring

#### Metrics Dashboard

```json
{
  "complianceMetrics": {
    "paApiUptime": "99.9%",
    "patientApiUptime": "TBD",
    "providerApiUptime": "TBD",
    "bulkDataSuccess": "TBD",
    "securityIncidents": 0,
    "performanceSLA": {
      "p95ResponseTime": "2000ms",
      "targetResponseTime": "5000ms"
    }
  },
  "lastAssessment": "2024-12-15",
  "nextAssessment": "2025-01-15"
}
```

#### Automated Compliance Checks

```yaml
# .github/workflows/cms-compliance.yml
name: CMS API Compliance Check
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'  # Daily

jobs:
  compliance-check:
    runs-on: ubuntu-latest
    steps:
      - name: Validate IG versions
      - name: Run PA API tests
      - name: Check security controls
      - name: Validate FHIR profiles
      - name: Generate compliance report
```

### Risk Assessment

#### High Priority Risks

1. **IG Version Drift**
   - Risk: Canonicals evolve without version pinning
   - Mitigation: Locked versions in CapabilityStatement + CI validation

2. **Scope Creep**
   - Risk: Adding non-CMS required features
   - Mitigation: Clear compliance boundaries

3. **Security Vulnerabilities**
   - Risk: OAuth/FHIR security gaps
   - Mitigation: Regular security audits

#### Medium Priority Risks

1. **Performance Degradation**
   - Risk: Bulk data operations impact PA API
   - Mitigation: Resource isolation and throttling

2. **Data Privacy Violations**
   - Risk: Unauthorized patient data access
   - Mitigation: Fine-grained access controls

### Decision Records

#### ADR-001: Pure FHIR Approach
**Decision**: Implement pure FHIR workflows as primary path
**Rationale**: CMS preference enables faster compliance
**Alternatives**: X12-first approach
**Status**: Accepted

#### ADR-002: Vendor Adapter Pattern
**Decision**: Maintain optional X12 bridge via adapters
**Rationale**: Supports gradual industry migration
**Alternatives**: FHIR-only implementation
**Status**: Accepted

#### ADR-003: Inferno Test Integration
**Decision**: Use Inferno DTR kit for CQL validation
**Rationale**: Standard compliance testing framework
**Alternatives**: Custom test suite
**Status**: Accepted

### References

- [CMS-0057-F Final Rule](https://www.cms.gov/regulations-and-guidance)
- [Da Vinci PAS IG v2.0.1](http://hl7.org/fhir/us/davinci-pas/)
- [Da Vinci DTR IG v2.0.1](http://hl7.org/fhir/us/davinci-dtr/)
- [Inferno DTR Test Kit](https://inferno.healthit.gov/)
- [CMS API Compliance Guide](https://www.cms.gov/regulations-and-guidance/guidance/interoperability)