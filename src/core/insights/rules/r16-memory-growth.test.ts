import { describe, expect, it } from 'vitest';
import { toMillis } from '../../domain/brands';
import { DEFAULT_THRESHOLDS } from '../../domain/constants';
import { aSnapshot } from '../builders';
import { MEMORY_GROWTH_MIN_BYTES, r16MemoryGrowth } from './r16-memory-growth';

function samples(count: number, growthBytes: number) {
  const base = 10_000_000;
  return Array.from({ length: count }, (_, index) => ({
    at: toMillis(index * 1_000),
    usedBytes: base + Math.round((growthBytes * index) / Math.max(1, count - 1)),
  }));
}

describe('R16 memory growth trend', () => {
  it('degrades to no findings when memory samples are unavailable', () => {
    expect(r16MemoryGrowth.evaluate(aSnapshot().build(), DEFAULT_THRESHOLDS)).toEqual([]);
    expect(
      r16MemoryGrowth.evaluate(
        aSnapshot().memory(samples(2, 100_000_000)).build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
  });

  it('ignores growth below the threshold', () => {
    expect(
      r16MemoryGrowth.evaluate(
        aSnapshot()
          .memory(samples(4, MEMORY_GROWTH_MIN_BYTES - 1))
          .build(),
        DEFAULT_THRESHOLDS,
      ),
    ).toEqual([]);
  });

  it('flags sustained growth with the amount as evidence', () => {
    const findings = r16MemoryGrowth.evaluate(
      aSnapshot()
        .memory(samples(4, MEMORY_GROWTH_MIN_BYTES + 1))
        .build(),
      DEFAULT_THRESHOLDS,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.evidence.join(' ')).toContain('4 samples');
  });
});
