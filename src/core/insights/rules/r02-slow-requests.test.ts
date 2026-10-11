import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { r02SlowRequests } from './r02-slow-requests';

const LIMIT = Number(DEFAULT_THRESHOLDS.slowRequestTotal);
const TTFB = Number(DEFAULT_THRESHOLDS.slowRequestTtfb);

describe('R02 slow requests', () => {
  it('returns nothing for empty input', () => {
    expect(r02SlowRequests.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('flags total time just above the threshold, not at or below it', () => {
    expect(
      r02SlowRequests.evaluate(
        aSnapshot().network({ url: 'a', total: LIMIT }).build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
    expect(
      r02SlowRequests.evaluate(
        aSnapshot()
          .network({ url: 'a', total: LIMIT + 1 })
          .build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toHaveLength(1);
  });

  it('flags TTFB just above its threshold', () => {
    expect(
      r02SlowRequests.evaluate(
        aSnapshot().network({ url: 'a', ttfb: TTFB }).build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
    expect(
      r02SlowRequests.evaluate(
        aSnapshot()
          .network({ url: 'a', ttfb: TTFB + 1 })
          .build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toHaveLength(1);
  });

  it('reports the offending URL with timings', () => {
    const evidence =
      r02SlowRequests.evaluate(
        aSnapshot().network({ url: 'https://a.test/slow', total: 5_000 }).build(),
        DEFAULT_THRESHOLDS,
      )[0]?.evidence ?? [];
    expect(evidence[0]).toContain('https://a.test/slow');
    expect(evidence[0]).toContain('5000ms total');
  });

  it('handles partial entries without throwing', () => {
    expect(() =>
      r02SlowRequests.evaluate(aSnapshot().network({ url: '' }).build(), DEFAULT_THRESHOLDS),
    ).not.toThrow();
  });
});
