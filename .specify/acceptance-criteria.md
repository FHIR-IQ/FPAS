# FPAS UI — Acceptance Criteria

## PAS Tester
- [ ] Can submit three PAS scenarios (approve/pend/deny) and see responses
- [ ] Timeline shows request → processing → decision
- [ ] OperationOutcome errors display correctly
- [ ] Inquire and Cancel operations work
- [ ] cURL is copyable for debugging

## DTR Runner
- [ ] DTR pre-populates and attaches a QuestionnaireResponse into the PAS bundle on demand
- [ ] Questions render with correct input types
- [ ] Required field validation works
- [ ] Combined bundle submission succeeds

## CDS Hooks Playground
- [ ] CDS returns cards rendered correctly from sample payloads
- [ ] Info/warning/critical badges display
- [ ] Link actions open correctly
- [ ] Suggestions are interactive

## Access Viewer
- [ ] Access viewer honors scope toggle (patient vs provider queries)
- [ ] Patient $everything returns comprehensive bundle
- [ ] Claim search filters work
- [ ] Coverage information displays

## Bulk Export Simulator
- [ ] Bulk export flow shows job polling and NDJSON previews
- [ ] Status updates every 5 seconds
- [ ] File list shows resource types and counts
- [ ] NDJSON preview displays sample records

## Metrics Dashboard
- [ ] Charts render with mock data
- [ ] Date range selector updates charts
- [ ] Tooltips show exact values
- [ ] Export to CSV works

## Cross-Cutting
- [ ] All requests configurable via env and editors
- [ ] Token switcher changes authorization scope
- [ ] Error states display nicely
- [ ] Loading states are smooth
- [ ] Works on Chrome, Firefox, Safari