# FHIR IQ Prior Authorization API (CMS-0057-F) — POC

## Executive Summary

Deliver a FHIR-native Prior Authorization API and Provider/Patient access endpoints to demonstrate compliance with CMS-0057-F and reduce provider burden.

## What & Why (Business Intent)

### Core Objectives
- **FHIR-Native PA**: Deliver a modern Prior Authorization API aligned to HL7 Da Vinci PAS (PA transaction) and DTR (documentation requirements)
- **CMS Compliance**: Demonstrate compliance path for CMS-0057-F interoperability requirements
- **End-to-End Flow**: Show working path from order → documentation → PA submit → decision
- **Payer-Centric POC**: Build from payer perspective but extensible to CRD and broader FHIR platform use cases

### Value Drivers
- Reduce provider burden through automated documentation collection
- Enable real-time PA decisions for qualifying procedures
- Provide transparency via Provider and Patient Access APIs
- Establish foundation for Payer-to-Payer bulk exchange and quality measures

## Users & Outcomes

### Primary Users

**Providers/EHRs**
- Submit PA requests directly from workflow
- Auto-prefill documentation via DTR/CQL
- Retrieve status and decisions in real-time
- Reduce administrative time by 50%

**Payers/UM Teams**
- Receive structured FHIR requests
- Automate adjudication for routine cases
- Return timely, actionable decisions
- Meet CMS-0057-F compliance requirements

**Patients**
- View PA status via Patient Access API
- Understand coverage decisions transparently
- Reduce care delays and abandonment
- Access historical PA data

### Expected Outcomes
- **Technical**: Working FHIR PA submission pipeline with DTR integration
- **Operational**: <24hr turnaround for routine authorizations
- **Compliance**: CMS-0057-F readiness demonstration
- **Strategic**: Foundation for CRD hooks and broader interoperability

## Non-Goals (POC Scope)

To maintain focus on demonstrating core PA capabilities, this POC will NOT include:

- **Full production UM integration**: Will use mock decision engine with simple rules
- **Complete CRD hooks service**: Limited to basic order-select hook for POC
- **Full security policy orchestration**: Static consent toggles and simplified authorization
- **X12 278 bidirectional gateway**: One-way mapping demonstration only
- **Multi-tenant isolation**: Single payer configuration
- **Production-grade monitoring**: Basic metrics only

## POC Deliverables

### Sprint 1-2 (Weeks 1-4)
- FHIR server with PAS operations ($submit, $inquire)
- Basic DTR questionnaire + CQL for sample service
- Mock UM decision engine

### Sprint 3-4 (Weeks 5-8)
- Provider Access API endpoints
- Patient Access API endpoints
- Status polling and updates
- Basic validation suite

### Sprint 5-6 (Weeks 9-12)
- SMART app launcher demo
- Inferno test integration
- Performance metrics dashboard
- Documentation and deployment guide

## Success Criteria

- **Functional**: End-to-end PA submission with automated decision
- **Compliance**: Pass relevant Inferno DTR tests
- **Performance**: <2 second response for synchronous operations
- **Documentation**: Complete API docs and implementation guide

## Investment (POC)

- **Development**: 2 engineers × 3 months = $150K
- **Infrastructure**: Cloud sandbox = $10K
- **Testing/QA**: $15K
- **Total POC**: $175K

## Path to Production

Following successful POC:
1. Production UM integration design
2. Full security implementation
3. Multi-tenant architecture
4. CRD hooks expansion
5. Payer-to-Payer bulk operations