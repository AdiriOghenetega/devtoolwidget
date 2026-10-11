import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { r03LargePayloads } from './r03-large-payloads';

const PAYLOAD = Number(DEFAULT_THRESHOLDS.largePayload);
const IMAGE = Number(DEFAULT_THRESHOLDS.largeImage);

describe('R03 large payloads', () => {
  it('returns nothing for empty input', () => {
    expect(r03LargePayloads.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('applies the non-media limit at, just below and above', () => {
    const run = (size: number) =>
      r03LargePayloads.evaluate(
        aSnapshot().network({ url: 'a.js', resourceType: 'script', transferSize: size }).build(),
        DEFAULT_THRESHOLDS,
      );
    expect(run(PAYLOAD - 1)).toEqual([]);
    expect(run(PAYLOAD)).toEqual([]);
    expect(run(PAYLOAD + 1)).toHaveLength(1);
  });

  it('applies the larger image limit', () => {
    const run = (size: number) =>
      r03LargePayloads.evaluate(
        aSnapshot().network({ url: 'a.png', resourceType: 'image', transferSize: size }).build(),
        DEFAULT_THRESHOLDS,
      );
    expect(run(PAYLOAD + 1)).toEqual([]);
    expect(run(IMAGE)).toEqual([]);
    expect(run(IMAGE + 1)).toHaveLength(1);
  });

  it('reports the URL and size, capped', () => {
    let builder = aSnapshot();
    for (let index = 0; index < 7; index += 1) {
      builder = builder.network({
        url: `https://a.test/${String(index)}.png`,
        resourceType: 'image',
        transferSize: IMAGE + 1,
      });
    }
    const evidence =
      r03LargePayloads.evaluate(builder.build(), DEFAULT_THRESHOLDS)[0]?.evidence ?? [];
    expect(evidence).toHaveLength(6);
    expect(evidence[0]).toContain('https://a.test/0.png');
  });

  it('handles a partial entry (empty type and url)', () => {
    expect(
      r03LargePayloads.evaluate(
        aSnapshot()
          .network({ url: '', resourceType: '', transferSize: IMAGE + 1 })
          .build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toHaveLength(1);
  });
});
