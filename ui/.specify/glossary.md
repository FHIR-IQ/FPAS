# FPAS UI — Glossary

## FHIR Terms

**PAS (Prior Authorization Support)**
Da Vinci Implementation Guide for submitting and tracking prior authorization requests via FHIR. Uses Claim resource with `use=preauthorization`.

**DTR (Documentation Templates and Rules)**
IG for retrieving and completing clinical questionnaires (Questionnaire/QuestionnaireResponse) to gather documentation needed for PA.

**CDS Hooks (Clinical Decision Support Hooks)**
Specification for EHR-to-payer service calls at workflow moments (order-select, order-sign) to retrieve cards with PA requirements, warnings, or suggestions.

**Questionnaire**
FHIR resource defining a set of questions (linkId, type, text) with optional CQL-based prepopulation logic.

**QuestionnaireResponse**
FHIR resource containing answers to a Questionnaire, linked by linkId. Can be attached to a PAS Claim bundle.

**OperationOutcome**
FHIR resource returned when an operation fails or has warnings, containing issue severity/code/diagnostics.

**NDJSON (Newline-Delimited JSON)**
Format used for FHIR bulk data export. Each line is a standalone JSON object representing one FHIR resource.

**$submit**
FHIR operation on Claim resource to submit a prior authorization request. Returns a ClaimResponse.

**$inquire**
FHIR operation to query the status of an existing prior authorization.

**$everything**
FHIR operation on Patient resource to retrieve all related data (Claims, Coverage, Encounters, etc.) in one call.

**$export**
FHIR operation for bulk data export, typically on Group or Patient level. Returns a job URL to poll for status and download NDJSON files.

## Scope Terms

**patient scope**
OAuth scope granting access to a single patient's data (e.g., `patient/*.read`).

**provider scope**
OAuth scope granting a provider access to their attributed patients (e.g., `user/Claim.read`).

**system scope**
OAuth scope for system-to-system access, typically for bulk operations (e.g., `system/*.read`).

## UI Terms

**Token Switcher**
UI component allowing the user to toggle between mock patient, provider, and system bearer tokens to test scope-based access.

**Timeline**
Visual representation of a PAS workflow showing Request → Processing → Decision with timestamps.

**Card**
CDS Hooks response element containing a summary, indicator (info/warning/critical), and optional suggestions/links.

**Mock Mode**
UI state where API calls are intercepted and return static responses for offline demos.

## Acronyms

- **PA**: Prior Authorization
- **EHR**: Electronic Health Record
- **CQL**: Clinical Quality Language (used in DTR for prepopulation)
- **CPT**: Current Procedural Terminology (procedure codes)
- **ICD**: International Classification of Diseases (diagnosis codes)
- **CORS**: Cross-Origin Resource Sharing
- **POC**: Proof of Concept