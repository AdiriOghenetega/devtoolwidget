import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONSOLE_BUFFER_CAPACITY,
  DEFAULT_THRESHOLDS,
  EVENT_BATCH_INTERVAL,
  MAX_SNAPSHOTS,
  MEMORY_BUDGET,
} from './constants';

describe('capture limits', () => {
  it('match the PRD defaults', () => {
    expect(DEFAULT_CONSOLE_BUFFER_CAPACITY).toBe(1000);
    expect(MAX_SNAPSHOTS).toBe(20);
    expect(EVENT_BATCH_INTERVAL).toBe(100);
    expect(MEMORY_BUDGET).toBe(50 * 1024 * 1024);
  });
});

describe('DEFAULT_THRESHOLDS', () => {
  it('takes the request thresholds from PRD section 10', () => {
    expect(DEFAULT_THRESHOLDS.slowRequestTotal).toBe(1_000);
    expect(DEFAULT_THRESHOLDS.slowRequestTtfb).toBe(600);
    expect(DEFAULT_THRESHOLDS.largePayload).toBe(500 * 1024);
    expect(DEFAULT_THRESHOLDS.largeImage).toBe(1024 * 1024);
    expect(DEFAULT_THRESHOLDS.uncompressedText).toBe(1024);
    expect(DEFAULT_THRESHOLDS.duplicateRequestWindow).toBe(2_000);
    expect(DEFAULT_THRESHOLDS.maxRequests).toBe(100);
    expect(DEFAULT_THRESHOLDS.maxDistinctOrigins).toBe(15);
  });

  it('takes the Core Web Vitals thresholds from PRD section 10', () => {
    expect(DEFAULT_THRESHOLDS.lcp).toEqual({ needsImprovement: 2_500, poor: 4_000 });
    expect(DEFAULT_THRESHOLDS.cls).toEqual({ needsImprovement: 0.1, poor: 0.25 });
    expect(DEFAULT_THRESHOLDS.inp).toEqual({ needsImprovement: 200, poor: 500 });
    expect(DEFAULT_THRESHOLDS.totalBlockingTime).toEqual({ warning: 300, critical: 600 });
  });

  it('takes the storage thresholds from PRD section 10', () => {
    expect(DEFAULT_THRESHOLDS.storage).toEqual({
      localStorage: 5 * 1024 * 1024,
      indexedDB: 5 * 1024 * 1024,
      cookies: 4 * 1024,
    });
  });
});
