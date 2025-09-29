# Public Reporting & SLA Metrics Specification

## Overview

This specification defines public-facing metrics and Service Level Agreement (SLA) reporting requirements for the FHIR IQ Prior Authorization System, in compliance with CMS-0057-F transparency and performance standards.

## CMS-0057-F Public Reporting Requirements

### Required Metrics Categories

1. **Decision Turnaround Times**
   - Average and median response times
   - Split by expedited vs. standard requests
   - Compliance with 72-hour and 7-day SLA windows

2. **Authorization Outcomes**
   - Approval rates by service type
   - Denial rates with reason categories
   - Pend rates and resolution times

3. **Volume and Utilization**
   - Prior authorization volume by service
   - Peak hour/day analysis
   - Provider and payer distribution

4. **System Performance**
   - API availability and uptime
   - Error rates and types
   - Queue processing metrics

## Service Level Agreements (SLAs)

### Standard Prior Authorization Requests

| Metric | Target | Measurement Window |
|--------|--------|-------------------|
| **Expedited Decisions** | ≤ 72 hours | Rolling 7-day average |
| **Standard Decisions** | ≤ 14 calendar days | Rolling 30-day average |
| **API Availability** | ≥ 99.5% | Monthly uptime |
| **Response Time (P95)** | ≤ 2 seconds | Hourly measurement |
| **Queue Processing** | ≤ 5 minutes | Per-job processing time |

### Expedited Request Criteria

Expedited processing applies to requests containing:
- Red flag clinical indicators
- Emergency or urgent care scenarios
- Life-threatening conditions
- Time-sensitive procedures

## Metrics Collection Framework

### Data Sources

```typescript
interface MetricsDataSource {
  claimSubmissions: {
    source: 'fhir_audit_log',
    events: ['pas.claim.submitted', 'pas.claim.received']
  };

  decisions: {
    source: 'decision_engine_log',
    events: ['decision.rendered', 'decision.approved', 'decision.denied', 'decision.pended']
  };

  apiPerformance: {
    source: 'application_metrics',
    events: ['http.request', 'queue.job.completed', 'error.occurred']
  };

  clinicalData: {
    source: 'dtr_prepopulation_log',
    events: ['dtr.questionnaire.populated', 'clinical.data.extracted']
  };
}
```

### Aggregation Periods

- **Real-time**: Current hour metrics
- **Daily**: 24-hour rolling windows
- **Weekly**: 7-day rolling averages
- **Monthly**: 30-day compliance periods
- **Quarterly**: Regulatory reporting cycles

## Decision Time Metrics

### Calculation Methodology

```typescript
interface DecisionTimeCalculation {
  submissionTimestamp: string;     // ISO 8601 format
  decisionTimestamp: string;       // ISO 8601 format
  businessHoursOnly: boolean;      // Exclude weekends/holidays
  expeditedFlag: boolean;          // Red flag or urgent indicator

  // Calculated fields
  totalElapsedHours: number;       // Wall clock time
  businessElapsedHours: number;    // Business hours only
  slaCompliant: boolean;           // Met 72h/14d targets
  slaBuffer: number;               // Hours remaining/exceeded
}
```

### SLA Compliance Windows

#### 72-Hour Expedited Window
- **Start**: PAS Bundle received and validated
- **Stop**: ClaimResponse generated with final disposition
- **Exclusions**: System maintenance windows, force majeure events
- **Business Hours**: 24/7 for expedited requests

#### 14-Day Standard Window
- **Start**: PAS Bundle received and validated
- **Stop**: ClaimResponse generated with final disposition
- **Exclusions**: Weekends, federal holidays, maintenance windows
- **Business Hours**: Monday-Friday, 8 AM - 6 PM local time

## Authorization Outcome Categories

### Disposition Taxonomy

```typescript
enum AuthorizationDisposition {
  // Final Outcomes
  APPROVED = 'approved',
  DENIED = 'denied',
  PARTIAL_APPROVAL = 'partial',

  // Interim States
  PENDED_CLINICAL_REVIEW = 'pended.clinical',
  PENDED_MISSING_INFO = 'pended.information',
  PENDED_PROVIDER_RESPONSE = 'pended.provider',

  // System States
  IN_REVIEW = 'reviewing',
  CANCELLED = 'cancelled',
  ERROR = 'error'
}
```

### Denial Reason Categories

```typescript
interface DenialReasonTaxonomy {
  category: 'medical' | 'administrative' | 'coverage' | 'technical';

  // Medical Necessity
  medicalReasons: [
    'insufficient.clinical.evidence',
    'alternative.treatment.available',
    'experimental.investigational',
    'not.medically.necessary'
  ];

  // Administrative Issues
  administrativeReasons: [
    'missing.documentation',
    'invalid.provider.credentials',
    'incorrect.patient.information',
    'duplicate.request'
  ];

  // Coverage Limitations
  coverageReasons: [
    'service.not.covered',
    'benefit.limits.exceeded',
    'prior.authorization.not.required',
    'member.not.eligible'
  ];

  // Technical Errors
  technicalReasons: [
    'invalid.fhir.format',
    'missing.required.fields',
    'system.processing.error',
    'timeout.occurred'
  ];
}
```

## Volume and Utilization Metrics

### Service Type Classifications

Based on CPT codes and clinical categories:

