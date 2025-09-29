# Coverage Requirements Discovery (CRD) Integration Guide

## Overview

The FHIR IQ Prior Authorization System now supports Coverage Requirements Discovery (CRD) hooks that integrate seamlessly with Electronic Health Record (EHR) systems using the CDS Hooks specification. This enables real-time prior authorization awareness and DTR (Documentation Templates and Rules) triggering during clinical workflows.

## Architecture

```
EHR System → CDS Hooks → CRD Service → DTR Launch → PA Workflow
     ↓           ↓            ↓           ↓           ↓
  Order Entry  Hook Firing  PA Check   DTR Form   Auto-Submit
```

## Supported Hooks

### 1. order-select Hook

**Endpoint:** `POST /cds-services/pa-order-select`

**Purpose:** Fires when providers select orders in CPOE, providing early PA awareness.

**Response:** Informational cards with DTR launch links for orders requiring PA.

### 2. order-sign Hook

**Endpoint:** `POST /cds-services/pa-order-sign`

**Purpose:** Final validation before order commitment, ensuring DTR completion.

**Response:** Blocking cards if DTR is incomplete, informational cards if complete.

## Discovery Endpoint

**Endpoint:** `GET /cds-services`

Returns available hook services and their configuration:

```json
{
  "services": [
    {
      "hook": "order-select",
      "title": "Prior Authorization Order Select",
      "description": "Checks if selected orders require prior authorization and provides DTR links",
      "id": "pa-order-select",
      "prefetch": {
        "patient": "Patient/{{context.patientId}}",
        "encounter": "Encounter/{{context.encounterId}}",
        "practitioner": "Practitioner/{{context.userId}}"
      }
    },
    {
      "hook": "order-sign",
      "title": "Prior Authorization Order Sign",
      "description": "Final check for PA requirements and DTR completion before order submission",
      "id": "pa-order-sign",
      "prefetch": {
        "patient": "Patient/{{context.patientId}}",
        "encounter": "Encounter/{{context.encounterId}}",
        "practitioner": "Practitioner/{{context.userId}}",
        "coverage": "Coverage?patient={{context.patientId}}&status=active"
      }
    }
  ]
}
```

## Hook Request Format

### order-select Request

```json
{
  "hook": "order-select",
  "hookInstance": "hook-instance-123",
  "fhirServer": "https://ehr-fhir.example.com/fhir",
  "fhirAuthorization": {
    "access_token": "Bearer-token",
    "token_type": "Bearer",
    "expires_in": 3600,
    "scope": "user/*.read patient/*.read",
    "subject": "Practitioner/pract-123"
  },
  "context": {
    "userId": "Practitioner/pract-123",
    "patientId": "Patient/patient-456",
    "encounterId": "Encounter/encounter-789",
    "selections": ["ServiceRequest/service-123"],
    "draftOrders": {
      "resourceType": "Bundle",
      "type": "collection",
      "entry": [
        {
          "resource": {
            "resourceType": "ServiceRequest",
            "id": "service-123",
            "status": "draft",
            "intent": "order",
            "code": {
              "coding": [
                {
                  "system": "http://www.ama-assn.org/go/cpt",
                  "code": "72148",
                  "display": "MRI Lumbar Spine"
                }
              ]
            },
            "subject": {
              "reference": "Patient/patient-456"
            }
          }
        }
      ]
    }
  }
}
```

## Hook Response Format

### PA Required Response

```json
{
  "cards": [
    {
      "uuid": "card-uuid-123",
      "summary": "Prior Authorization Required: MRI Lumbar Spine",
      "indicator": "warning",
      "detail": "The selected order (72148) requires prior authorization. Complete the DTR questionnaire to expedite the approval process.",
      "source": {
        "label": "FHIR IQ PAS System",
        "url": "https://fhir-iq-pas.example.com"
      },
      "links": [
        {
          "label": "Complete DTR Questionnaire",
          "url": "http://localhost:3000/dtr-launch?iss=https://ehr-fhir.example.com/fhir&launch=launch-token&patient=patient-456&order=service-123&code=72148",
          "type": "smart",
          "appContext": "{\"orderId\":\"service-123\",\"patientId\":\"patient-456\",\"orderCode\":\"72148\"}"
        },
        {
          "label": "View PA Requirements",
          "url": "https://fhir-iq-pas.example.com/requirements/72148",
          "type": "absolute"
        }
      ]
    }
  ]
}
```

### DTR Completion Required (Blocking)

