import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { toMillis } from '../domain/brands';
import { aSnapshot } from '../insights/builders';
import type { Finding } from '../domain/finding';
import {
  applyRetention,
  diffFindings,
  diffMetrics,
  diffSnapshots,
  metricsFromSnapshot,
  type SavedSnapshot,
} from './snapshot';

function metrics(values: readonly [string, number][]): Record<string, number> {
  return Object.fromEntries(values);
}

function finding(id: string): Finding {
  return {
    id,
    ruleId: 'R01',
    severity: 'warning',
    category: 'network',
    title: `finding ${id}`,
    evidence: [],
    suggestion: 'fix it',
    actions: [],
  };
}

function snapshot(
  id: string,
  createdAt: number,
  metricsMap: Record<string, number>,
  findings: readonly Finding[] = [],
): SavedSnapshot {
  return { id, label: id, createdAt: toMillis(createdAt), metrics: metricsMap, findings };
}

describe('diffMetrics', () => {
  it('reports no changes when a metric map is diffed with itself (property)', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.integer()), (map) => {
        for (const delta of diffMetrics(map, map)) {
          expect(delta.delta).toBe(0);
          expect(delta.direction).toBe('same');
          expect(delta.significant).toBe(false);
        }
      }),
    );
  });

  it('is antisymmetric: deltas negate and directions flip (property)', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string(), fc.integer()),
        fc.dictionary(fc.string(), fc.integer()),
        (a, b) => {
          const forward = diffMetrics(a, b);
          const backward = diffMetrics(b, a);
          expect(forward.map((delta) => delta.name)).toEqual(backward.map((delta) => delta.name));
          forward.forEach((delta, index) => {
            const other = backward[index];
            // Normalise signed zero: 0 and -0 are equal here, but Object.is
            // (used by toBe) distinguishes them.
            expect((other?.delta ?? 0) + 0).toBe(-delta.delta + 0);
            if (delta.direction === 'up') {
              expect(other?.direction).toBe('down');
            } else if (delta.direction === 'down') {
              expect(other?.direction).toBe('up');
            } else {
              expect(other?.direction).toBe('same');
            }
          });
        },
      ),
    );
  });

  it('marks a delta significant only when it is non-zero and reaches the threshold', () => {
    const [lcp] = diffMetrics({ LCP: 1_000 }, { LCP: 1_050 });
    expect(lcp?.significant).toBe(false);
    const [bigLcp] = diffMetrics({ LCP: 1_000 }, { LCP: 1_100 });
    expect(bigLcp?.significant).toBe(true);
    const [counter] = diffMetrics({ networkCount: 1 }, { networkCount: 2 });
    expect(counter?.significant).toBe(true);
  });
});

describe('diffFindings', () => {
  it('finds nothing when a list is diffed with itself (property)', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.string()), (ids) => {
        const list = ids.map(finding);
        const { newFindings, resolvedFindings } = diffFindings(list, list);
        expect(newFindings).toEqual([]);
        expect(resolvedFindings).toEqual([]);
      }),
    );
  });

  it('swaps new and resolved under reversal (property)', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.string()), fc.uniqueArray(fc.string()), (aIds, bIds) => {
        const a = aIds.map(finding);
        const b = bIds.map(finding);
        const forward = diffFindings(a, b);
        const backward = diffFindings(b, a);
        expect(forward.newFindings.map((f) => f.id).sort()).toEqual(
          backward.resolvedFindings.map((f) => f.id).sort(),
        );
        expect(forward.resolvedFindings.map((f) => f.id).sort()).toEqual(
          backward.newFindings.map((f) => f.id).sort(),
        );
      }),
    );
  });
});

describe('diffSnapshots', () => {
  it('has no changes for a snapshot compared with itself', () => {
    const value = snapshot('a', 1, { LCP: 1_000, health: 90 });
    expect(diffSnapshots(value, value)).toEqual({
      metrics: diffMetrics(value.metrics, value.metrics),
      newFindings: [],
      resolvedFindings: [],
      changed: false,
    });
  });

  it('detects metric changes and new/resolved findings', () => {
    const before = snapshot(
      'a',
      1,
      metrics([
        ['LCP', 4_000],
        ['health', 60],
      ]),
      [finding('f1')],
    );
    const after = snapshot(
      'b',
      2,
      metrics([
        ['LCP', 2_000],
        ['health', 80],
      ]),
      [finding('f2')],
    );
    const diff = diffSnapshots(before, after);
    expect(diff.changed).toBe(true);
    expect(diff.newFindings.map((f) => f.id)).toEqual(['f2']);
    expect(diff.resolvedFindings.map((f) => f.id)).toEqual(['f1']);
    const lcp = diff.metrics.find((metric) => metric.name === 'LCP');
    expect(lcp?.direction).toBe('down');
  });
});

describe('applyRetention', () => {
  it('keeps only the newest N snapshots', () => {
    const snapshots = Array.from({ length: 25 }, (_, index) =>
      snapshot(`s${String(index)}`, index, {}),
    );
    const retained = applyRetention(snapshots);
    expect(retained).toHaveLength(20);
    expect(retained[0]?.id).toBe('s24');
    expect(retained.map((entry) => entry.id)).not.toContain('s4');
  });
});

describe('metricsFromSnapshot', () => {
  it('derives health, counters and vitals', () => {
    const page = aSnapshot()
      .network({ url: 'a', status: 500 })
      .vital({ name: 'LCP', value: 1800, rating: 'good' })
      .build();
    const map = metricsFromSnapshot(page, [finding('f1')], 88);
    expect(map.health).toBe(88);
    expect(map.LCP).toBe(1800);
    expect(map.networkCount).toBe(1);
  });
});
