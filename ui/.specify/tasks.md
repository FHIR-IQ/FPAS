# FPAS UI — Implementation Tasks

## Phase 1: Foundation
- [x] Bootstrap Next.js + Tailwind
- [x] Add .env.example with FPAS URLs
- [x] Create left-rail nav component (Sidebar)
- [x] Build TokenSwitcher (mock patient/provider/system)
- [x] Set up Tailwind config and globals

## Phase 2: PAS Tester (`/pas`)
- [x] JSON editor with Monaco
- [x] Example selector (approve/pend/deny)
- [x] Validate → Submit → Inquire → Cancel flow
- [x] Timeline visualization
- [x] Pretty response viewer
- [x] OperationOutcome card renderer
- [x] Copyable cURL generation

## Phase 3: DTR Runner (`/dtr`)
- [x] Fetch Questionnaire by ID
- [x] Simple question renderer (string, boolean, choice, text)
- [x] Build QuestionnaireResponse
- [x] Attach to PAS bundle button
- [x] Show combined submission

## Phase 4: CDS Hooks Playground (`/cds`)
- [x] Service discovery endpoint call
- [x] order-select / order-sign editor
- [x] Context builder (patient, encounter, draftOrders) - via examples
- [x] Card renderer (info/warning/critical)
- [x] Link and suggestion actions
- [x] Request/response inspection

## Phase 5: Access Viewer (`/access`)
- [x] Patient ID input field
- [x] $everything operation call
- [x] Claim search with filters (patient, service type)
- [x] Coverage display
- [x] Scope toggle (patient vs provider vs system)
- [x] Results viewer with ResponseViewer

## Phase 6: Bulk Simulator (`/bulk`)
- [x] Start $export form (Group ID, resource types, _since)
- [x] Poll status endpoint with auto-refresh
- [x] Progress indicator
- [x] List NDJSON files from output
- [x] Preview first N rows with NDJSON parser
- [x] File download links (via preview)

## Phase 7: Metrics Dashboard (`/metrics`)
- [x] Mock event aggregation client-side
- [x] Latency line chart (Recharts)
- [x] Outcome pie chart (approve/pend/deny)
- [x] Outcome bar chart
- [x] Summary cards (total, approved, pended, denied, avg latency)
- [x] Event log table with add/clear controls

## Phase 8: Polish
- [x] Error handling across all pages (try-catch with OperationOutcome)
- [x] Nice OperationOutcome cards (severity-based rendering)
- [x] Loading states (disabled buttons, loading text)
- [x] Responsive design (desktop/tablet with grid layouts)
- [x] README quickstart with comprehensive demo scripts for all 6 pages
- [x] Seed examples (pas-approve/pend/deny, cds-order-select/sign)
- [x] CORS proxy configuration (vercel.json with rewrites)
- [x] Troubleshooting guide (CORS, 404, tokens, examples)
- [x] Mock token documentation and configuration

## Phase 9: Deployment
- [x] Vercel configuration (vercel.json with API proxies)
- [x] Environment variables (.env.example with all options)
- [ ] CI lint/build check (typecheck, build, lint)
- [ ] Deploy preview to Vercel
- [ ] Production deployment