```json
{
  "cards": [
    {
      "uuid": "card-uuid-456",
      "summary": "DTR Completion Required: MRI Lumbar Spine",
      "indicator": "critical",
      "detail": "This order requires prior authorization with DTR questionnaire completion before it can be submitted. Please complete the DTR process first.",
      "source": {
        "label": "FHIR IQ PAS System"
      },
      "links": [
        {
          "label": "Complete Required DTR",
          "url": "http://localhost:3000/dtr-launch?iss=https://ehr-fhir.example.com/fhir&launch=launch-token&patient=patient-456&order=service-123&code=72148",
          "type": "smart",
          "appContext": "{\"orderId\":\"service-123\",\"patientId\":\"patient-456\",\"required\":true}"
        }
      ]
    }
  ]
}
```

## DTR SMART App Launch

The CRD service generates SMART launch URLs that trigger DTR data collection:

**Launch URL Format:**
```
http://localhost:3000/dtr-launch?iss={fhirServer}&launch={launchToken}&patient={patientId}&order={orderId}&code={procedureCode}
```

**SMART Configuration Endpoint:** `GET /.well-known/smart-configuration`

## Prior Authorization Codes

The system recognizes the following procedure codes as requiring PA:

### Advanced Imaging
- `70551`, `70552`, `70553` - Brain MRI
- `72148`, `72149`, `72158` - Lumbar spine MRI
- `73721`, `73722`, `73723` - Lower extremity MRI

### Surgical Procedures
- `63030`, `63047`, `63056` - Lumbar decompression
- `27447`, `27130`, `27236` - Joint replacement

### DME/Equipment
- `E0143`, `E0144`, `E0147` - Walker equipment
- `E0950`, `E0951`, `E0952` - Wheelchair equipment
- `E1390`, `E1391`, `E1392` - Oxygen equipment

### High-cost Medications
- `J1745`, `J3262`, `J9035` - Specialty drugs

## EHR Integration Steps

### 1. Hook Registration

EHRs should discover available hooks:

```bash
curl -X GET http://localhost:3000/cds-services
```

### 2. Hook Firing

Fire hooks during clinical workflows:

```bash
# Order Selection
curl -X POST http://localhost:3000/cds-services/pa-order-select \
  -H "Content-Type: application/json" \
  -d @order-select-request.json

# Order Signing
curl -X POST http://localhost:3000/cds-services/pa-order-sign \
  -H "Content-Type: application/json" \
  -d @order-sign-request.json
```

### 3. Card Display

Present returned cards to providers with appropriate indicators:
- **Info:** Informational messages
- **Warning:** PA requirements, DTR links
- **Critical:** Blocking messages, required actions

### 4. SMART Launch

Handle SMART launch links for DTR completion:
- Open in iframe or new window
- Handle completion callbacks
- Refresh order state after DTR submission

## Testing the Integration

Use the provided demo script to test CRD functionality:

```bash
# Run CRD demo
npm run demo:crd

# Test individual components
curl -X GET http://localhost:3000/cds-services
curl -X POST http://localhost:3000/cds-services/pa-order-select -d @test-data.json
```

## Error Handling

### Hook Errors

The service handles errors gracefully and returns appropriate error cards:

```json
{
  "cards": [
    {
      "uuid": "error-card-123",
      "summary": "Error checking prior authorization requirements",
      "indicator": "warning",
      "detail": "Unable to determine if orders require prior authorization. Please check manually.",
      "source": {
        "label": "FHIR IQ PAS System"
      }
    }
  ]
}
```

### DTR Launch Errors

DTR launch failures return structured error responses:

```json
{
  "error": "launch_failed",
  "error_description": "Unable to launch DTR application"
}
```

## Security Considerations

1. **Authentication:** Hooks require valid FHIR authorization
2. **CORS:** Configured for EHR integration
3. **Launch Tokens:** Generated securely for SMART launches
4. **Audit Logging:** All hook calls are logged for compliance

## Compliance & Standards

- **CDS Hooks v1.0** specification compliance
- **SMART on FHIR v2** launch framework
- **HL7 Da Vinci CRD** Implementation Guide
- **HL7 Da Vinci DTR** Implementation Guide

## Next Steps for Pilot

1. **EHR Vendor Integration**
   - Partner with EHR vendors for hook implementation
   - Provide integration testing environments
   - Document vendor-specific configurations

2. **Provider Training**
   - Train clinical staff on new PA workflow
   - Provide documentation for hook-triggered DTR
   - Establish support processes

3. **Monitoring & Analytics**
   - Track hook firing patterns
   - Monitor DTR completion rates
   - Measure PA approval timeline improvements

4. **Production Hardening**
   - Implement rate limiting for hooks
   - Add comprehensive error recovery
   - Establish SLA monitoring

## Support

For technical integration support:
- API Documentation: `/docs`
- Demo Scripts: `npm run demo:crd`
- Integration Testing: Contact FHIR IQ team