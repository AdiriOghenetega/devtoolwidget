import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { r07RequestVolume } from './r07-request-volume';

const MAX_REQUESTS = DEFAULT_THRESHOLDS.maxRequests;
const MAX_ORIGINS = DEFAULT_THRESHOLDS.maxDistinctOrigins;

function withRequests(count: number) {
  let builder = aSnapshot();
  for (let index = 0; index < count; index += 1) {
    builder = builder.network({ url: `https://a.test/${String(index)}` });
  }
  return builder.build();
}

function withOrigins(count: number) {
  let builder = aSnapshot();
  for (let index = 0; index < count; index += 1) {
    builder = builder.network({ url: `https://c${String(index)}.test/x` });
  }
  return builder.build();
}

describe('R07 request volume', () => {
  it('returns nothing for empty input', () => {
    expect(r07RequestVolume.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('flags request count just above the maximum and not at it', () => {
    expect(
      r07RequestVolume
        .evaluate(withRequests(MAX_REQUESTS), DEFAULT_THRESHOLDS)
        .some((f) => f.title.includes('requests')),
    ).toBe(false);
    expect(
      r07RequestVolume
        .evaluate(withRequests(MAX_REQUESTS + 1), DEFAULT_THRESHOLDS)
        .some((f) => f.title.includes('requests')),
    ).toBe(true);
  });

  it('flags origin count just above the maximum and not at it', () => {
    expect(
      r07RequestVolume
        .evaluate(withOrigins(MAX_ORIGINS), DEFAULT_THRESHOLDS)
        .some((f) => f.title.includes('origins')),
    ).toBe(false);
    expect(
      r07RequestVolume
        .evaluate(withOrigins(MAX_ORIGINS + 1), DEFAULT_THRESHOLDS)
        .some((f) => f.title.includes('origins')),
    ).toBe(true);
  });

  it('lists top origins as evidence and handles URLs without an origin', () => {
    const findings = r07RequestVolume.evaluate(
      aSnapshot().network({ url: 'relative/path' }).network({ url: 'https://c1.test/x' }).build(),
      DEFAULT_THRESHOLDS,
    );
    expect(findings).toEqual([]);
  });
});
