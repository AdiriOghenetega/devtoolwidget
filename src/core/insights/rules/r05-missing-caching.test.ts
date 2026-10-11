import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { r05MissingCaching } from './r05-missing-caching';

describe('R05 missing caching', () => {
  it('returns nothing for empty input', () => {
    expect(r05MissingCaching.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('flags a static asset with headers but no cache headers', () => {
    const findings = r05MissingCaching.evaluate(
      aSnapshot()
        .network({
          url: 'https://a.test/app.js',
          resourceType: 'script',
          transferSize: 100,
          headers: { 'content-type': 'application/javascript' },
        })
        .build(),
      DEFAULT_THRESHOLDS,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('info');
  });

  it('ignores assets that carry a cache-control or ETag header', () => {
    const run = (headers: Record<string, string>) =>
      r05MissingCaching.evaluate(
        aSnapshot()
          .network({ url: 'a.js', resourceType: 'script', transferSize: 100, headers })
          .build(),
        DEFAULT_THRESHOLDS,
      );
    expect(run({ 'Cache-Control': 'max-age=60' })).toEqual([]);
    expect(run({ etag: 'abc' })).toEqual([]);
  });

  it('does not guess when headers were not captured', () => {
    expect(
      r05MissingCaching.evaluate(
        aSnapshot().network({ url: 'a.js', resourceType: 'script', transferSize: 100 }).build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
  });

  it('ignores non-static resources and zero-transfer entries', () => {
    expect(
      r05MissingCaching.evaluate(
        aSnapshot()
          .network({ url: 'api', resourceType: 'fetch', transferSize: 100, headers: {} })
          .build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
    expect(
      r05MissingCaching.evaluate(
        aSnapshot()
          .network({ url: 'a.js', resourceType: 'script', transferSize: 0, headers: {} })
          .build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
  });
});
