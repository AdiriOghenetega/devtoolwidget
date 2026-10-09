import { describe, expect, it } from 'vitest';
import { toBytes } from '../domain/brands';
import {
  CLEAR_CAPABILITIES,
  aggregateClearReport,
  planClear,
  summarizeStorage,
  totalStorageBytes,
  type ClearRequest,
} from './clear-plan';

function plan(types: ClearRequest['types'], extra: Partial<ClearRequest> = {}) {
  return planClear({ types, scope: 'origin', origin: 'https://a.test', ...extra });
}

describe('planClear', () => {
  it('maps storage types to single page steps', () => {
    const result = plan([
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'cacheStorage',
      'serviceWorkers',
    ]);
    expect(result.steps.map((step) => step.id)).toEqual([
      'page:localStorage',
      'page:sessionStorage',
      'page:indexedDB',
      'page:cacheStorage',
      'page:serviceWorkers',
    ]);
    expect(result.steps.every((step) => step.executor === 'page')).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('splits cookies into a page step and an HttpOnly background step', () => {
    const result = plan(['cookies']);
    expect(result.steps).toEqual([
      {
        id: 'page:cookies:non-http-only',
        type: 'cookies',
        executor: 'page',
        keep: [],
        httpOnly: false,
        origin: 'https://a.test',
      },
      {
        id: 'background:cookies:http-only',
        type: 'cookies',
        executor: 'background',
        keep: [],
        httpOnly: true,
        origin: 'https://a.test',
      },
    ]);
    expect(result.warnings[0]).toContain('registrable domain');
  });

  it('routes the HTTP cache to the background executor', () => {
    const result = plan(['httpCache']);
    expect(result.steps).toEqual([
      {
        id: 'background:http-cache',
        type: 'httpCache',
        executor: 'background',
        keep: [],
        httpOnly: false,
        origin: 'https://a.test',
      },
    ]);
  });

  it('deduplicates types and applies the keep list only where meaningful', () => {
    const result = plan(['localStorage', 'localStorage', 'cookies', 'httpCache'], {
      keep: ['token', 'theme'],
      scope: 'all',
    });
    expect(result.steps.map((step) => step.id)).toEqual([
      'page:localStorage',
      'page:cookies:non-http-only',
      'background:cookies:http-only',
      'background:http-cache',
    ]);
    const localStorage = result.steps.find((step) => step.id === 'page:localStorage');
    expect(localStorage?.keep).toEqual(['token', 'theme']);
    const httpCache = result.steps.find((step) => step.id === 'background:http-cache');
    expect(httpCache?.keep).toEqual([]);
    expect(result.steps.every((step) => step.origin === undefined)).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('current origin'))).toBe(true);
  });
});

describe('aggregateClearReport', () => {
  it('reports success and sums bytes', () => {
    const report = aggregateClearReport(
      [
        { stepId: 'a', ok: true, skipped: false, bytesFreed: 100 },
        { stepId: 'b', ok: true, skipped: false, bytesFreed: 50 },
      ],
      ['warn'],
    );
    expect(report).toMatchObject({ ok: true, bytesFreed: 150, warnings: ['warn'] });
    expect(report.failures).toEqual([]);
  });

  it('reports partial failures with reasons and excludes their bytes', () => {
    const report = aggregateClearReport([
      { stepId: 'a', ok: true, skipped: false, bytesFreed: 100 },
      { stepId: 'b', ok: false, skipped: false, bytesFreed: 900, reason: 'quota' },
      { stepId: 'c', ok: false, skipped: true, bytesFreed: 0 },
    ]);
    expect(report.ok).toBe(false);
    expect(report.bytesFreed).toBe(100);
    expect(report.failures.map((failure) => failure.stepId)).toEqual(['b']);
    expect(report.failures[0]?.reason).toBe('quota');
  });
});

describe('summarizeStorage', () => {
  it('brands sizes and totals them', () => {
    const summary = summarizeStorage([
      { area: 'localStorage', count: 3, approximateSize: 2048 },
      { area: 'cookies', count: 5, approximateSize: 512 },
    ]);
    expect(summary.areas[0]?.approximateSize).toBe(2048);
    expect(totalStorageBytes(summary)).toBe(2560);
    expect(summary.areas[0]?.approximateSize).toEqual(toBytes(2048));
  });
});

describe('CLEAR_CAPABILITIES', () => {
  it('encodes the origin-scoped browsingData types and cookie scope', () => {
    expect(CLEAR_CAPABILITIES.originScopedBrowsingData).toContain('cookies');
    expect(CLEAR_CAPABILITIES.originScopedBrowsingData).toContain('cache');
    expect(CLEAR_CAPABILITIES.originScopedBrowsingData).not.toContain('history');
    expect(CLEAR_CAPABILITIES.cookieScope).toBe('registrable-domain');
  });
});
