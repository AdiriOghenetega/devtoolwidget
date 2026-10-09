import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS, ok, toMillis } from './index';

describe('core public API barrel', () => {
  it('re-exports the domain and result APIs', () => {
    expect(DEFAULT_THRESHOLDS.maxRequests).toBe(100);
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(toMillis(5)).toBe(5);
  });
});
