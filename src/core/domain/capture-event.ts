import type { Millis } from './brands';
import type { ConsoleEntry } from './console';
import type { NetworkEntry } from './network';
import type { LongTask, VitalMetric } from './performance';
import type { StorageSummary } from './storage';

/** Head shared by every capture event: when the agent captured it. */
interface CaptureEventBase {
  readonly at: Millis;
}

/** A console entry (log/info/warn/error/debug/trace, uncaught, CSP, resource). */
export interface ConsoleCaptureEvent extends CaptureEventBase {
  readonly channel: 'console';
  readonly entry: ConsoleEntry;
}

/** A network entry captured from the fetch/XHR instrumentation. */
export interface NetworkCaptureEvent extends CaptureEventBase {
  readonly channel: 'network';
  readonly entry: NetworkEntry;
}

/** A performance sample: one or more vitals and long tasks. */
export interface PerformanceCaptureEvent extends CaptureEventBase {
  readonly channel: 'performance';
  readonly vitals: readonly VitalMetric[];
  readonly longTasks: readonly LongTask[];
}

/** A per-origin storage summary sample. */
export interface StorageCaptureEvent extends CaptureEventBase {
  readonly channel: 'storage';
  readonly summary: StorageSummary;
}

/**
 * A typed capture event: the unit the main-world agent batches and sends over
 * the secure bridge (PRD 8.4). The payloads are the core domain types, so the
 * protocol mirrors these shapes with Zod rather than redefining them (ADR 0009).
 */
export type CaptureEvent =
  ConsoleCaptureEvent | NetworkCaptureEvent | PerformanceCaptureEvent | StorageCaptureEvent;

/** The `channel` of a capture event, used as the wire discriminant. */
export type CaptureChannel = CaptureEvent['channel'];

/**
 * A batch of capture events with a monotonic per-page sequence and the number of
 * events the pipeline has dropped under backpressure so far. It is transport
 * neutral: the service worker stamps the tab id when it stores it.
 */
export interface CaptureBatch {
  readonly sequence: number;
  readonly dropped: number;
  readonly events: readonly CaptureEvent[];
}
