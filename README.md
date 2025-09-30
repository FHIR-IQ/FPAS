# FPAS UI - Interactive API Tester & Demo

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)](https://tailwindcss.com/)

> Interactive web application for testing and demonstrating the FHIR IQ Prior Authorization System (FPAS) APIs

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
# .env.local
NEXT_PUBLIC_FHIR_BASE=https://fpas-phi.vercel.app/fhir
NEXT_PUBLIC_CDS_BASE=https://fpas-phi.vercel.app
NEXT_PUBLIC_DEFAULT_PATIENT=pat-001
```

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

## 📋 Available Pages

| Page | Path | Description |
|------|------|-------------|
| **Landing** | `/` | Overview and feature navigation |
| **PAS Submission** | `/pas` | Test Claim/$submit operation |
| **DTR Workflow** | `/dtr` | Questionnaire form and submission |
| **CDS Hooks** | `/cds` | Test CDS Hooks integration |
| **Provider Access** | `/access` | Query historical PA data |
| **Bulk Export** | `/bulk` | Bulk FHIR data export demo |
| **Metrics** | `/metrics` | PA metrics visualization |

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