import type { Thresholds } from '../../domain/constants';
import type { Severity } from '../../domain/finding';

/**
 * Core Web Vitals thresholds.
 *
 * Re-verified against the web.dev "Web Vitals" article
 * (https://web.dev/articles/vitals, last updated 2024-10-31): a good LCP is
 * <= 2.5s, a good INP is <= 200ms and a good CLS is <= 0.1. The "poor" cut-offs
 * used here (LCP > 4s, INP > 500ms, CLS > 0.25) come from the same guidance and
 * are the values PRD section 10 lists; `DEFAULT_THRESHOLDS` matches them.
 */
export const CWV_SOURCE = 'https://web.dev/articles/vitals';

/** A metric threshold pair (needs-improvement and poor cut-offs). */
export interface MetricLimit {
  readonly needsImprovement: number;
  readonly poor: number;
}

/** Rates a metric value against a limit, or `undefined` when it is good. */
export function vitalSeverity(value: number, limit: MetricLimit): Severity | undefined {
  if (value > limit.poor) {
    return 'critical';
  }
  if (value > limit.needsImprovement) {
    return 'warning';
  }
  return undefined;
}

/** Reads a Core Web Vitals limit from the merged thresholds. */
export function vitalLimit(thresholds: Thresholds, name: 'LCP' | 'CLS' | 'INP'): MetricLimit {
  return thresholds[name.toLowerCase() as 'lcp' | 'cls' | 'inp'];
}
