import { toBytes, toMillis, type Bytes, type Millis } from './brands';

const KIB = 1024;
const MIB = 1024 * KIB;

/** Default ring-buffer capacity for captured entries (PRD FR-3). */
export const DEFAULT_CONSOLE_BUFFER_CAPACITY = 1000;

/** Maximum number of saved snapshots (PRD FR-9). */
export const MAX_SNAPSHOTS = 20;

/** Event batching interval for the capture pipeline (PRD section 7). */
export const EVENT_BATCH_INTERVAL: Millis = toMillis(100);

/** Memory budget for all capture buffers (PRD section 7). */
export const MEMORY_BUDGET: Bytes = toBytes(50 * MIB);

/** A metric's "needs improvement" and "poor" cut-offs. */
export interface MetricThreshold {
  readonly needsImprovement: number;
  readonly poor: number;
}

/** Total blocking time cut-offs for warning and critical findings (R12). */
export interface TotalBlockingTimeThreshold {
  readonly warning: Millis;
  readonly critical: Millis;
}

/** Per-origin storage size cut-offs (R17). */
export interface StorageThresholds {
  readonly localStorage: Bytes;
  readonly indexedDB: Bytes;
  readonly cookies: Bytes;
}

/**
 * All insight thresholds, injected into every {@link InsightRule}. Every value
 * is editable from Settings (PRD section 10).
 */
export interface Thresholds {
  /** R02: total request time above this is slow. */
  readonly slowRequestTotal: Millis;
  /** R02: TTFB above this is slow. */
  readonly slowRequestTtfb: Millis;
  /** R03: non-media transfer size above this is a large payload. */
  readonly largePayload: Bytes;
  /** R03: image transfer size above this is a large payload. */
  readonly largeImage: Bytes;
  /** R04: text-like response above this should be compressed. */
  readonly uncompressedText: Bytes;
  /** R06: same URL and method within this window is a duplicate. */
  readonly duplicateRequestWindow: Millis;
  /** R07: more than this many requests is too many. */
  readonly maxRequests: number;
  /** R07: more than this many distinct origins is too many. */
  readonly maxDistinctOrigins: number;
  /** R09: LCP cut-offs, in milliseconds. */
  readonly lcp: MetricThreshold;
  /** R10: CLS cut-offs (unitless). */
  readonly cls: MetricThreshold;
  /** R11: INP cut-offs, in milliseconds. */
  readonly inp: MetricThreshold;
  /** R12: total blocking time cut-offs. */
  readonly totalBlockingTime: TotalBlockingTimeThreshold;
  /** R17: per-origin storage size cut-offs. */
  readonly storage: StorageThresholds;
}

/**
 * Default insight thresholds, taken from PRD section 10.
 *
 * The Core Web Vitals "needs improvement"/"poor" cut-offs were re-verified
 * against web.dev (Web Vitals, last updated 2024-10-31): LCP good <= 2.5 s,
 * CLS good <= 0.1, INP good <= 200 ms.
 *
 * Rules whose PRD bullet gives no number are intentionally absent: R01, R05,
 * R08, R13 and R14 are categorical, and R15 (oversized images) and R16 (memory
 * growth) still need product decisions, so no magic numbers are invented here.
 */
export const DEFAULT_THRESHOLDS: Thresholds = {
  slowRequestTotal: toMillis(1_000),
  slowRequestTtfb: toMillis(600),
  largePayload: toBytes(500 * KIB),
  largeImage: toBytes(1 * MIB),
  uncompressedText: toBytes(1 * KIB),
  duplicateRequestWindow: toMillis(2_000),
  maxRequests: 100,
  maxDistinctOrigins: 15,
  lcp: { needsImprovement: 2_500, poor: 4_000 },
  cls: { needsImprovement: 0.1, poor: 0.25 },
  inp: { needsImprovement: 200, poor: 500 },
  totalBlockingTime: { warning: toMillis(300), critical: toMillis(600) },
  storage: {
    localStorage: toBytes(5 * MIB),
    indexedDB: toBytes(5 * MIB),
    cookies: toBytes(4 * KIB),
  },
};
