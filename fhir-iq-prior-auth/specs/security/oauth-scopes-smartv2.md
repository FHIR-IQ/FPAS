# OAuth 2.0 Scopes and SMART on FHIR v2 Security

## Overview

This document defines the OAuth 2.0 scopes and security model for the FHIR IQ Prior Authorization System (FPAS) POC, implementing SMART on FHIR v2 authorization patterns for prior authorization workflows.

## SMART on FHIR v2 Implementation

### Authorization Flows

The POC supports three primary authorization flows:

1. **Provider Access** - Healthcare providers accessing PA data
2. **Prior Authorization Submission** - EHR systems submitting PA requests
3. **Patient Access** - Patients viewing their PA history

## OAuth 2.0 Scopes

### Provider Access Scopes

#### POC Implementation (Simplified)
```
user/*.read
patient/*.read
```

**Usage**: Broad read access for providers during POC development
- Allows access to all FHIR resources for authenticated users
- Simplified scope for rapid prototyping and testing
- Used with authorization code flow for provider-facing applications

#### Production Implementation (Granular)
```
user/Claim.read
user/ClaimResponse.read
user/Coverage.read
user/Patient.read
user/Questionnaire.read
user/QuestionnaireResponse.read
user/Task.read
```

**Usage**: Fine-grained access control for production deployment
- Specific resource-level permissions
- Follows principle of least privilege
- Enables audit and compliance tracking

### Prior Authorization Submission Scopes

#### Provider-Initiated Submission
```
user/Claim.write
user/QuestionnaireResponse.write
user/Task.read
```

**Usage**: Provider applications submitting PA requests
- Write access for claim submission
- Write access for questionnaire responses
- Read access for task status monitoring

#### System-to-System Submission
```
system/Claim.write
system/ClaimResponse.read
system/Task.read
system/Bundle.write
```

**Usage**: EHR-to-payer server-to-server communication
- Backend services integration
- Bulk submission capabilities
- Automated workflow processing

### Patient Access Scopes

#### Patient-Facing Applications
```
patient/*.read
patient/Claim.read
patient/ClaimResponse.read
patient/Coverage.read
```

**Usage**: Patient access via consented applications
- Patients viewing their PA history
- Authorization status checking
- Coverage information access
- Requires explicit patient consent

### DTR-Specific Scopes

#### Questionnaire Management
```
user/Questionnaire.read
user/Library.read
system/Questionnaire.read
system/Library.read
```

**Usage**: DTR questionnaire and CQL library access
- Dynamic questionnaire retrieval
- CQL library execution
- Prepopulation data access

## Token Claims and Validation

### Required Token Claims

All access tokens MUST include the following claims:

#### Organization Identifier
```json
{
  "iss": "https://auth.fhir-iq.com",
  "sub": "provider-12345",
  "aud": "https://api.fhir-iq.com",
  "requester_org": {
    "resourceType": "Organization",
    "identifier": [
      {
        "system": "http://hl7.org/fhir/sid/us-npi",
        "value": "1234567890"
      }
    ]
  }
}
```

#### Purpose of Use
```json
{
  "purpose_of_use": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason",
    "code": "TREAT",
    "display": "Treatment"
  }
}
```

#### Patient Context (when applicable)
```json
{
  "patient": "Patient/patient-12345",
  "encounter": "Encounter/encounter-67890"
}
```

### POC Validation Approach

#### Static Allowlist Enforcement
```json
{
  "allowed_organizations": [
    {
      "npi": "1234567890",
      "name": "Springfield Medical Center",
      "scopes": ["user/*.read", "user/Claim.write"]
    },
    {
      "npi": "9876543210",
      "name": "Anytown Clinic",
      "scopes": ["user/Claim.read", "user/ClaimResponse.read"]
    }
  ],
  "allowed_purposes": ["TREAT", "PAYMGT", "HMARKT"]
}
```

## Authorization Server Configuration

### SMART Configuration Endpoint
```
GET /.well-known/smart_configuration
```

