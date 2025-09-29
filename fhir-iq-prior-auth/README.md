# FHIR IQ Prior Authorization System (PAS) - Proof of Concept

A comprehensive implementation of the HL7 Da Vinci Prior Authorization Support (PAS) and Documentation Templates and Rules (DTR) Implementation Guides, designed to demonstrate CMS-0057-F compliance for automated prior authorization workflows.

## 🏥 Overview

This proof-of-concept implements a complete prior authorization system that bridges the gap between healthcare providers and payers through standardized FHIR R4 interfaces. The system automates clinical documentation collection, applies evidence-based decision rules, and provides real-time authorization decisions.

### Key Features

- **🔐 SMART on FHIR v2 Security**: OAuth2 with provider/patient/system scopes
- **📋 DTR Integration**: Automated questionnaire retrieval and clinical data prepopulation
- **🤖 Intelligent Decision Engine**: Evidence-based authorization rules
- **⚡ Real-time Processing**: Synchronous and asynchronous workflow support
- **🏗️ FHIR R4 Compliant**: Full adherence to Da Vinci PAS/DTR Implementation Guides
- **📊 Comprehensive Monitoring**: Audit logging, metrics, and status tracking

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm 9+
- **Redis** 7+ (for queue management)
- **Git** for version control

### 1. Installation

```bash
git clone <repository-url>
cd fhir-iq-prior-auth/implementation
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Configure your environment (minimal required settings)
cat > .env << EOF
NODE_ENV=development
PORT=8080
FHIR_BASE_URL=http://localhost:8080/fhir
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-change-in-production
EOF
```

### 3. Start Dependencies

```bash
# Start Redis (using Docker)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Or install Redis locally on your system
```

### 4. Launch the Server

```bash
# Development mode with auto-reload
npm run dev

# Or build and run in production mode
npm run build
npm start
```

The server will start on `http://localhost:8080` with:
- **API Endpoint**: `http://localhost:8080/fhir`
- **Interactive Documentation**: `http://localhost:8080/docs`
- **Health Check**: `http://localhost:8080/health`

## 🧪 Interactive Demos

### Run Complete Workflow Demo

Experience the full end-to-end prior authorization workflow:

```bash
cd implementation
npm run demo:full-workflow
```

This demo will:
1. 👤 Set up patient and provider context
2. 📋 Retrieve and prepopulate DTR questionnaire
3. 📤 Submit prior authorization request
4. ⚖️ Apply clinical decision rules
5. ✅ Display authorization decision

### Individual Component Demos

```bash
# Submit a prior authorization request
npm run demo:submit

# Check authorization status
npm run demo:status -- --patient patient-example-jane-doe

# Demonstrate DTR workflow
npm run demo:dtr -- --service lumbar-mri

# Seed test data
npm run demo:testdata
```

---

**🏥 Built for Healthcare Interoperability | 🔒 FHIR R4 Compliant | ⚖️ Evidence-Based Decisions**
