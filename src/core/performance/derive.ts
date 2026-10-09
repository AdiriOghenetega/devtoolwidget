import { toMillis, type Millis } from '../domain/brands';
import type { LongTask } from '../domain/performance';

/** A task counts toward total blocking time only above this threshold (ms). */
export const LONG_TASK_THRESHOLD_MS = 50;
/** Total blocking time is capped at this value (ms), per the TBT definition. */
export const TBT_CAP_MS = 10_000;

/** Options for {@link estimateTotalBlockingTime}. */
export interface TbtOptions {
  readonly thresholdMs?: number;
  readonly capMs?: number;
}

/**
 * Estimates total blocking time: the sum of `(duration - 50ms)` over long tasks,
 * clamped at zero and capped. Pure and boundary-tested.
 */
export function estimateTotalBlockingTime(
  longTasks: readonly LongTask[],
  options: TbtOptions = {},
): Millis {
  const threshold = options.thresholdMs ?? LONG_TASK_THRESHOLD_MS;
  const cap = options.capMs ?? TBT_CAP_MS;
  let total = 0;
  for (const task of longTasks) {
    const excess = Number(task.duration) - threshold;
    if (excess > 0) {
      total += excess;
    }
  }
  return toMillis(Math.min(total, cap));
}

/** A resource timing sample used for the page summary (PRD FR-4). */
export interface ResourceSample {
  readonly url: string;
  readonly resourceType: string;
  readonly transferSize: number;
  readonly decodedSize: number;
  readonly duration: Millis;
  readonly renderBlocking?: boolean;
}

/** Aggregate resource metrics for a page. */
export interface ResourceSummary {
  readonly count: number;
  readonly byType: Readonly<Record<string, number>>;
  readonly transferBytes: number;
  readonly decodedBytes: number;
  readonly renderBlockingCount: number;
}

/** Summarizes resource samples by count, type and size. */
export function summarizeResources(entries: readonly ResourceSample[]): ResourceSummary {
  const byType: Record<string, number> = {};
  let transferBytes = 0;
  let decodedBytes = 0;
  let renderBlockingCount = 0;
  for (const entry of entries) {
    byType[entry.resourceType] = (byType[entry.resourceType] ?? 0) + 1;
    transferBytes += entry.transferSize;
    decodedBytes += entry.decodedSize;
    if (entry.renderBlocking === true) {
      renderBlockingCount += 1;
    }
  }
  return { count: entries.length, byType, transferBytes, decodedBytes, renderBlockingCount };
}

/** A measured image's natural vs rendered size (PRD R15). */
export interface ImageSample {
  readonly url: string;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
  readonly renderedWidth: number;
  readonly renderedHeight: number;
}

/** An image whose natural size is far above its rendered size. */
export interface OversizedImage {
  readonly url: string;
  readonly ratio: number;
  readonly naturalPixels: number;
  readonly renderedPixels: number;
}

/** Options for {@link findOversizedImages}. */
export interface OversizeOptions {
  /** Minimum natural/rendered pixel ratio to flag (default 1.5). */
  readonly minRatio?: number;
  /** Minimum natural pixel area to flag (default 100_000). */
  readonly minNaturalPixels?: number;
}

/** Flags images whose natural pixel area far exceeds their rendered area. */
export function findOversizedImages(
  samples: readonly ImageSample[],
  options: OversizeOptions = {},
): readonly OversizedImage[] {
  const minRatio = options.minRatio ?? 1.5;
  const minNaturalPixels = options.minNaturalPixels ?? 100_000;
  const result: OversizedImage[] = [];
  for (const sample of samples) {
    const naturalPixels = sample.naturalWidth * sample.naturalHeight;
    const renderedPixels = sample.renderedWidth * sample.renderedHeight;
    if (renderedPixels <= 0 || naturalPixels < minNaturalPixels) {
      continue;
    }
    const ratio = naturalPixels / renderedPixels;
    if (ratio >= minRatio) {
      result.push({ url: sample.url, ratio, naturalPixels, renderedPixels });
    }
  }
  return result;
}

/** Feature flags for the performance APIs the widget probes (PRD FR-5). */
export interface CapabilityFlags {
  readonly webVitals: boolean;
  readonly longTasks: boolean;
  readonly longAnimationFrames: boolean;
  readonly renderBlockingStatus: boolean;
  readonly memory: boolean;
  readonly idleCallback: boolean;
}

/** A typed capability report: which probes are available on this browser. */
export interface CapabilityReport {
  readonly supported: readonly (keyof CapabilityFlags)[];
  readonly unsupported: readonly (keyof CapabilityFlags)[];
}

/** Splits capability flags into supported/unsupported lists. */
export function buildCapabilityReport(flags: CapabilityFlags): CapabilityReport {
  const supported: (keyof CapabilityFlags)[] = [];
  const unsupported: (keyof CapabilityFlags)[] = [];
  for (const key of Object.keys(flags) as (keyof CapabilityFlags)[]) {
    (flags[key] ? supported : unsupported).push(key);
  }
  return { supported, unsupported };
}
