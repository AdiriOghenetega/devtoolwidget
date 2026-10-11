import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { r15OversizedImages } from './r15-oversized-images';

const image = (natural: number, rendered: number) => ({
  url: 'https://a.test/hero.png',
  naturalWidth: natural,
  naturalHeight: 1,
  renderedWidth: rendered,
  renderedHeight: 1,
});

describe('R15 oversized images', () => {
  it('degrades to no findings when image samples are unavailable', () => {
    expect(r15OversizedImages.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('ignores images sized close to their rendered size', () => {
    expect(
      r15OversizedImages.evaluate(
        aSnapshot()
          .images([image(120_000, 100_000)])
          .build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
  });

  it('flags far-oversized images with the ratio as evidence', () => {
    const findings = r15OversizedImages.evaluate(
      aSnapshot()
        .images([image(1_000_000, 10_000)])
        .build(),
      DEFAULT_THRESHOLDS,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.evidence[0]).toContain('hero.png');
    expect(findings[0]?.evidence[0]).toContain('×');
  });
});
