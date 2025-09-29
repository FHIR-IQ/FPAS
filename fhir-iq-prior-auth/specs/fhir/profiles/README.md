# FHIR Profiles - FHIR IQ Prior Authorization POC

## Overview

This directory contains FHIR profile examples and constraints for the FHIR IQ Prior Authorization POC implementation. The POC primarily leverages existing profiles from established Implementation Guides rather than creating custom profiles.

## Referenced Implementation Guides

### Da Vinci Prior Authorization Support (PAS)
- **Current Version**: STU 2.0.1
- **Canonical URL**: `http://hl7.org/fhir/us/davinci-pas/ImplementationGuide/hl7.fhir.us.davinci-pas`
- **Key Profiles**:
  - `profile-claim`: Prior authorization request structure
  - `profile-claimresponse`: Prior authorization response structure
  - `profile-coverage`: Insurance coverage information
  - `profile-task`: Async workflow tracking

### Da Vinci Documentation Templates and Rules (DTR)
- **Current Version**: STU 2.0
- **Canonical URL**: `http://hl7.org/fhir/us/davinci-dtr/ImplementationGuide/hl7.fhir.us.davinci-dtr`
- **Key Profiles**:
  - `dtr-questionnaire`: Dynamic questionnaires with CQL
  - `dtr-questionnaireresponse`: Completed questionnaire responses

### US Core
- **Current Version**: 3.1.1
- **Canonical URL**: `http://hl7.org/fhir/us/core/ImplementationGuide/hl7.fhir.us.core`
- **Key Profiles**:
  - `us-core-patient`: Patient demographics
  - `us-core-practitioner`: Healthcare providers
  - `us-core-organization`: Healthcare organizations

## POC Profile Strategy

### No Custom Profiles
For this POC, we are **NOT creating custom profiles**. Instead, we:
1. Reference existing IG profiles via canonical URLs
2. Demonstrate conformance through example resources
3. Document any local constraints or usage patterns
4. Validate against published IG profiles

### Profile Validation
All resources in the POC must validate against:
- Base FHIR R4 specification
- Applicable US Core profiles
- Da Vinci PAS/DTR profiles where used
- Required terminology bindings

## Example Resources

The `examples/` directory contains sample FHIR resources demonstrating:

### PAS Request Bundle (`pas-request-bundle.json`)
- Complete prior authorization request
- Includes Claim with all required elements
- References Patient, Coverage, Organization
- Demonstrates proper Bundle structure

### PAS Response Bundle (`pas-response-bundle.json`)
- Authorization response with decision
- ClaimResponse with disposition and authorization number
- Task resource for async processing tracking
- OperationOutcome for any issues

## Profile Usage in POC

### Claim Resource
```json
{
  "resourceType": "Claim",
  "meta": {
    "profile": [
      "http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claim"
    ]
  },
  // ... claim content
}
```

### ClaimResponse Resource
```json
{
  "resourceType": "ClaimResponse",
  "meta": {
    "profile": [
      "http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claimresponse"
    ]
  },
  // ... response content
}
```

### Patient Resource
```json
{
  "resourceType": "Patient",
  "meta": {
    "profile": [
      "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"
    ]
  },
  // ... patient content
}
```

## Local Constraints (POC Only)

While we don't create custom profiles, we document POC-specific constraints:

### Simplified Requirements
- **Coverage**: Only basic insurance information required
- **Provider**: NPI identifier sufficient for POC
- **Patient**: Demographics only, no clinical history required
- **Authorization**: Simple approve/deny/pend disposition

### Mock Data Patterns
- **Identifiers**: Use synthetic but realistic patterns
- **Dates**: Use current date ranges
- **Codes**: Limit to common CPT/ICD-10 codes
- **Amounts**: Use realistic dollar amounts

## Validation Strategy

### CI/CD Integration
```bash
# Validate all examples against profiles
fhir-validator -profile pas-request-bundle.json -ig hl7.fhir.us.davinci-pas
fhir-validator -profile pas-response-bundle.json -ig hl7.fhir.us.davinci-pas
```

### Inferno Testing
- Use Inferno DTR test suite for questionnaire validation
- Custom tests for PAS operations
- Provider Access API conformance tests

## Future Profile Development

### Post-POC Considerations
After POC success, consider creating custom profiles for:
- Payer-specific claim extensions
- Local terminology requirements
- Additional security constraints
- Performance optimizations

### Extension Points
Document where custom extensions might be needed:
- Claim: Payer-specific prior auth fields
- ClaimResponse: Enhanced decision reasoning
- Task: Custom workflow states
- Patient: Consent preferences

## Implementation Notes

### Must Support Elements
All POC implementations must handle "Must Support" elements from referenced profiles, even if not fully implemented:
- Log warnings for unsupported elements
- Document limitations clearly
- Plan for production implementation

### Terminology Binding
Follow IG-specified value sets:
- Use SNOMED CT for clinical concepts
- Use CPT for procedures
- Use ICD-10 for diagnoses
- Use local codes only when necessary

## Resources

- [PAS Implementation Guide](http://hl7.org/fhir/us/davinci-pas/)
- [DTR Implementation Guide](http://hl7.org/fhir/us/davinci-dtr/)
- [US Core Implementation Guide](http://hl7.org/fhir/us/core/)
- [FHIR R4 Specification](http://hl7.org/fhir/R4/)
- [FHIR Validator](https://github.com/hapifhir/org.hl7.fhir.core/releases)