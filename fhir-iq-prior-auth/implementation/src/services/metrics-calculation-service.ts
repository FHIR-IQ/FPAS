/**
 * Metrics Calculation Service
 *
 * Implements SLA compliance calculations and public reporting metrics
 * for CMS-0057-F transparency requirements.
 */

import { logger } from '../utils/logger';
import {
  DecisionTimeMetrics,
  AuthorizationDisposition,
  DecisionTimestamp,
  MetricsCalculationContext,
  TimeWindowAssertion,
  ExpeditedSample,
  StandardSample
} from '../types/metrics';

export class MetricsCalculationService {
  private readonly businessHoursStart = 8; // 8 AM
  private readonly businessHoursEnd = 18;  // 6 PM
  private readonly businessDays = [1, 2, 3, 4, 5]; // Monday-Friday

  /**
   * Calculate decision time metrics with SLA compliance
   */
  calculateDecisionTimeMetrics(decisions: DecisionRecord[]): DecisionTimeMetrics {
    const expedited = decisions.filter(d => d.expedited);
    const standard = decisions.filter(d => !d.expedited);

    return {
      expedited: this.calculateCategoryMetrics(expedited, '72 hours', 72),
      standard: this.calculateCategoryMetrics(standard, '14 calendar days', 14 * 24)
    };
  }

  /**
   * Calculate metrics for a specific category (expedited or standard)
   */
  private calculateCategoryMetrics(
    decisions: DecisionRecord[],
    slaWindow: string,
    slaHours: number
  ) {
    const elapsedTimes = decisions.map(d => this.calculateElapsedHours(d.submittedAt, d.decidedAt));
    const slaCompliant = elapsedTimes.filter(time => time <= slaHours).length;

    return {
      description: slaWindow.includes('72') ? 'Requests requiring decision within 72 hours' : 'Standard prior authorization requests',
      slaWindow,
      totalRequests: decisions.length,
      slaCompliant,
      complianceRate: (slaCompliant / decisions.length) * 100,

      metrics: {
        averageHours: this.average(elapsedTimes),
        medianHours: this.median(elapsedTimes),
        p95Hours: this.percentile(elapsedTimes, 95),
        p99Hours: this.percentile(elapsedTimes, 99)
      },

      distribution: this.calculateDistribution(elapsedTimes, slaWindow),
      sampleTimestamps: this.generateSampleTimestamps(decisions)
    };
  }

