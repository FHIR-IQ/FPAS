# FPAS UI — Implementation Tasks

## Phase 1: Foundation
- [ ] Bootstrap Next.js + Tailwind
- [ ] Add .env.example with FPAS URLs
- [ ] Create left-rail nav component
- [ ] Build TokenSwitcher (mock patient/provider/system)
- [ ] Set up Tailwind config and globals

## Phase 2: PAS Tester (`/pas`)
- [ ] JSON editor with Monaco
- [ ] Example selector (approve/pend/deny)
- [ ] Validate → Submit → Inquire → Cancel flow
- [ ] Timeline visualization
- [ ] Pretty response viewer
- [ ] OperationOutcome card renderer
- [ ] Copyable cURL generation

## Phase 3: DTR Runner (`/dtr`)
- [ ] Fetch Questionnaire by ID
- [ ] Simple question renderer (string, boolean, choice)
- [ ] Build QuestionnaireResponse
- [ ] Attach to PAS bundle button
- [ ] Show combined submission

## Phase 4: CDS Hooks Playground (`/cds`)
- [ ] Service discovery endpoint call
- [ ] order-select / order-sign editor
- [ ] Context builder (patient, encounter, draftOrders)
- [ ] Card renderer (info/warning/critical)
- [ ] Link and suggestion actions
- [ ] Request/response inspection

## Phase 5: Access Viewer (`/access`)
- [ ] Patient picker dropdown
- [ ] $everything operation call
- [ ] Claim search with filters
- [ ] Coverage display
- [ ] Scope toggle (patient vs provider)
- [ ] Results table

## Phase 6: Bulk Simulator (`/bulk`)
- [ ] Start $export form
- [ ] Poll status endpoint
- [ ] Progress indicator
- [ ] List NDJSON files
- [ ] Preview first N rows
- [ ] Download links

## Phase 7: Metrics Dashboard (`/metrics`)
- [ ] Mock event aggregation client-side
- [ ] Latency line chart (Recharts)
- [ ] Outcome pie chart (approve/pend/deny)
- [ ] Service type bar chart
- [ ] Date range selector

## Phase 8: Polish
- [ ] Error handling across all pages
- [ ] Nice OperationOutcome cards
- [ ] Loading states and skeletons
- [ ] Responsive design (desktop/tablet)
- [ ] README quickstart
- [ ] Seed examples

## Phase 9: Deployment
- [ ] Vercel project setup
- [ ] Environment variables
- [ ] CI lint/build check
- [ ] Deploy preview
- [ ] Production deployment