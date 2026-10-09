import type { Thresholds } from './constants';
import type { Finding, FindingCategory } from './finding';
import type { PageSnapshot } from './snapshot';

/**
 * One insight rule (PRD section 9, section 10). Rules are pure functions
 * registered in a registry and unit-tested individually; thresholds are
 * injected so they stay configurable from Settings.
 */
export interface InsightRule {
  readonly id: string;
  readonly category: FindingCategory;
  evaluate(input: PageSnapshot, thresholds: Thresholds): readonly Finding[];
}