  /**
   * Calculate elapsed time between two timestamps in hours
   */
  private calculateElapsedHours(start: string, end: string): number {
    const startTime = new Date(start);
    const endTime = new Date(end);
    return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Calculate business hours elapsed (excluding weekends and holidays)
   */
  calculateBusinessHours(
    start: string,
    end: string,
    context: MetricsCalculationContext
  ): number {
    const startTime = new Date(start);
    const endTime = new Date(end);
    let businessHours = 0;

    const current = new Date(startTime);
    while (current <= endTime) {
      if (this.isBusinessDay(current, context) && !this.isHoliday(current, context)) {
        const dayStart = new Date(current);
        dayStart.setHours(context.businessDayStart ? parseInt(context.businessDayStart.split(':')[0]) : this.businessHoursStart, 0, 0, 0);

        const dayEnd = new Date(current);
        dayEnd.setHours(context.businessDayEnd ? parseInt(context.businessDayEnd.split(':')[0]) : this.businessHoursEnd, 0, 0, 0);

        const periodStart = current < startTime ? startTime : dayStart;
        const periodEnd = current.toDateString() === endTime.toDateString() && endTime < dayEnd ? endTime : dayEnd;

        if (periodStart < periodEnd) {
          businessHours += (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60);
        }
      }

      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
    }

    return Math.max(0, businessHours);
  }

  /**
   * Check if a date falls on a business day
   */
  private isBusinessDay(date: Date, context: MetricsCalculationContext): boolean {
    const dayOfWeek = date.getDay();
    return context.businessDays.includes(dayOfWeek);
  }

  /**
   * Check if a date is a holiday
   */
  private isHoliday(date: Date, context: MetricsCalculationContext): boolean {
    const dateString = date.toISOString().split('T')[0];
    return context.holidays.includes(dateString);
  }

  /**
   * Generate time window assertions for SLA compliance demonstration
   */
  generateTimeWindowAssertion(decisions: DecisionRecord[]): TimeWindowAssertion {
    const expedited = decisions.filter(d => d.expedited).slice(0, 5); // Sample of 5
    const standard = decisions.filter(d => !d.expedited).slice(0, 5); // Sample of 5

    return {
      description: 'Sample records demonstrating SLA compliance measurement within 72-hour and 7-day windows',
      expeditedSamples: expedited.map(d => this.createExpeditedSample(d)),
      standardSamples: standard.map(d => this.createStandardSample(d))
    };
  }

  /**
   * Create expedited sample with 72-hour window calculations
   */
  private createExpeditedSample(decision: DecisionRecord): ExpeditedSample {
    const submittedAt = new Date(decision.submittedAt);
    const decidedAt = new Date(decision.decidedAt);
    const window72hEnd = new Date(submittedAt.getTime() + (72 * 60 * 60 * 1000));

    const elapsedHours = this.calculateElapsedHours(decision.submittedAt, decision.decidedAt);
    const withinWindow = elapsedHours <= 72;

    return {
      claimId: decision.claimId,
      submittedAt: decision.submittedAt,
      decidedAt: decision.decidedAt,
      windowStart: decision.submittedAt,
      window72hEnd: window72hEnd.toISOString(),
      actualElapsedHours: Math.round(elapsedHours * 100) / 100,
      withinWindow,
      bufferHours: withinWindow ? Math.round((72 - elapsedHours) * 100) / 100 : undefined,
      excessHours: !withinWindow ? Math.round((elapsedHours - 72) * 100) / 100 : undefined,
      urgentIndicator: decision.urgentIndicator || 'Clinical urgency documented',
      escalationFlag: !withinWindow,
      businessDays: this.formatBusinessDaysPeriod(submittedAt, decidedAt)
    };
  }

  /**
   * Create standard sample with 7-day and 14-day window calculations
   */
  private createStandardSample(decision: DecisionRecord): StandardSample {
    const submittedAt = new Date(decision.submittedAt);
    const decidedAt = new Date(decision.decidedAt);
    const window7dEnd = new Date(submittedAt.getTime() + (7 * 24 * 60 * 60 * 1000));
    const window14dEnd = new Date(submittedAt.getTime() + (14 * 24 * 60 * 60 * 1000));

    const elapsedHours = this.calculateElapsedHours(decision.submittedAt, decision.decidedAt);
    const businessHours = this.calculateBusinessHours(
      decision.submittedAt,
      decision.decidedAt,
      this.getDefaultBusinessContext()
    );

    const within7Days = elapsedHours <= (7 * 24);
    const within14Days = elapsedHours <= (14 * 24);

    return {
      claimId: decision.claimId,
      submittedAt: decision.submittedAt,
      decidedAt: decision.decidedAt,
      windowStart: decision.submittedAt,
      window7dEnd: window7dEnd.toISOString(),
      window14dEnd: window14dEnd.toISOString(),
      actualElapsedHours: Math.round(elapsedHours * 100) / 100,
      businessHours: Math.round(businessHours * 100) / 100,
      within7Days,
      within14Days,
      bufferDays: within14Days ? Math.round(((14 * 24 - elapsedHours) / 24) * 100) / 100 : undefined,
      serviceType: decision.serviceType || 'Unknown Service',
      businessDays: this.formatBusinessDaysPeriod(submittedAt, decidedAt, true)
    };
  }

  /**
   * Format a human-readable business days description
   */
  private formatBusinessDaysPeriod(start: Date, end: Date, includeExclusions = false): string {
    const startDay = start.toLocaleDateString('en-US', { weekday: 'short' });
    const endDay = end.toLocaleDateString('en-US', { weekday: 'short' });

    const startTime = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const endTime = end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    let description = `${startDay} ${startTime} - ${endDay} ${endTime}`;

    if (includeExclusions) {
      const hasWeekend = this.spansPeriod(start, end, [0, 6]); // Sunday, Saturday
      const hasHolidays = this.hasHolidaysInPeriod(start, end);

      const exclusions = [];
      if (hasWeekend) exclusions.push('weekends');
      if (hasHolidays) exclusions.push('holidays');

      if (exclusions.length > 0) {
        description += ` (excluding ${exclusions.join(' and ')})`;
      }
    }

    return description;
  }

  /**
   * Check if a date range spans specific days of the week
   */
  private spansPeriod(start: Date, end: Date, daysOfWeek: number[]): boolean {
    const current = new Date(start);
    while (current <= end) {
      if (daysOfWeek.includes(current.getDay())) {
        return true;
      }
      current.setDate(current.getDate() + 1);
    }
    return false;
  }

  /**
   * Check if there are holidays in the date range
   */
  private hasHolidaysInPeriod(start: Date, end: Date): boolean {
    const context = this.getDefaultBusinessContext();
    const current = new Date(start);

    while (current <= end) {
      if (this.isHoliday(current, context)) {
        return true;
      }
      current.setDate(current.getDate() + 1);
    }

    return false;
  }

  /**
   * Calculate distribution buckets for elapsed times
   */
  private calculateDistribution(times: number[], slaWindow: string): Record<string, number> {
    if (slaWindow.includes('72')) {
      // Expedited distribution (hours)
      return {
        '0-12_hours': times.filter(t => t <= 12).length,
        '12-24_hours': times.filter(t => t > 12 && t <= 24).length,
        '24-48_hours': times.filter(t => t > 24 && t <= 48).length,
        '48-72_hours': times.filter(t => t > 48 && t <= 72).length,
        'over_72_hours': times.filter(t => t > 72).length
      };
    } else {
      // Standard distribution (days)
      return {
        '0-1_days': times.filter(t => t <= 24).length,
        '1-3_days': times.filter(t => t > 24 && t <= 72).length,
        '3-7_days': times.filter(t => t > 72 && t <= 168).length,
        '7-14_days': times.filter(t => t > 168 && t <= 336).length,
        'over_14_days': times.filter(t => t > 336).length
      };
    }
  }

  /**
   * Generate sample timestamps for public reporting
   */
  private generateSampleTimestamps(decisions: DecisionRecord[]): DecisionTimestamp[] {
    return decisions.slice(0, 3).map(decision => ({
      claimId: decision.claimId,
      submittedAt: decision.submittedAt,
      decidedAt: decision.decidedAt,
      elapsedHours: Math.round(this.calculateElapsedHours(decision.submittedAt, decision.decidedAt) * 100) / 100,
      businessHours: decision.expedited ? undefined : Math.round(this.calculateBusinessHours(
        decision.submittedAt,
        decision.decidedAt,
        this.getDefaultBusinessContext()
      ) * 100) / 100,
      slaCompliant: decision.expedited
        ? this.calculateElapsedHours(decision.submittedAt, decision.decidedAt) <= 72
        : this.calculateElapsedHours(decision.submittedAt, decision.decidedAt) <= 336,
      disposition: decision.disposition,
      reason: decision.reason,
      urgentIndicator: decision.urgentIndicator,
      escalationFlag: decision.escalationFlag,
      businessDays: this.formatBusinessDaysPeriod(
        new Date(decision.submittedAt),
        new Date(decision.decidedAt)
      )
    }));
  }

  /**
   * Statistical calculation helpers
   */
  private average(numbers: number[]): number {
    return Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 100) / 100;
  }