```typescript
interface ServiceVolumeMetrics {
  // High-Volume Services
  imaging: {
    mri: ['70549', '72148', '72149', '73721'],
    ct: ['70450', '70470', '74150', '74170'],
    pet: ['78811', '78812', '78813', '78816']
  };

  // Surgical Procedures
  surgery: {
    orthopedic: ['29881', '27447', '23412'],
    cardiac: ['93451', '93460', '33533'],
    neurosurgery: ['61510', '63030', '64721']
  };

  // Specialty Services
  specialty: {
    oncology: ['96413', '96365', 'J9035'],
    rehabilitation: ['97110', '97140', '97530'],
    dme: ['E0140', 'E0141', 'K0108']
  };
}
```

### Geographic and Provider Distribution

```typescript
interface DistributionMetrics {
  geographic: {
    state: string;
    region: 'northeast' | 'southeast' | 'midwest' | 'southwest' | 'west';
    ruralUrban: 'urban' | 'rural' | 'suburban';
    volume: number;
    averageDecisionTime: number;
  };

  provider: {
    npi: string;
    specialty: string;
    organizationType: 'hospital' | 'clinic' | 'individual' | 'group';
    monthlyVolume: number;
    approvalRate: number;
  };
}
```

## Performance Monitoring

### API Performance Metrics

```typescript
interface ApiPerformanceMetrics {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';

  // Response Time Distribution
  responseTime: {
    p50: number;    // Median
    p95: number;    // 95th percentile
    p99: number;    // 99th percentile
    average: number;
    max: number;
  };

  // Throughput Metrics
  throughput: {
    requestsPerMinute: number;
    requestsPerHour: number;
    peakRpm: number;
  };

  // Error Metrics
  errors: {
    rate: number;           // Percentage of failed requests
    count4xx: number;       // Client errors
    count5xx: number;       // Server errors
    timeouts: number;       // Request timeouts
  };
}
```

### Queue Processing Metrics

```typescript
interface QueueMetrics {
  queueName: string;

  // Processing Statistics
  processing: {
    jobsProcessed: number;
    jobsFailed: number;
    averageProcessingTime: number;
    medianProcessingTime: number;
  };

  // Queue Health
  health: {
    activeJobs: number;
    waitingJobs: number;
    delayedJobs: number;
    failedJobs: number;
    queueLength: number;
  };

  // Worker Performance
  workers: {
    activeWorkers: number;
    idleWorkers: number;
    averageConcurrency: number;
  };
}
```

## Public Metrics API Specification

### Endpoints

```yaml
# Real-time Dashboard Metrics
GET /metrics/dashboard
  - Current hour statistics
  - System health indicators
  - Active processing counts

# Historical Performance Data
GET /metrics/performance?period={daily|weekly|monthly}
  - SLA compliance trends
  - Decision time distributions
  - Volume patterns

# Service-Specific Reports
GET /metrics/services/{serviceType}?period={period}
  - Authorization rates by service
  - Average processing times
  - Volume trends

# Public Transparency Report
GET /metrics/public-report?quarter={YYYY-Q}
  - Quarterly compliance summary
  - Aggregate statistics
  - Regulatory metrics
```

### Response Format Standards

All metrics endpoints return data in this standardized format:

```typescript
interface MetricsResponse {
  metadata: {
    reportingPeriod: {
      start: string;        // ISO 8601 timestamp
      end: string;          // ISO 8601 timestamp
      periodType: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
    };

    generatedAt: string;    // Report generation timestamp
    dataFreshness: string;  // Last data update timestamp
    version: string;        // API version

    disclaimer: string;     // Legal/compliance disclaimer
  };

  summary: {
    totalRequests: number;
    slaCompliance: number;  // Percentage
    systemAvailability: number; // Percentage
    averageDecisionTime: number; // Hours
  };

  data: any;               // Metric-specific payload

  links: {
    self: string;          // Current request URL
    related?: string[];    // Related metric URLs
    documentation: string; // API documentation
  };
}
```

## Sample JSON Response

See the detailed sample JSON response in the next section showing a complete public metrics page with 72-hour and 7-day SLA compliance data.

## Compliance and Audit Trail

### Data Retention Requirements

- **Raw Metrics**: 7 years (regulatory requirement)
- **Aggregated Reports**: 10 years (compliance archive)
- **Audit Logs**: 7 years (SOX compliance)
- **Public Reports**: Permanent (transparency requirement)

### Quality Assurance

```typescript
interface MetricsQualityChecks {
  dataValidation: {
    completeness: number;    // Percentage of expected records
    accuracy: number;        // Validation pass rate
    timeliness: number;      // On-time data arrival rate
  };

  reconciliation: {
    sourceSystemMatch: boolean;  // Matches operational data
    crossMetricConsistency: boolean; // Internal consistency checks
    historicalTrendValidation: boolean; // Trend anomaly detection
  };

  auditTrail: {
    dataLineage: string[];   // Source system tracking
    transformationLog: any[]; // Processing steps applied
    approvalChain: string[]; // Review and approval history
  };
}
```

### Regulatory Reporting

Automated generation of regulatory compliance reports:

- **CMS Prior Authorization Transparency Reports**
- **State Insurance Commission Filings**
- **Federal Trade Commission Metrics**
- **Office of Inspector General Audits**

All reports include attestation of data accuracy and completeness by authorized personnel.