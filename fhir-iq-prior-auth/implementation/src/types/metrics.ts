/**
 * Public Reporting & SLA Metrics Type Definitions
 *
 * Defines TypeScript interfaces for CMS-0057-F compliant metrics and SLA reporting.
 * Used for public transparency APIs and internal performance monitoring.
 */

export interface MetricsResponse<T = any> {
  metadata: MetricsMetadata;
  summary: MetricsSummary;
  data: T;
  links: MetricsLinks;
}

export interface MetricsMetadata {
  reportingPeriod: {
    start: string;        // ISO 8601 timestamp
    end: string;          // ISO 8601 timestamp
    periodType: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
  };
  generatedAt: string;    // Report generation timestamp
  dataFreshness: string;  // Last data update timestamp
  version: string;        // API version
  disclaimer: string;     // Legal/compliance disclaimer
}

export interface MetricsSummary {
  totalRequests: number;
  slaCompliance: number;        // Percentage
  systemAvailability: number;   // Percentage
  averageDecisionTime: number;  // Hours
  expeditedRequests?: number;
  expeditedSlaCompliance?: number;
}

export interface MetricsLinks {
  self: string;               // Current request URL
  related?: string[];         // Related metric URLs
  documentation: string;      // API documentation
  compliance?: string;        // Compliance information
  quarterly?: string;         // Quarterly report URL
}

// Decision Time Metrics
export interface DecisionTimeMetrics {
  expedited: DecisionTimeCategory;
  standard: DecisionTimeCategory;
}

export interface DecisionTimeCategory {
  description: string;
  slaWindow: string;
  totalRequests: number;
  slaCompliant: number;
  complianceRate: number;

  metrics: {
    averageHours: number;
    medianHours: number;
    p95Hours: number;
    p99Hours: number;
  };

  distribution: Record<string, number>;
  sampleTimestamps: DecisionTimestamp[];
}

export interface DecisionTimestamp {
  claimId: string;
  submittedAt: string;      // ISO 8601 timestamp
  decidedAt: string;        // ISO 8601 timestamp
  elapsedHours: number;
  businessHours?: number;   // Business hours only (for standard requests)
  slaCompliant: boolean;
  disposition: AuthorizationDisposition;
  reason?: string;
  escalationFlag?: boolean;
  urgentIndicator?: string;
  businessDays?: string;    // Human-readable business day description
}

// Authorization Outcome Types
export enum AuthorizationDisposition {
  APPROVED = 'approved',
  DENIED = 'denied',
  PARTIAL_APPROVAL = 'partial',
  PENDED_CLINICAL_REVIEW = 'pended.clinical',
  PENDED_MISSING_INFO = 'pended.information',
  PENDED_PROVIDER_RESPONSE = 'pended.provider',
  IN_REVIEW = 'reviewing',
  CANCELLED = 'cancelled',
  ERROR = 'error'
}

export interface AuthorizationOutcomes {
  overall: OutcomesSummary;
  byServiceType: ServiceTypeOutcomes;
  denialReasons: DenialReasonCategories;
}

export interface OutcomesSummary {
  approved: OutcomeMetric;
  denied: OutcomeMetric;
  pended: OutcomeMetric;
  cancelled: OutcomeMetric;
  error: OutcomeMetric;
}

export interface OutcomeMetric {
  count: number;
  percentage: number;
  averageDecisionTime: number;
}

export interface ServiceTypeOutcomes {
  imaging: {
    mri: ServiceMetrics;
    ct: ServiceMetrics;
    pet: ServiceMetrics;
  };
  surgery: {
    orthopedic: ServiceMetrics;
    cardiac: ServiceMetrics;
  };
  specialty: {
    oncology: ServiceMetrics;
    dme: ServiceMetrics;
  };
}

export interface ServiceMetrics {
  totalRequests: number;
  approved: number;
  approvalRate: number;
  denied: number;
  denialRate: number;
  pended: number;
  pendRate: number;
  averageDecisionTime: number;
}

export interface DenialReasonCategories {
  medical: Record<string, number>;
  administrative: Record<string, number>;
  coverage: Record<string, number>;
  technical: Record<string, number>;
}

// Volume and Performance Metrics
export interface VolumeMetrics {
  dailyVolume: DailyVolumeMetrics;
  weeklyTrends: WeeklyTrend[];
  geographicDistribution: Record<string, GeographicMetric>;
}

export interface DailyVolumeMetrics {
  peak: {
    date: string;           // YYYY-MM-DD format
    requests: number;
    hour: string;           // HH:MM-HH:MM format
    hourlyPeak: number;
  };
  average: number;
  minimum: {
    date: string;
    requests: number;
    reason?: string;
  };
}

export interface WeeklyTrend {
  week: string;             // "YYYY-MM-DD to YYYY-MM-DD"
  requests: number;
  decisions: number;
  slaCompliance: number;
}

export interface GeographicMetric {
  requests: number;
  approvalRate: number;
  averageDecisionTime: number;
}

