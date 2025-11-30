# FPAS UI — Interactive FHIR Prior Authorization Tester

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)](https://tailwindcss.com/)

> Zero-backend Next.js UI for testing the [FHIR IQ Prior Authorization System (FPAS)](https://fpas-phi.vercel.app). Built for integration engineers, payer product teams, and provider tech leads to explore PAS, DTR, CDS Hooks, Provider/Patient Access APIs, and Bulk Export workflows.

## 🎯 Features

- **PAS Submission Testing**: Submit prior authorization requests with pre-filled examples
- **DTR Questionnaire Workflow**: Interactive questionnaire forms with CQL prepopulation
- **CDS Hooks Demo**: Test coverage requirements discovery hooks
- **Provider/Patient Access**: Search and view historical authorization data
- **Bulk Export**: Demonstrate FHIR bulk data export for member switching
- **Metrics Dashboard**: Visualize PA submission and approval metrics

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- Access to FPAS API at `https://fpas-phi.vercel.app`

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/fpas-ui.git
cd fpas-ui

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

```bash
# .env.local - Direct connection (may hit CORS in browser)
NEXT_PUBLIC_FHIR_BASE=https://fpas-phi.vercel.app/fhir
NEXT_PUBLIC_CDS_BASE=https://fpas-phi.vercel.app
NEXT_PUBLIC_DEFAULT_PATIENT=Patient/pat-001

# OR use Vercel proxy to avoid CORS (recommended when deployed)
# NEXT_PUBLIC_FHIR_BASE=/api/fhir
# NEXT_PUBLIC_CDS_BASE=/api

# Mock tokens (Authorization header values)
NEXT_PUBLIC_PATIENT_TOKEN=mock-patient-token
NEXT_PUBLIC_PROVIDER_TOKEN=mock-provider-token
NEXT_PUBLIC_SYSTEM_TOKEN=mock-system-token
```

### CORS Handling

If you encounter CORS errors when calling FPAS:

**Option 1: Use Vercel Proxy** (recommended for deployed UI)
```bash
# Update .env.local
NEXT_PUBLIC_FHIR_BASE=/api/fhir
NEXT_PUBLIC_CDS_BASE=/api
```
Then deploy to Vercel → `vercel.json` rewrites proxy requests to FPAS with CORS headers.

**Option 2: Add UI Origin to FPAS Allowlist**
If you control FPAS backend, add your UI origin (e.g., `https://fpas-ui.vercel.app`) to CORS configuration.

**Option 3: Local Development**
Use `npm run dev` at `http://localhost:3000` → FPAS may already allow localhost origins.

## 📁 Project Structure

```
fpas-ui/
├─ app/                    # Next.js pages (App Router)
│  ├─ pas/                # PAS submission tester
│  ├─ dtr/                # DTR questionnaire workflow
│  ├─ cds/                # CDS Hooks demo
│  ├─ access/             # Provider/Patient Access
│  ├─ bulk/               # Bulk Export demo
│  └─ metrics/            # Metrics dashboard
├─ components/             # Reusable UI components
├─ lib/                    # Utilities and API clients
│  ├─ fhirClient.ts      # FHIR API client
│  ├─ cdsClient.ts       # CDS Hooks client
│  └─ examples/          # Pre-built JSON examples
├─ .specify/               # Project specifications
│  ├─ proposal.md        # Business proposal
│  ├─ plan.md            # Technical implementation plan
│  ├─ tasks.md           # Task breakdown
│  └─ acceptance-criteria.md
└─ public/                 # Static assets
```

## 🛠️ Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Editor**: Monaco Editor (for JSON)
- **Deployment**: Vercel

## 📋 Feature Pages & Demo Scripts

### 1. **PAS Tester** (`/pas`)
Submit prior authorization requests and check status.

**Demo Script:**
1. Select **"Approve"** example (MRI Lumbar Spine, CPT 72148)
2. Click **Validate** → confirms JSON structure
3. Click **Submit** → watch timeline populate (Request Prepared → Submitting → Response Received → Authorization Decision)
4. Review **ClaimResponse** with authorization decision
5. Click **Inquire** → check current PA status with minimal bundle
6. Click **Copy cURL** → paste into terminal or Postman for debugging

**Features:**
- Example scenarios: Approve, Pend, Deny
- Operations: `Claim/$submit`, `Claim/$inquire`
- Timeline visualization with status indicators
- OperationOutcome rendering with severity-coded cards
- cURL command generation

---

### 2. **DTR Runner** (`/dtr`)
Build FHIR Questionnaires and attach to PAS bundles.

**Demo Script:**
1. Leave default Questionnaire URL: `http://example.org/fhir/Questionnaire/imaging-lumbar-mri`
2. Click **Fetch Questionnaire** → loads mock lumbar MRI questionnaire
3. Fill out form:
   - Clinical indication: Select **"Radiculopathy"**
   - Conservative therapy: **Yes** (6+ weeks)
   - Neurologic deficits: **Yes**
   - Red flags: **No**
   - Additional notes: (optional)
4. Click **Build QuestionnaireResponse** → generates FHIR resource
5. Paste PAS Bundle JSON from `/pas` Approve example
6. Click **Attach to Bundle** → see QuestionnaireResponse added with `supportingInfo` reference
7. Copy the combined bundle and submit via `/pas`

**Features:**
- Dynamic form renderer (boolean, choice, string, text, date, integer)
- QuestionnaireResponse builder
- Bundle attachment with FHIR references
- Step-by-step workflow

---

### 3. **CDS Hooks Playground** (`/cds`)
Test clinical decision support integrations.

**Demo Script:**
1. Click **Discover Services** → calls `GET /cds-services`
2. Review available hooks (order-select, order-sign)
3. Select **order-select** example from dropdown
4. Review hook context (patient, encounter, draftOrders)
5. Click **Call Hook** → sends hook invocation
6. Review returned **cards**:
   - Info: General guidance
   - Warning: Potential issues (e.g., missing coverage)
   - Critical: Immediate action required (e.g., PA needed)
7. Check **suggestions** with actions (create/update resources)
8. Click **external links** for documentation

**Features:**
- Service discovery endpoint
- Hook examples: order-select, order-sign
- Card renderer with severity indicators
- Suggestion and link display
- Request/response inspection

---

### 4. **Access Viewer** (`/access`)
Query FHIR resources with scope-based access.

**Demo Script:**
1. Select **Provider** scope (shows user/Claim.read, user/ClaimResponse.read)
2. Enter Patient ID: `Patient/pat-001`
3. Click **Search Claims** → view all PAs for patient
4. Enter Service Type: `72148` (MRI CPT code)
5. Click **Search Claims** again → filtered by procedure
6. Switch to **Patient** scope
7. Click **$everything** → comprehensive patient bundle
8. Switch to **System** scope
9. Click **Search Coverage** → payer-level coverage data
10. Click **Copy cURL** for any query

**Features:**
- Scope switcher: Patient, Provider, System
- Operations: `$everything`, `Claim` search, `Coverage` search
- Filters: Patient ID, service type
- Token display with active scopes
- Results viewer with collapsible JSON

---

### 5. **Bulk Export Simulator** (`/bulk`)
Test payer-to-payer data exchange workflows.

**Demo Script:**
1. Leave defaults:
   - Group: `Group/switching-members-2024`
   - Resource Types: `Patient,Coverage,Claim,ClaimResponse`
   - Since: (empty for full export)
2. Click **Start Export** → initiates async operation
3. Watch status indicator:
   - **In Progress** (yellow spinner, auto-polls every 3 seconds)
   - Shows job ID and status URL
4. Wait for **Export Complete** (green checkmark)
5. Review **Output Files** by resource type
6. Click **Preview** on any file → shows first 10 NDJSON rows
7. Check row count (e.g., "50 rows total")
8. Review resource details (Patient, Coverage, Claim, ClaimResponse)
9. Click **Copy cURL** to download full file

**Features:**
- Export parameters: Group ID, `_type`, `_since`
- Async polling with progress tracking
- NDJSON preview with row parsing
- File listings by resource type
- Download links via signed URLs

---

### 6. **Metrics Dashboard** (`/metrics`)
Track PA outcomes and performance analytics.

**Demo Script:**
1. Review **Summary Cards**:
   - Total Requests: 10
   - Approved: 6 (60% approval rate)
   - Pended: 2
   - Denied: 2
   - Avg Latency: 1,200ms
2. Check **Outcome Bar Chart** → visual distribution
3. View **Outcome Pie Chart** → percentage breakdown
4. Review **Latency Line Chart** → response times over last 10 requests
5. Click **Add Mock Event** → generates random PA outcome
6. Watch charts update in real-time
7. Scroll to **Event Log** table:
   - Timestamp, Claim ID, Patient ID, Outcome, Latency
   - Color-coded outcome badges (green/yellow/red)
8. Click **Clear All** to reset event store

**Features:**
- In-memory event store with mock data
- Summary cards with key metrics
- Recharts: Bar, pie, line charts
- Real-time updates
- Sortable event log table
- Mock event generation for testing

---

## 🧪 Full Workflow Example

**End-to-End PA Submission with DTR:**

1. **DTR** (`/dtr`):
   - Fetch lumbar MRI questionnaire
   - Answer clinical questions (radiculopathy, conservative therapy)
   - Build QuestionnaireResponse
   - Attach to PAS Bundle

2. **PAS** (`/pas`):
   - Use DTR-enhanced Bundle
   - Submit via `Claim/$submit`
   - Review authorization decision
   - Check Timeline for workflow stages

3. **Access** (`/access`):
   - Query submitted Claim with Provider scope
   - Verify ClaimResponse is searchable
   - Test Patient scope for member view

4. **Metrics** (`/metrics`):
   - See new approval event in charts
   - Check latency impact
   - Review event log entry

## 🧪 Testing

### Manual Testing
```bash
# Checklist in .specify/acceptance-criteria.md
npm run dev
# Navigate to each page and verify functionality
```

### Build Test
```bash
npm run build
npm start
```

## 🔍 Troubleshooting

### CORS Errors
```
Access to fetch at 'https://fpas-phi.vercel.app/fhir/Claim/$submit' from origin 'http://localhost:3000' has been blocked by CORS policy
```
**Fix**: Use proxy configuration in `.env.local`:
```bash
NEXT_PUBLIC_FHIR_BASE=/api/fhir
NEXT_PUBLIC_CDS_BASE=/api
```
Then redeploy or restart dev server.

### 404 Not Found
```
GET /fhir/Claim/$submit → 404
```
**Fix**: Check FPAS backend is deployed and endpoints are correct. Verify with:
```bash
curl https://fpas-phi.vercel.app/
# Should return CapabilityStatement with available operations
```

### Invalid Token
```
OperationOutcome: "Invalid or missing Authorization header"
```
**Fix**: Check TokenSwitcher is passing token correctly. Verify in DevTools Network tab:
```
Request Headers:
Authorization: Bearer mock-provider-token
```
If FPAS enforces real OAuth, update tokens in `.env.local` or implement SMART App Launch.

### Example Mismatch
```
OperationOutcome: "Patient/pat-001 not found"
```
**Fix**: Update example patient IDs in `lib/examples/*.json` to match FPAS seed data. Check FPAS documentation for valid patient IDs.

### Build Errors
```
Module not found: Can't resolve '@/components/...'
```
**Fix**: Check `tsconfig.json` has correct path aliases:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

## 📦 Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Production deploy
vercel --prod
```

### Environment Variables in Vercel
Add these in the Vercel dashboard under Settings → Environment Variables:
- `NEXT_PUBLIC_FHIR_BASE`
- `NEXT_PUBLIC_CDS_BASE`
- `NEXT_PUBLIC_DEFAULT_PATIENT`

## 📚 Documentation

- **Proposal**: `.specify/proposal.md` - Business case and scope
- **Technical Plan**: `.specify/plan.md` - Architecture and implementation details
- **Tasks**: `.specify/tasks.md` - Development task breakdown
- **Acceptance Criteria**: `.specify/acceptance-criteria.md` - Testing requirements
- **Risks**: `.specify/risks.md` - Risk assessment and mitigation

## 🤝 Contributing

This is a POC project. For production use, consider:
- Adding automated tests (Jest, Playwright)
- Implementing SMART on FHIR authentication
- Adding accessibility compliance (WCAG 2.1)
- Enhancing error handling and retry logic
- Optimizing bundle size and performance

## 📄 License

MIT

## 🔗 Related Projects

- **FPAS Backend**: https://github.com/FHIR-IQ/FPAS
- **FPAS API**: https://fpas-phi.vercel.app

## 📞 Support

For issues or questions:
- Open an issue on GitHub
- Check `.specify/` documentation
- Review FPAS API documentation

---

**Status**: 🚧 In Development
**Version**: 1.0.0-alpha
**Last Updated**: 2025-09-29