import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { r09Lcp } from './r09-lcp';

describe('R09 LCP', () => {
  it('degrades to no findings when LCP was not measured', () => {
    expect(r09Lcp.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('rates at, just above the good and poor thresholds', () => {
    const run = (value: number) =>
      r09Lcp.evaluate(
        aSnapshot().vital({ name: 'LCP', value, rating: 'good' }).build(),
        DEFAULT_THRESHOLDS,
      );
    expect(run(2_500)).toEqual([]);
    expect(run(2_501)[0]?.severity).toBe('warning');
    expect(run(4_000)[0]?.severity).toBe('warning');
    expect(run(4_001)[0]?.severity).toBe('critical');
  });

  it('includes the offending element as attribution evidence', () => {
    const findings = r09Lcp.evaluate(
      aSnapshot().vital({ name: 'LCP', value: 5_000, rating: 'poor', element: 'img.hero' }).build(),
      DEFAULT_THRESHOLDS,
    );
    expect(findings[0]?.evidence.join(' ')).toContain('img.hero');
  });
});
