import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { r10Cls } from './r10-cls';

describe('R10 CLS', () => {
  it('degrades to no findings when CLS was not measured', () => {
    expect(r10Cls.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('rates at, just above the good and poor thresholds', () => {
    const run = (value: number) =>
      r10Cls.evaluate(
        aSnapshot().vital({ name: 'CLS', value, rating: 'good' }).build(),
        DEFAULT_THRESHOLDS,
      );
    expect(run(0.1)).toEqual([]);
    expect(run(0.11)[0]?.severity).toBe('warning');
    expect(run(0.26)[0]?.severity).toBe('critical');
  });

  it('includes shifted nodes as attribution evidence', () => {
    const findings = r10Cls.evaluate(
      aSnapshot()
        .vital({ name: 'CLS', value: 0.3, rating: 'poor', shiftedNodes: ['#ad', '#banner'] })
        .build(),
      DEFAULT_THRESHOLDS,
    );
    expect(findings[0]?.evidence.join(' ')).toContain('#ad');
  });
});
