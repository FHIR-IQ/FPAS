# FHIR IQ Prior Authorization System - Specifications

This directory contains the technical specifications for the FHIR IQ Prior Authorization System (FPAS) following the [GitHub Spec Kit](https://github.com/github/spec-kit) RFC format.

## RFC Index

| RFC | Title | Status | Author(s) | Created | Updated |
|-----|-------|--------|-----------|---------|---------|
| [RFC-0001](./rfc-0001-fhir-pa-poc.md) | FHIR Prior Authorization POC System | Draft | FHIR IQ Team | 2024-09-28 | 2024-09-28 |
| [RFC-0002](./rfc-0002-dtr-integration.md) | DTR Questionnaire and CQL Integration | Draft | FHIR IQ Team | 2024-09-28 | 2024-09-28 |
| [RFC-0003](./rfc-0003-security-model.md) | OAuth 2.0 and SMART on FHIR v2 Security | Draft | FHIR IQ Team | 2024-09-28 | 2024-09-28 |

## Status Definitions

- **Draft**: Under active development and discussion
- **Proposed**: Ready for formal review and feedback
- **Accepted**: Approved for implementation
- **Final**: Implementation complete and in production
- **Withdrawn**: No longer under consideration

## Process

1. **RFC Creation**: New technical proposals are created as RFC documents in this directory
2. **Review Period**: RFCs undergo review and discussion via GitHub issues/PRs
3. **Implementation**: Accepted RFCs guide the implementation in `/implementation` directory
4. **Validation**: All implementations must validate against the RFC specifications

## Contributing

Please follow the [GitHub Spec Kit template](https://github.com/github/spec-kit/blob/main/RFC-TEMPLATE.md) when creating new RFCs.

## Compliance Framework

This project implements healthcare interoperability standards:
- **CMS-0057-F**: Interoperability and Patient Access Final Rule
- **HL7 FHIR R4**: Fast Healthcare Interoperability Resources
- **Da Vinci PAS**: Prior Authorization Support Implementation Guide
- **Da Vinci DTR**: Documentation Templates and Rules Implementation Guide
- **SMART on FHIR v2**: Secure authentication and authorization framework