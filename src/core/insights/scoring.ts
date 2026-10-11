import type { Finding, FindingCategory, Severity } from '../domain/finding';

/** Deduction applied to the health score for each finding, by severity. */
export const SEVERITY_DEDUCTION: Readonly<Record<Severity, number>> = {
  critical: 15,
  warning: 8,
  info: 3,
};

/** Maximum total deduction a single rule can contribute (per-rule cap). */
export const RULE_DEDUCTION_CAP = 25;

/** Health score bounds. */
export const HEALTH_START = 100;
export const HEALTH_FLOOR = 0;

/** Health scoring result (PRD section 10). */
export interface HealthScore {
  readonly score: number;
  /** Total (per-rule-capped) deduction applied. */
  readonly deductions: number;
  /** Score per category, each also starting at 100 and floored at 0. */
  readonly byCategory: Readonly<Record<FindingCategory, number>>;
}

const CATEGORIES: readonly FindingCategory[] = ['network', 'performance', 'console', 'storage'];

interface RuleTally {
  total: number;
  category: FindingCategory;
}

/**
 * Computes the health score: start at 100, subtract a weight per finding by
 * severity, cap each rule's contribution, and floor at 0. Also returns a
 * per-category breakdown with the same rules. Pure.
 */
export function computeHealthScore(findings: readonly Finding[]): HealthScore {
  const perRule = new Map<string, RuleTally>();
  for (const finding of findings) {
    const tally = perRule.get(finding.ruleId) ?? { total: 0, category: finding.category };
    tally.total += SEVERITY_DEDUCTION[finding.severity];
    perRule.set(finding.ruleId, tally);
  }

  const categoryDeductions: Record<FindingCategory, number> = {
    network: 0,
    performance: 0,
    console: 0,
    storage: 0,
  };
  let deductions = 0;
  for (const tally of perRule.values()) {
    const capped = Math.min(tally.total, RULE_DEDUCTION_CAP);
    deductions += capped;
    categoryDeductions[tally.category] += capped;
  }

  const byCategory = {} as Record<FindingCategory, number>;
  for (const category of CATEGORIES) {
    byCategory[category] = Math.max(HEALTH_FLOOR, HEALTH_START - categoryDeductions[category]);
  }

  return {
    score: Math.max(HEALTH_FLOOR, HEALTH_START - deductions),
    deductions,
    byCategory,
  };
}