**Response**:
```json
{
  "authorization_endpoint": "https://auth.fhir-iq.com/authorize",
  "token_endpoint": "https://auth.fhir-iq.com/token",
  "introspection_endpoint": "https://auth.fhir-iq.com/introspect",
  "registration_endpoint": "https://auth.fhir-iq.com/register",
  "scopes_supported": [
    "user/Claim.read",
    "user/Claim.write",
    "user/ClaimResponse.read",
    "patient/Claim.read",
    "system/Claim.write"
  ],
  "response_types_supported": ["code"],
  "grant_types_supported": [
    "authorization_code",
    "client_credentials"
  ],
  "capabilities": [
    "launch-ehr",
    "launch-standalone",
    "context-ehr-patient",
    "permission-patient",
    "permission-user"
  ]
}
```

### Client Registration

#### Provider Application Registration
```json
{
  "client_name": "FPAS Provider Portal",
  "client_uri": "https://provider.fhir-iq.com",
  "scope": "user/Claim.read user/ClaimResponse.read user/Questionnaire.read",
  "redirect_uris": ["https://provider.fhir-iq.com/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "client_secret_basic"
}
```

#### EHR System Registration
```json
{
  "client_name": "Epic EHR Integration",
  "scope": "system/Claim.write system/ClaimResponse.read",
  "grant_types": ["client_credentials"],
  "token_endpoint_auth_method": "private_key_jwt",
  "jwks_uri": "https://ehr.example.com/.well-known/jwks.json"
}
```

## Security Controls

### Access Control Matrix

| Actor | Scope | Resources | Operations | Context Required |
|-------|-------|-----------|------------|------------------|
| Provider | `user/Claim.read` | Claim, ClaimResponse | GET, Search | Organization ID, Purpose |
| EHR System | `system/Claim.write` | Claim, Bundle | POST, PUT | Organization ID |
| Patient App | `patient/Claim.read` | Claim, ClaimResponse | GET, Search | Patient consent |
| DTR App | `user/Questionnaire.read` | Questionnaire, Library | GET | EHR launch context |

### Rate Limiting

#### API Rate Limits (POC)
- **Provider Access**: 100 requests/minute per organization
- **System Access**: 1000 requests/minute per client
- **Patient Access**: 50 requests/minute per patient

#### Production Considerations
- Dynamic rate limiting based on organization tier
- Burst allowances for high-volume providers
- Throttling for suspicious activity patterns

### Audit and Compliance

#### Required Audit Events
```json
{
  "timestamp": "2025-09-26T10:30:00Z",
  "event_type": "PA_SUBMISSION",
  "actor": {
    "organization": "1234567890",
    "user": "provider-12345"
  },
  "patient": "Patient/patient-12345",
  "resource": "Claim/claim-12345",
  "outcome": "SUCCESS",
  "purpose_of_use": "TREAT"
}
```

## Implementation Guidelines

### POC Development
1. **Static Configuration**: Use allowlist for organization validation
2. **Simplified Scopes**: Implement broad `user/*.read` for rapid development
3. **Mock JWT Validation**: Basic token structure validation only
4. **File-based Allowlist**: JSON configuration for approved organizations

### Production Migration Path
1. **Dynamic Registration**: Implement OAuth 2.0 Dynamic Client Registration
2. **Granular Scopes**: Migrate to resource-specific scope enforcement
3. **PKI Integration**: Full JWT signature validation with certificate chains
4. **Database-driven**: Move allowlists to secure database with admin interface

## Error Handling

### OAuth Error Responses
```json
{
  "error": "insufficient_scope",
  "error_description": "Required scope 'user/Claim.write' not granted",
  "error_uri": "https://docs.fhir-iq.com/errors#insufficient-scope"
}
```

### Authorization Failures
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "security",
      "details": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/operation-outcome",
            "code": "MSG_AUTH_REQUIRED"
          }
        ],
        "text": "Organization not authorized for prior authorization submissions"
      }
    }
  ]
}
```

## Testing and Validation

### Scope Validation Tests
- Verify scope enforcement for each resource type
- Test cross-organization access prevention
- Validate patient consent requirements
- Confirm purpose-of-use claim processing

### Security Test Scenarios
1. **Unauthorized Access**: Token without required scopes
2. **Organization Mismatch**: Valid token from non-allowlisted organization
3. **Expired Tokens**: Token validation with expired timestamps
4. **Scope Escalation**: Attempt to access resources beyond granted scopes

## References

- [SMART App Launch v2.0](http://hl7.org/fhir/smart-app-launch/)
- [FHIR R4 Security](http://hl7.org/fhir/R4/security.html)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [Da Vinci PAS Security Guidance](http://hl7.org/fhir/us/davinci-pas/security.html)