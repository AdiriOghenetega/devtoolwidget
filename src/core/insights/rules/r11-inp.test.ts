import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { r11Inp } from './r11-inp';

describe('R11 INP', () => {
  it('degrades to no findings when INP was not measured', () => {
    expect(r11Inp.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('rates at, just above the good and poor thresholds', () => {
    const run = (value: number) =>
      r11Inp.evaluate(
        aSnapshot().vital({ name: 'INP', value, rating: 'good' }).build(),
        DEFAULT_THRESHOLDS,
      );
    expect(run(200)).toEqual([]);
    expect(run(201)[0]?.severity).toBe('warning');
    expect(run(501)[0]?.severity).toBe('critical');
  });

  it('includes the interaction target as attribution evidence', () => {
    const findings = r11Inp.evaluate(
      aSnapshot()
        .vital({ name: 'INP', value: 600, rating: 'poor', interactionTarget: 'button#buy' })
        .build(),
      DEFAULT_THRESHOLDS,
    );
    expect(findings[0]?.evidence.join(' ')).toContain('button#buy');
  });
});
