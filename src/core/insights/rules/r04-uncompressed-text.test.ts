import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { r04UncompressedText } from './r04-uncompressed-text';

const LIMIT = Number(DEFAULT_THRESHOLDS.uncompressedText);

describe('R04 uncompressed text', () => {
  it('returns nothing for empty input', () => {
    expect(r04UncompressedText.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('flags text just above the limit and not at or below it', () => {
    const run = (decoded: number) =>
      r04UncompressedText.evaluate(
        aSnapshot()
          .network({
            url: 'a.js',
            resourceType: 'script',
            transferSize: decoded,
            decodedSize: decoded,
          })
          .build(),
        DEFAULT_THRESHOLDS,
      );
    expect(run(LIMIT)).toEqual([]);
    expect(run(LIMIT + 1)).toHaveLength(1);
  });

  it('ignores compressed responses (transfer below decoded)', () => {
    expect(
      r04UncompressedText.evaluate(
        aSnapshot()
          .network({
            url: 'a.js',
            resourceType: 'script',
            transferSize: 100,
            decodedSize: LIMIT + 1,
          })
          .build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
  });

  it('ignores non-text resources', () => {
    expect(
      r04UncompressedText.evaluate(
        aSnapshot()
          .network({
            url: 'a.png',
            resourceType: 'image',
            transferSize: LIMIT + 1,
            decodedSize: LIMIT + 1,
          })
          .build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
  });

  it('handles a partial entry without throwing', () => {
    expect(() =>
      r04UncompressedText.evaluate(
        aSnapshot().network({ url: '', resourceType: 'script' }).build(),
        DEFAULT_THRESHOLDS,
      ),
    ).not.toThrow();
  });
});
