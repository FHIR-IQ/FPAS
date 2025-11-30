# FPAS UI — Interactive Prior Auth & Interop Demo

## Title
FPAS UI: Interactive Prior Authorization & Interoperability Demo

## Intent
Wrap FPAS endpoints with a clean, demo-ready UI for PAS submit/inquire, DTR pre-pop & attach, CDS Hooks playground, Provider/Patient Access viewers, Payer-to-Payer bulk export, and metrics.

## Users
- Payer product teams
- Integration engineers
- Provider tech leads
- Buyers evaluating FPAS capabilities

## Non-Goals
- Real OAuth/SMART authentication
- Production CRD hookups
- Data persistence (localStorage only for preferences)
- This is a client-only demo/QA tool

## Success Criteria
- Submit three PAS scenarios (approve/pend/deny) and see responses, timeline, and errors
- DTR pre-populates and attaches a QuestionnaireResponse into the PAS bundle on demand
- CDS returns cards rendered correctly from sample payloads
- Access viewer honors scope toggle (patient vs provider queries)
- Bulk export flow shows job polling and NDJSON previews
- All requests configurable via env and editors