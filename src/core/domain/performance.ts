import type { Millis } from './brands';

/** The metrics captured for a page (PRD FR-5). */
export type VitalName = 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB';

/** A metric's standing against the Core Web Vitals thresholds. */
export type VitalRating = 'good' | 'needs-improvement' | 'poor';

interface VitalBase {
  readonly value: number;
  readonly rating: VitalRating;
}

/**
 * A measured web vital with the attribution that matters for its metric
 * (PRD FR-5): the LCP element, the CLS shifted nodes, or the INP target.
 */
export type VitalMetric =
  | (VitalBase & { readonly name: 'LCP'; readonly element?: string })
  | (VitalBase & { readonly name: 'CLS'; readonly shiftedNodes?: readonly string[] })
  | (VitalBase & { readonly name: 'INP'; readonly interactionTarget?: string })
  | (VitalBase & { readonly name: 'FCP' })
  | (VitalBase & { readonly name: 'TTFB' });

/** A long task observed on the main thread (PRD FR-5). */
export interface LongTask {
  readonly startTime: Millis;
  readonly duration: Millis;
  readonly name?: string;
  readonly blockingDuration?: Millis;
}