  private median(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
      : Math.round(sorted[mid] * 100) / 100;
  }

  private percentile(numbers: number[], p: number): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return Math.round(sorted[index] * 100) / 100;
  }

  /**
   * Get default business context for calculations
   */
  private getDefaultBusinessContext(): MetricsCalculationContext {
    return {
      includeBusinessHours: true,
      excludeHolidays: true,
      timeZone: 'America/New_York',
      businessDayStart: '08:00',
      businessDayEnd: '18:00',
      businessDays: [1, 2, 3, 4, 5], // Monday-Friday
      holidays: [
        '2024-01-01', // New Year's Day
        '2024-01-15', // MLK Day
        '2024-02-19', // Presidents' Day
        '2024-05-27', // Memorial Day
        '2024-07-04', // Independence Day
        '2024-09-02', // Labor Day
        '2024-10-14', // Columbus Day
        '2024-11-11', // Veterans Day
        '2024-11-28', // Thanksgiving
        '2024-12-25'  // Christmas
      ]
    };
  }

  /**
   * Validate SLA compliance thresholds
   */
  validateSLACompliance(metrics: DecisionTimeMetrics): SLAValidationResult {
    const expeditedTarget = 95.0; // 95% target for 72-hour SLA
    const standardTarget = 90.0;  // 90% target for 14-day SLA

    return {
      expedited: {
        target: expeditedTarget,
        actual: metrics.expedited.complianceRate,
        compliant: metrics.expedited.complianceRate >= expeditedTarget,
        variance: metrics.expedited.complianceRate - expeditedTarget
      },
      standard: {
        target: standardTarget,
        actual: metrics.standard.complianceRate,
        compliant: metrics.standard.complianceRate >= standardTarget,
        variance: metrics.standard.complianceRate - standardTarget
      },
      overall: {
        expeditedWeight: 0.3, // 30% weight for expedited
        standardWeight: 0.7,  // 70% weight for standard
        weightedCompliance: (
          (metrics.expedited.complianceRate * 0.3) +
          (metrics.standard.complianceRate * 0.7)
        )
      }
    };
  }
}

// Supporting interfaces
interface DecisionRecord {
  claimId: string;
  submittedAt: string;      // ISO 8601 timestamp
  decidedAt: string;        // ISO 8601 timestamp
  expedited: boolean;
  disposition: AuthorizationDisposition;
  reason?: string;
  serviceType?: string;
  urgentIndicator?: string;
  escalationFlag?: boolean;
}

interface SLAValidationResult {
  expedited: {
    target: number;
    actual: number;
    compliant: boolean;
    variance: number;
  };
  standard: {
    target: number;
    actual: number;
    compliant: boolean;
    variance: number;
  };
  overall: {
    expeditedWeight: number;
    standardWeight: number;
    weightedCompliance: number;
  };
}

// Export singleton instance
export const metricsCalculationService = new MetricsCalculationService();