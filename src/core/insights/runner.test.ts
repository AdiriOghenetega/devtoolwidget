import { describe, expect, it } from 'vitest';
import { toMillis } from '../domain/brands';
import type { Finding } from '../domain/finding';
import type { InsightRule } from '../domain/insight';
import { DEFAULT_THRESHOLDS } from '../domain/constants';
import { aSnapshot } from './builders';
import { ALL_INSIGHT_RULES } from './rules';
import { dedupeFindings, rankFindings, runInsights } from './runner';
import { stableFindingId } from './ids';

function rule(id: string, findings: readonly Finding[], shouldThrow = false): InsightRule {
  return {
    id,
    category: 'network',
    evaluate() {
      if (shouldThrow) {
        throw new Error('boom');
      }
      return findings;
    },
  };
}

function finding(id: string, severity: Finding['severity'], impact: number): Finding {
  return {
    id,
    ruleId: 'R',
    severity,
    category: 'network',
    title: 't',
    evidence: [],
    suggestion: 's',
    impact,
    actions: [],
  };
}

describe('runInsights', () => {
  it('deduplicates findings by id', () => {
    const duplicate = finding(stableFindingId('R01', 'x'), 'warning', 10);
    const run = runInsights(aSnapshot().build(), {
      rules: [rule('A', [duplicate]), rule('B', [duplicate])],
    });
    expect(run.findings).toHaveLength(1);
  });

  it('ranks by severity then impact', () => {
    const findings = [
      finding('a', 'info', 99),
      finding('b', 'critical', 10),
      finding('c', 'critical', 90),
      finding('d', 'warning', 50),
    ];
    expect(rankFindings(findings).map((f) => f.id)).toEqual(['c', 'b', 'd', 'a']);
  });

  it('isolates a throwing rule', () => {
    const run = runInsights(aSnapshot().build(), {
      rules: [rule('bad', [], true), rule('ok', [finding('good', 'warning', 1)])],
    });
    expect(run.findings.map((f) => f.id)).toEqual(['good']);
  });

  it('produces deterministic ids across runs', () => {
    const snapshot = aSnapshot()
      .network({ url: 'https://a.test/x', status: 500 })
      .network({ url: 'https://a.test/x', status: 500 })
      .build();
    const first = runInsights(snapshot, { rules: ALL_INSIGHT_RULES });
    const second = runInsights(snapshot, { rules: ALL_INSIGHT_RULES });
    expect(first.findings.map((f) => f.id)).toEqual(second.findings.map((f) => f.id));
  });

  it('merges user threshold overrides', () => {
    const snapshot = aSnapshot().network({ url: 'https://a.test/slow', total: 50 }).build();
    const noFindings = runInsights(snapshot, { rules: ALL_INSIGHT_RULES });
    expect(noFindings.findings).toHaveLength(0);

    const overridden = runInsights(snapshot, {
      rules: ALL_INSIGHT_RULES,
      thresholds: { ...DEFAULT_THRESHOLDS, slowRequestTotal: toMillis(10) },
    });
    expect(overridden.findings.some((f) => f.ruleId === 'R02')).toBe(true);
  });
});

describe('dedupeFindings', () => {
  it('keeps the first occurrence', () => {
    const first = finding('x', 'warning', 1);
    const second = finding('x', 'critical', 99);
    expect(dedupeFindings([first, second])).toEqual([first]);
  });
});
