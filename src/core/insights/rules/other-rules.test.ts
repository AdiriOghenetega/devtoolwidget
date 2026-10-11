import { describe, expect, it } from 'vitest';
import { toBytes, toMillis } from '../../domain/brands';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { OTHER_RULES } from './other-rules';

function rule(id: string) {
  const found = OTHER_RULES.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`missing rule ${id}`);
  }
  return found;
}

describe('other rules (R09–R13, R17)', () => {
  it('R09/R10/R11 rate vitals at the threshold', () => {
    expect(
      rule('R09').evaluate(
        aSnapshot().vital({ name: 'LCP', value: 2_500, rating: 'good' }).build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
    expect(
      rule('R09').evaluate(
        aSnapshot().vital({ name: 'LCP', value: 2_501, rating: 'good' }).build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toHaveLength(1);
    expect(
      rule('R10').evaluate(
        aSnapshot().vital({ name: 'CLS', value: 0.1, rating: 'good' }).build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
    expect(
      rule('R11').evaluate(
        aSnapshot().vital({ name: 'INP', value: 201, rating: 'good' }).build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toHaveLength(1);
  });

  it('R12 rates total blocking time', () => {
    expect(
      rule('R12').evaluate(
        aSnapshot()
          .longTask({ startTime: toMillis(0), duration: toMillis(120) })
          .build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
    expect(
      rule('R12').evaluate(
        aSnapshot()
          .longTask({ startTime: toMillis(0), duration: toMillis(500) })
          .build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toHaveLength(1);
  });

  it('R13 groups console errors', () => {
    expect(
      rule('R13').evaluate(
        aSnapshot().console({ id: 'c', level: 'log' }).build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
    const findings = rule('R13').evaluate(
      aSnapshot()
        .console({ id: 'c1', kind: 'uncaught' })
        .console({ id: 'c2', level: 'error' })
        .build(),
      DEFAULT_THRESHOLDS,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('critical');
  });

  it('R17 flags oversized storage areas', () => {
    expect(
      rule('R17').evaluate(
        aSnapshot()
          .storage([{ area: 'cookies', count: 1, approximateSize: toBytes(4_096) }])
          .build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
    expect(
      rule('R17').evaluate(
        aSnapshot()
          .storage([{ area: 'cookies', count: 1, approximateSize: toBytes(4_097) }])
          .build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toHaveLength(1);
  });
});
