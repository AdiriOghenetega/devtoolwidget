import { describe, expect, it } from 'vitest';
import { isSoftThrottle, resolveThrottleProfile } from './throttle';

describe('resolveThrottleProfile', () => {
  it('marks offline as deep-only (CDP)', () => {
    expect(resolveThrottleProfile('offline')).toEqual({ profile: 'offline', support: 'deep' });
  });

  it('gives soft delays for the network profiles', () => {
    expect(resolveThrottleProfile('slow-3g')).toEqual({
      profile: 'slow-3g',
      support: 'soft',
      softDelayMs: 2_000,
    });
    expect(resolveThrottleProfile('fast-3g').softDelayMs).toBe(500);
    expect(resolveThrottleProfile('4g').softDelayMs).toBe(100);
  });

  it('uses a custom delay for custom, defaulting when absent', () => {
    expect(resolveThrottleProfile('custom', 750).softDelayMs).toBe(750);
    expect(resolveThrottleProfile('custom').softDelayMs).toBe(200);
  });

  it('reports soft support via isSoftThrottle', () => {
    expect(isSoftThrottle('offline')).toBe(false);
    expect(isSoftThrottle('slow-3g')).toBe(true);
  });
});