// System Performance Metrics
export interface SystemPerformance {
  apiMetrics: ApiPerformanceMetrics;
  queueMetrics: Record<string, QueueMetrics>;
}

export interface ApiPerformanceMetrics {
  availability: {
    percentage: number;
    downtimeMinutes: number;
    plannedMaintenanceMinutes: number;
    unplannedOutages: number;
  };

  responseTime: Record<string, ResponseTimeMetrics>;

  errorRates: {
    total: number;
    '4xxErrors': number;
    '5xxErrors': number;
    timeouts: number;
  };
}

export interface ResponseTimeMetrics {
  p50: number;              // Median response time in milliseconds
  p95: number;              // 95th percentile
  p99: number;              // 99th percentile
  average: number;          // Average response time
}

export interface QueueMetrics {
  averageProcessingTime: number;    // Minutes
  medianProcessingTime: number;     // Minutes
  jobsProcessed: number;
  jobsFailed: number;
  failureRate: number;              // Percentage
}

// Compliance and Quality Metrics
export interface ComplianceMetrics {
  slaCompliance: SLAComplianceMetrics;
  dataQuality: DataQualityMetrics;
  auditTrail: AuditTrailMetrics;
}

export interface SLAComplianceMetrics {
  expedited72Hours: SLATarget;
  standard14Days: SLATarget;
}

export interface SLATarget {
  target: number;           // Target percentage
  actual: number;           // Actual achievement
  status: 'exceeding' | 'meeting' | 'below';
  monthOverMonth: string;   // Percentage change with +/- sign
}

export interface DataQualityMetrics {
  completeness: number;     // Percentage
  accuracy: number;         // Percentage
  timeliness: number;       // Percentage
  lastValidation: string;   // ISO 8601 timestamp
}

export interface AuditTrailMetrics {
  recordsAudited: number;
  auditCompliance: number;  // Percentage
  lastAuditDate: string;    // ISO 8601 timestamp
  nextScheduledAudit: string; // ISO 8601 timestamp
}

// Time Window Assertion for SLA Compliance
export interface TimeWindowAssertion {
  description: string;
  expeditedSamples: ExpeditedSample[];
  standardSamples: StandardSample[];
}

export interface ExpeditedSample {
  claimId: string;
  submittedAt: string;      // ISO 8601 timestamp
  decidedAt: string;        // ISO 8601 timestamp
  windowStart: string;      // ISO 8601 timestamp
  window72hEnd: string;     // ISO 8601 timestamp (72 hours after submission)
  actualElapsedHours: number;
  withinWindow: boolean;
  bufferHours?: number;     // Hours remaining if within window
  excessHours?: number;     // Hours exceeded if outside window
  urgentIndicator: string;
  escalationFlag?: boolean;
  businessDays: string;     // Human-readable description
}

export interface StandardSample {
  claimId: string;
  submittedAt: string;      // ISO 8601 timestamp
  decidedAt: string;        // ISO 8601 timestamp
  windowStart: string;      // ISO 8601 timestamp
  window7dEnd: string;      // ISO 8601 timestamp (7 days after submission)
  window14dEnd: string;     // ISO 8601 timestamp (14 days after submission)
  actualElapsedHours: number;
  businessHours: number;    // Business hours only
  within7Days: boolean;
  within14Days: boolean;
  bufferDays?: number;      // Days remaining if within window
  serviceType: string;
  businessDays: string;     // Human-readable description with exclusions
}

// API Query Parameters
export interface MetricsQueryParams {
  period?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
  start?: string;           // ISO 8601 date
  end?: string;             // ISO 8601 date
  serviceType?: string;     // Filter by service type
  region?: string;          // Geographic filter
  providerType?: string;    // Filter by provider organization type
  expedited?: boolean;      // Filter for expedited requests only
  format?: 'json' | 'csv' | 'xlsx'; // Response format
}

// Metrics Calculation Context
export interface MetricsCalculationContext {
  includeBusinessHours: boolean;
  excludeHolidays: boolean;
  timeZone: string;         // IANA timezone identifier
  businessDayStart: string; // HH:MM format
  businessDayEnd: string;   // HH:MM format
  businessDays: number[];   // 0-6, where 0 is Sunday
  holidays: string[];       // Array of YYYY-MM-DD dates
}

// Error types for metrics API
export interface MetricsError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  correlationId: string;
}

// Metrics service configuration
export interface MetricsConfig {
  retentionPeriodDays: number;
  aggregationIntervals: string[];
  publicEndpointsEnabled: boolean;
  authenticationRequired: boolean;
  rateLimitPerHour: number;
  dataRefreshIntervalMinutes: number;
  complianceThresholds: {
    expeditedSLA: number;     // Percentage threshold for expedited SLA
    standardSLA: number;      // Percentage threshold for standard SLA
    systemAvailability: number; // Percentage threshold for availability
    dataQuality: number;      // Percentage threshold for data quality
  };
}