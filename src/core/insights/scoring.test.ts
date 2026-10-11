import { describe, expect, it } from 'vitest';
import type { Finding, FindingCategory, Severity } from '../domain/finding';
import { RULE_DEDUCTION_CAP, computeHealthScore } from './scoring';
import { stableFindingId } from './ids';

function make(
  ruleId: string,
  category: FindingCategory,
  severity: Severity,
  key = ruleId,
): Finding {
  return {
    id: stableFindingId(ruleId, key),
    ruleId,
    category,
    severity,
    title: 't',
    evidence: [],
    suggestion: 's',
    actions: [],
  };
}

describe('computeHealthScore', () => {
  it('subtracts by severity and caps a single rule', () => {
    const findings = Array.from({ length: 5 }, (_, index) =>
      make('R01', 'network', 'critical', `u${String(index)}`),
    );
    const score = computeHealthScore(findings);
    expect(score.deductions).toBe(RULE_DEDUCTION_CAP);
    expect(score.score).toBe(100 - RULE_DEDUCTION_CAP);
  });

  it('floors at 0 and reports the per-category breakdown', () => {
    const findings = [
      ...Array.from({ length: 10 }, (_, index) => make(`N${String(index)}`, 'network', 'critical')),
      make('C1', 'console', 'warning'),
    ];
    const score = computeHealthScore(findings);
    expect(score.score).toBe(0);
    expect(score.byCategory.network).toBe(0);
    expect(score.byCategory.console).toBe(92);
    expect(score.byCategory.performance).toBe(100);
  });

  it('is 100 with no findings', () => {
    expect(computeHealthScore([])).toMatchObject({ score: 100, deductions: 0 });
  });
});
