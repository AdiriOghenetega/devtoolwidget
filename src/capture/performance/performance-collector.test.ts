import { describe, expect, it } from 'vitest';
import { toMillis, type LongTask, type VitalMetric } from '../../core';
import type { ClockPort } from '../../platform/ports';
import {
  PerformanceCollector,
  detectCapabilities,
  type VitalCallback,
  type VitalsClient,
} from './performance-collector';

function createClock(): { readonly clock: ClockPort; readonly set: (value: number) => void } {
  const state = { value: 0 };
  return {
    clock: { now: () => toMillis(state.value), delay: () => Promise.resolve() },
    set: (value) => {
      state.value = value;
    },
  };
}

function createVitals(): {
  readonly client: VitalsClient;
  readonly fire: (name: string, metric: VitalCallback) => void;
  readonly subscribed: () => readonly string[];
} {
  const callbacks = new Map<string, (metric: VitalCallback) => void>();
  return {
    client: {
      subscribe: (name, callback) => {
        callbacks.set(name, callback);
        return () => callbacks.delete(name);
      },
    },
    fire: (name, metric) => callbacks.get(name)?.(metric),
    subscribed: () => [...callbacks.keys()],
  };
}

describe('detectCapabilities', () => {
  it('reports each API by presence', () => {
    const flags = detectCapabilities({
      PerformanceObserver: () => undefined,
      PerformanceLongAnimationFrameTiming: () => undefined,
      requestIdleCallback: () => undefined,
      memory: {},
      renderBlockingStatus: true,
      vitals: {},
    });
    expect(flags).toEqual({
      webVitals: true,
      longTasks: true,
      longAnimationFrames: true,
      renderBlockingStatus: true,
      memory: true,
      idleCallback: true,
    });
  });

  it('degrades gracefully when nothing is available', () => {
    expect(detectCapabilities({})).toEqual({
      webVitals: false,
      longTasks: false,
      longAnimationFrames: false,
      renderBlockingStatus: false,
      memory: false,
      idleCallback: false,
    });
  });
});

describe('PerformanceCollector', () => {
  function setup(vitals: VitalsClient | undefined) {
    const clock = createClock();
    const vitalsEmitted: VitalMetric[] = [];
    const longTasks: LongTask[] = [];
    const tbt: number[] = [];
    const summaries: unknown[] = [];
    const oversized: unknown[] = [];
    const capabilities: unknown[] = [];
    const collector = new PerformanceCollector({
      globals: { PerformanceObserver: () => undefined, vitals },
      clock: clock.clock,
      ...(vitals === undefined ? {} : { vitals }),
      emit: {
        vital: (metric) => vitalsEmitted.push(metric),
        longTask: (task) => longTasks.push(task),
        totalBlockingTime: (value) => tbt.push(value),
        resources: (summary) => summaries.push(summary),
        oversizedImages: (images) => oversized.push(images),
        capability: (report) => capabilities.push(report),
      },
    });
    return { collector, clock, vitalsEmitted, longTasks, tbt, summaries, oversized, capabilities };
  }

  it('reports capabilities and subscribes to the vitals client', () => {
    const vitals = createVitals();
    const harness = setup(vitals.client);

    harness.collector.start();

    expect(harness.capabilities).toHaveLength(1);
    expect(vitals.subscribed()).toEqual(['LCP', 'CLS', 'INP', 'FCP', 'TTFB']);
    vitals.fire('LCP', {
      name: 'LCP',
      value: 1_800,
      rating: 'good',
      attribution: { element: 'img.hero' },
    });
    expect(harness.vitalsEmitted[0]).toEqual({
      name: 'LCP',
      value: 1_800,
      rating: 'good',
      element: 'img.hero',
    });
    harness.collector.dispose();
    expect(vitals.subscribed()).toEqual([]);
  });

  it('maps every vital, with and without attribution', () => {
    const vitals = createVitals();
    const harness = setup(vitals.client);
    harness.collector.start();

    vitals.fire('LCP', { name: 'LCP', value: 1_200, rating: 'good' });
    vitals.fire('CLS', {
      name: 'CLS',
      value: 0.05,
      rating: 'good',
      attribution: { shiftedNodes: ['#ad'] },
    });
    vitals.fire('INP', {
      name: 'INP',
      value: 150,
      rating: 'good',
      attribution: { interactionTarget: 'button#buy' },
    });
    vitals.fire('FCP', { name: 'FCP', value: 900, rating: 'good' });
    vitals.fire('TTFB', { name: 'TTFB', value: 300, rating: 'good' });

    expect(harness.vitalsEmitted).toEqual([
      { name: 'LCP', value: 1_200, rating: 'good' },
      { name: 'CLS', value: 0.05, rating: 'good', shiftedNodes: ['#ad'] },
      { name: 'INP', value: 150, rating: 'good', interactionTarget: 'button#buy' },
      { name: 'FCP', value: 900, rating: 'good' },
      { name: 'TTFB', value: 300, rating: 'good' },
    ]);
    harness.collector.dispose();
  });

  it('skips vitals entirely when the client is absent', () => {
    const harness = setup(undefined);
    harness.collector.start();
    expect(harness.vitalsEmitted).toHaveLength(0);
    expect(harness.collector.capability.unsupported).toContain('webVitals');
  });

  it('records long tasks and emits the derived total blocking time', () => {
    const harness = setup(undefined);
    harness.collector.addLongTasks([
      { startTime: toMillis(0), duration: toMillis(120) },
      { startTime: toMillis(200), duration: toMillis(80) },
    ]);
    expect(harness.longTasks).toHaveLength(2);
    expect(harness.tbt).toEqual([100]);
  });

  it('throttles and caps the oversized-image scan', () => {
    const harness = setup(undefined);
    const images = Array.from({ length: 5 }, (_, index) => ({
      url: `img-${String(index)}`,
      naturalWidth: 1_000,
      naturalHeight: 1_000,
      renderedWidth: 10,
      renderedHeight: 10,
    }));
    const collector = new PerformanceCollector({
      globals: {},
      clock: harness.clock.clock,
      limits: { scanThrottleMs: 100, maxImagesScanned: 2 },
      emit: {
        vital: () => undefined,
        longTask: () => undefined,
        totalBlockingTime: () => undefined,
        resources: () => undefined,
        oversizedImages: (found) => harness.oversized.push(found),
        capability: () => undefined,
      },
    });

    collector.scanImages(images);
    expect(harness.oversized[0]).toHaveLength(2);

    harness.clock.set(50);
    collector.scanImages(images);
    expect(harness.oversized).toHaveLength(1);

    harness.clock.set(200);
    collector.scanImages(images);
    expect(harness.oversized).toHaveLength(2);
  });

  it('summarizes resources', () => {
    const harness = setup(undefined);
    harness.collector.summarize([
      { url: 'a', resourceType: 'script', transferSize: 1, decodedSize: 2, duration: toMillis(1) },
    ]);
    expect(harness.summaries[0]).toMatchObject({ count: 1, byType: { script: 1 } });
  });
});
