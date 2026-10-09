import { describe, expect, it } from 'vitest';
import { toMillis } from '../domain/brands';
import type { LongTask } from '../domain/performance';
import {
  buildCapabilityReport,
  estimateTotalBlockingTime,
  findOversizedImages,
  summarizeResources,
  type CapabilityFlags,
} from './derive';

function task(duration: number): LongTask {
  return { startTime: toMillis(0), duration: toMillis(duration) };
}

describe('estimateTotalBlockingTime', () => {
  it('is zero for no tasks and for tasks at or below the threshold', () => {
    expect(estimateTotalBlockingTime([])).toBe(0);
    expect(estimateTotalBlockingTime([task(49)])).toBe(0);
    expect(estimateTotalBlockingTime([task(50)])).toBe(0);
  });

  it('counts only the excess above the 50ms threshold', () => {
    expect(estimateTotalBlockingTime([task(51)])).toBe(1);
    expect(estimateTotalBlockingTime([task(120)])).toBe(70);
  });

  it('sums across tasks and caps the total', () => {
    expect(estimateTotalBlockingTime([task(120), task(80)])).toBe(100);
    expect(estimateTotalBlockingTime([task(60_000)])).toBe(10_000);
    expect(estimateTotalBlockingTime([task(120)], { thresholdMs: 100 })).toBe(20);
    expect(estimateTotalBlockingTime([task(120)], { capMs: 30 })).toBe(30);
  });
});

describe('summarizeResources', () => {
  it('aggregates counts, sizes and render-blocking entries', () => {
    const summary = summarizeResources([
      {
        url: 'a',
        resourceType: 'script',
        transferSize: 10,
        decodedSize: 30,
        duration: toMillis(5),
        renderBlocking: true,
      },
      {
        url: 'b',
        resourceType: 'script',
        transferSize: 20,
        decodedSize: 60,
        duration: toMillis(6),
      },
      { url: 'c', resourceType: 'image', transferSize: 40, decodedSize: 80, duration: toMillis(7) },
    ]);
    expect(summary).toEqual({
      count: 3,
      byType: { script: 2, image: 1 },
      transferBytes: 70,
      decodedBytes: 170,
      renderBlockingCount: 1,
    });
  });

  it('handles an empty resource list', () => {
    expect(summarizeResources([])).toEqual({
      count: 0,
      byType: {},
      transferBytes: 0,
      decodedBytes: 0,
      renderBlockingCount: 0,
    });
  });
});

describe('findOversizedImages', () => {
  const big = (ratio: number, natural: number, rendered: number) => ({
    url: `img-${String(ratio)}`,
    naturalWidth: natural,
    naturalHeight: 1,
    renderedWidth: rendered,
    renderedHeight: 1,
  });

  it('flags images at or above the ratio and natural-pixel bounds', () => {
    const flagged = findOversizedImages([
      big(2, 200_000, 100_000),
      big(1.5, 150_000, 100_000),
      big(1.2, 120_000, 100_000),
    ]);
    expect(flagged.map((image) => image.ratio)).toEqual([2, 1.5]);
  });

  it('skips zero-rendered and below-minimum images', () => {
    expect(findOversizedImages([big(10, 0, 0)])).toEqual([]);
    expect(findOversizedImages([big(10, 50_000, 1_000)])).toEqual([]);
    expect(findOversizedImages([big(10, 200_000, 1_000)], { minRatio: 5 })[0]?.ratio).toBe(200);
  });

  it('honours a custom natural-pixel floor', () => {
    const flagged = findOversizedImages([big(10, 50_000, 1_000)], {
      minNaturalPixels: 10_000,
    });
    expect(flagged[0]?.ratio).toBe(50);
  });
});

describe('buildCapabilityReport', () => {
  it('splits flags into supported and unsupported', () => {
    const flags: CapabilityFlags = {
      webVitals: true,
      longTasks: true,
      longAnimationFrames: false,
      renderBlockingStatus: false,
      memory: true,
      idleCallback: false,
    };
    const report = buildCapabilityReport(flags);
    expect(report.supported).toEqual(['webVitals', 'longTasks', 'memory']);
    expect(report.unsupported).toEqual([
      'longAnimationFrames',
      'renderBlockingStatus',
      'idleCallback',
    ]);
  });
});
