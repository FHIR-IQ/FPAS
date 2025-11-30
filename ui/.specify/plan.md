# FPAS UI — Technical Implementation Plan

## Framework
Next.js + TypeScript + Tailwind; no server code.

## Auth
Mock bearer tokens (patient / provider / system scopes) via UI toggles.

## Editors
Monaco/CodeMirror JSON editors with curated examples.

## APIs

### PAS
- `POST /fhir/Claim/$submit`
- `POST /fhir/Claim/$inquire`

### DTR
- `GET /fhir/Questionnaire?...`
- Compose QuestionnaireResponse

### CDS Hooks
- `GET /cds-services`
- `POST /cds-services/{id}`

### Access
- `GET /fhir/Patient/{id}/$everything`
- Claim, Coverage queries with scope toggle

### Bulk Export
- `GET /fhir/Patient/$export?...`
- Poll status → download NDJSON

## Developer Experience
- Self-contained examples
- Timeline/OperationOutcome rendering
- Latency & outcome charts
- Copyable cURL for all requests

## Architecture

```
fpas-ui/
├─ app/
│  ├─ layout.tsx          # Root layout with nav
│  ├─ page.tsx            # Landing/home
│  ├─ pas/page.tsx        # PAS Tester
│  ├─ dtr/page.tsx        # DTR Runner
│  ├─ cds/page.tsx        # CDS Playground
│  ├─ access/page.tsx     # Access Viewer
│  ├─ bulk/page.tsx       # Bulk Simulator
│  └─ metrics/page.tsx    # Metrics Dashboard
├─ components/
│  ├─ JsonEditor.tsx
│  ├─ ResponseViewer.tsx
│  ├─ Timeline.tsx
│  ├─ TokenSwitcher.tsx
│  └─ Charts.tsx
├─ lib/
│  ├─ fhirClient.ts       # Centralized API client
│  ├─ cdsClient.ts
│  ├─ ndjson.ts
│  └─ examples/           # Pre-built JSON bundles
│     ├─ pas-approve.json
│     ├─ pas-pend.json
│     ├─ pas-deny.json
│     └─ dtr-lumbar-mri.json
└─ .env.local
   NEXT_PUBLIC_FHIR_BASE=https://fpas-phi.vercel.app/fhir
   NEXT_PUBLIC_CDS_BASE=https://fpas-phi.vercel.app
```

## Component Design

### JsonEditor
- Monaco-based editor
- JSON Schema validation
- Format/minify buttons
- Copy to clipboard

### ResponseViewer
- Collapsible JSON tree
- Highlight key FHIR fields (status, id, outcome)
- OperationOutcome card rendering
- Download response

### Timeline
- Visual workflow representation
- Request → Processing → Response
- Color-coded outcomes (green/yellow/red)
- Timestamps

### TokenSwitcher
- Dropdown: Patient / Provider / System
- Mock bearer token display
- Scope badge showing active permissions

## Error Handling
- Nice OperationOutcome cards
- HTTP status code display
- Retry button
- Copyable cURL command for debugging