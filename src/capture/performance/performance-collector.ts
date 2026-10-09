import {
  buildCapabilityReport,
  estimateTotalBlockingTime,
  findOversizedImages,
  summarizeResources,
  type CapabilityFlags,
  type CapabilityReport,
  type ImageSample,
  type LongTask,
  type Millis,
  type OversizedImage,
  type ResourceSample,
  type ResourceSummary,
  type VitalMetric,
} from '../../core';
import type { ClockPort } from '../../platform/ports';

/** The vital metric names collected (PRD FR-5). */
export type VitalName = VitalMetric['name'];

/** Attribution passed through from the web-vitals client. */
export interface VitalAttribution {
  readonly element?: string;
  readonly shiftedNodes?: readonly string[];
  readonly interactionTarget?: string;
}

/** A web-vitals-style callback payload. */
export interface VitalCallback {
  readonly name: VitalName;
  readonly value: number;
  readonly rating: 'good' | 'needs-improvement' | 'poor';
  readonly attribution?: VitalAttribution;
}

/**
 * A thin interface over the web-vitals attribution build so it can be faked
 * (PRD FR-5). Exactly the surface the collector needs.
 */
export interface VitalsClient {
  subscribe(name: VitalName, callback: (metric: VitalCallback) => void): () => void;
}

/** Injected globals used for feature detection (never imported directly). */
export interface CapabilityGlobals {
  readonly PerformanceObserver?: unknown;
  readonly PerformanceLongAnimationFrameTiming?: unknown;
  readonly requestIdleCallback?: unknown;
  readonly memory?: unknown;
  readonly renderBlockingStatus?: boolean;
  readonly vitals?: unknown;
}

/** Feature-detect the performance APIs the collector relies on. */
export function detectCapabilities(globals: CapabilityGlobals): CapabilityFlags {
  return {
    webVitals: globals.vitals !== undefined,
    longTasks: globals.PerformanceObserver !== undefined,
    longAnimationFrames: globals.PerformanceLongAnimationFrameTiming !== undefined,
    renderBlockingStatus: globals.renderBlockingStatus === true,
    memory: globals.memory !== undefined,
    idleCallback: globals.requestIdleCallback !== undefined,
  };
}

/** Emit sinks for the collector. */
export interface PerformanceEmit {
  readonly vital: (metric: VitalMetric) => void;
  readonly longTask: (task: LongTask) => void;
  readonly totalBlockingTime: (value: Millis) => void;
  readonly resources: (summary: ResourceSummary) => void;
  readonly oversizedImages: (images: readonly OversizedImage[]) => void;
  readonly capability: (report: CapabilityReport) => void;
}

/** Limits for the oversized-image scan (throttled and capped). */
export interface PerformanceLimits {
  readonly oversizeRatio?: number;
  readonly oversizeMinPixels?: number;
  readonly scanThrottleMs?: number;
  readonly maxImagesScanned?: number;
}

/** Options for {@link PerformanceCollector}. */
export interface PerformanceCollectorOptions {
  readonly globals: CapabilityGlobals;
  readonly emit: PerformanceEmit;
  readonly clock: ClockPort;
  readonly vitals?: VitalsClient;
  readonly limits?: PerformanceLimits;
}

function toVitalMetric(metric: VitalCallback): VitalMetric {
  const base = { value: metric.value, rating: metric.rating };
  const attribution = metric.attribution;
  switch (metric.name) {
    case 'LCP':
      return {
        name: 'LCP',
        ...base,
        ...(attribution?.element === undefined ? {} : { element: attribution.element }),
      };
    case 'CLS':
      return {
        name: 'CLS',
        ...base,
        ...(attribution?.shiftedNodes === undefined
          ? {}
          : { shiftedNodes: attribution.shiftedNodes }),
      };
    case 'INP':
      return {
        name: 'INP',
        ...base,
        ...(attribution?.interactionTarget === undefined
          ? {}
          : { interactionTarget: attribution.interactionTarget }),
      };
    case 'FCP':
      return { name: 'FCP', ...base };
    case 'TTFB':
      return { name: 'TTFB', ...base };
  }
}

/**
 * Collects performance data (PRD FR-5): web vitals with attribution, long tasks
 * and derived total blocking time, a resource summary, render-blocking counts,
 * memory samples and an idle-time oversized-image scan. Every API is
 * feature-detected and reported; missing APIs degrade gracefully.
 */
export class PerformanceCollector {
  readonly #options: PerformanceCollectorOptions;
  readonly #longTasks: LongTask[] = [];
  readonly #unsubscribes: (() => void)[] = [];
  #lastScanAt: number | undefined;
  #capability: CapabilityReport = { supported: [], unsupported: [] };

  constructor(options: PerformanceCollectorOptions) {
    this.#options = options;
  }

  /** The capability report computed on {@link start}. */
  get capability(): CapabilityReport {
    return this.#capability;
  }

  /** Detects capabilities, reports them, and subscribes to the vitals client. */
  start(): void {
    const flags = detectCapabilities(this.#options.globals);
    this.#capability = buildCapabilityReport(flags);
    this.#options.emit.capability(this.#capability);
    if (!flags.webVitals || this.#options.vitals === undefined) {
      return;
    }
    for (const name of ['LCP', 'CLS', 'INP', 'FCP', 'TTFB'] as const) {
      const unsubscribe = this.#options.vitals.subscribe(name, (metric) => {
        this.#options.emit.vital(toVitalMetric(metric));
      });
      this.#unsubscribes.push(unsubscribe);
    }
  }

  /** Records long tasks and re-emits the derived total blocking time. */
  addLongTasks(tasks: readonly LongTask[]): void {
    for (const task of tasks) {
      this.#longTasks.push(task);
      this.#options.emit.longTask(task);
    }
    this.#options.emit.totalBlockingTime(estimateTotalBlockingTime(this.#longTasks));
  }

  /** Summarizes resource samples (counts, sizes, render-blocking count). */
  summarize(entries: readonly ResourceSample[]): void {
    this.#options.emit.resources(summarizeResources(entries));
  }

  /**
   * Scans image samples for oversize, throttled by the clock and capped in
   * count so it stays off the critical path (PRD R15 idle-time scan).
   */
  scanImages(samples: readonly ImageSample[]): void {
    const limits = this.#options.limits ?? {};
    const throttle = limits.scanThrottleMs ?? 0;
    const now = Number(this.#options.clock.now());
    if (this.#lastScanAt !== undefined && now - this.#lastScanAt < throttle) {
      return;
    }
    this.#lastScanAt = now;
    const capped = samples.slice(0, limits.maxImagesScanned ?? 200);
    this.#options.emit.oversizedImages(
      findOversizedImages(capped, {
        ...(limits.oversizeRatio === undefined ? {} : { minRatio: limits.oversizeRatio }),
        ...(limits.oversizeMinPixels === undefined
          ? {}
          : { minNaturalPixels: limits.oversizeMinPixels }),
      }),
    );
  }

  /** Unsubscribes every vitals listener. */
  dispose(): void {
    for (const unsubscribe of this.#unsubscribes) {
      unsubscribe();
    }
    this.#unsubscribes.length = 0;
  }
}
