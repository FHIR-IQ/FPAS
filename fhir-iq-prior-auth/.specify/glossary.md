# Glossary - FHIR IQ Prior Authorization POC

## Core Terms

**PAS (Prior Authorization Support)**
: HL7 Da Vinci Implementation Guide defining FHIR-based prior authorization submission and response

**DTR (Documentation Templates & Rules)**
: Da Vinci IG for gathering documentation using dynamic questionnaires with CQL prepopulation

**CMS-0057-F**
: CMS Interoperability and Prior Authorization final rule requiring FHIR-based PA APIs by 2027

**UM (Utilization Management)**
: Payer system/process for reviewing and approving medical services

## FHIR Terms

**CapabilityStatement**
: FHIR resource declaring server's supported operations, resources, and search parameters

**OperationDefinition**
: FHIR resource defining custom operations like $submit and $inquire

**Bundle**
: Container for multiple FHIR resources, used for PA request/response packages

**Claim**
: FHIR resource representing a prior authorization request

**ClaimResponse**
: FHIR resource containing the authorization decision

**Task**
: FHIR resource tracking async PA processing status

**Questionnaire**
: FHIR resource defining documentation questions

**QuestionnaireResponse**
: Completed questionnaire with answers

## Technical Terms

**CQL (Clinical Quality Language)**
: HL7 standard for expressing clinical logic for prepopulation and decision support

**SMART on FHIR**
: Standards for app integration with EHRs using OAuth 2.0

**OAuth 2.0**
: Authorization framework for API access control

**JWT (JSON Web Token)**
: Token format for authentication/authorization

**CORS (Cross-Origin Resource Sharing)**
: Browser mechanism for cross-domain API requests

## Operations

**$submit**
: FHIR operation for submitting PA requests

**$inquire**
: FHIR operation for checking PA status

**$populate**
: Operation for prepopulating questionnaires with EHR data

**$export**
: Bulk data export operation

## API Types

**Provider Access API**
: API allowing providers to query PA history and status

**Patient Access API**
: API for patients to view their PA information

**Payer-to-Payer API**
: Bulk exchange of PA data between payers

## Standards

**FHIR R4**
: Version 4.0.1 of HL7 FHIR standard

**US Core**
: Base FHIR profiles for US healthcare

**X12 278**
: EDI transaction for healthcare service review (legacy PA format)

**IG (Implementation Guide)**
: Specification for using FHIR in specific use cases

**STU (Standard for Trial Use)**
: Maturity level indicating specification is ready for testing but may change

## POC-Specific Terms

**Mock UM Engine**
: Simulated decision engine with configurable rules for POC

**Synthetic Data**
: Artificially generated test data (no real PHI)

**Inferno**
: ONC's FHIR conformance testing tool

**HAPI FHIR**
: Open-source Java FHIR server implementation

## Workflow Terms

**Sync Response**
: Immediate PA decision returned in same API call

**Async Response**
: PA queued for review, status tracked via Task

**Auto-approval**
: PA approved automatically based on rules

**Pended**
: PA awaiting manual review or additional information

**Prepopulation**
: Automatic filling of questionnaire fields from EHR data

## Compliance Terms

**HIPAA**
: Health Insurance Portability and Accountability Act

**PHI**
: Protected Health Information

**CMS**
: Centers for Medicare & Medicaid Services

**ONC**
: Office of the National Coordinator for Health IT

## Common Codes

**CPT**
: Current Procedural Terminology codes for procedures

**ICD-10**
: Diagnosis codes

**LOINC**
: Laboratory observation codes

**SNOMED CT**
: Clinical terminology system

**NDC**
: National Drug Codes for medications

## Identifiers

**NPI**
: National Provider Identifier

**Member ID**
: Patient's insurance identification number

**Authorization Number**
: Unique identifier for approved PA

**TIN**
: Tax Identification Number for providers

## Architecture Terms

**API Gateway**
: Entry point for all API requests

**Queue**
: Async job processing system (BullMQ, RabbitMQ)

**Redis**
: In-memory cache and session store

**PostgreSQL**
: Relational database for structured data

**Docker**
: Container platform for deployment

## Testing Terms

**Unit Test**
: Tests for individual functions/methods

**Integration Test**
: Tests for component interactions

**E2E (End-to-End) Test**
: Full workflow testing

**Load Test**
: Performance under concurrent users

**CI/CD**
: Continuous Integration/Continuous Deployment

## Acronym Quick Reference

- **API**: Application Programming Interface
- **CMS**: Centers for Medicare & Medicaid Services
- **CQL**: Clinical Quality Language
- **DTR**: Documentation Templates & Rules
- **EHR**: Electronic Health Record
- **FHIR**: Fast Healthcare Interoperability Resources
- **IG**: Implementation Guide
- **PA**: Prior Authorization
- **PAS**: Prior Authorization Support
- **PHI**: Protected Health Information
- **POC**: Proof of Concept
- **UM**: Utilization Management