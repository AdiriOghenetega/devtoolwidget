import {
  EVENT_BATCH_INTERVAL,
  MAX_BATCH_EVENTS,
  type CaptureBatch,
  type CaptureEvent,
} from '../../core';
import type { ClockPort } from '../../platform/ports';

/** Schedules a callback and returns a cancel function (injected for tests). */
export type Scheduler = (callback: () => void, delayMs: number) => () => void;

/** Default cap on buffered events before backpressure drops the oldest. */
export const DEFAULT_MAX_BUFFERED = MAX_BATCH_EVENTS;

/** Options for {@link EventPipeline}. */
export interface EventPipelineOptions {
  readonly clock: ClockPort;
  readonly emit: (batch: CaptureBatch) => void;
  readonly schedule?: Scheduler;
  readonly intervalMs?: number;
  readonly maxBuffered?: number;
}

/**
 * Batches typed capture events and flushes them every `intervalMs` (default
 * 100 ms, PRD 7). Backpressure policy: when the buffer is full, the **oldest**
 * buffered event is dropped and the dropped counter is incremented, so the
 * pipeline keeps the freshest data and never grows unbounded. Navigations flush
 * the current batch and, unless `preserveLog` is set, start a fresh log for the
 * new page.
 *
 * The pipeline is tab-agnostic: the main-world agent owns one per document and
 * the service worker stamps the tab id when it stores the batch (PRD 8.4).
 */
export class EventPipeline {
  readonly #options: EventPipelineOptions;
  readonly #intervalMs: number;
  readonly #maxBuffered: number;
  readonly #schedule: Scheduler;
  #buffer: CaptureEvent[] = [];
  #sequence = 0;
  #dropped = 0;
  #cancel: (() => void) | undefined;
  #disposed = false;

  constructor(options: EventPipelineOptions) {
    this.#options = options;
    this.#intervalMs = options.intervalMs ?? Number(EVENT_BATCH_INTERVAL);
    this.#maxBuffered = options.maxBuffered ?? DEFAULT_MAX_BUFFERED;
    this.#schedule = options.schedule ?? defaultSchedule;
  }

  /** Buffered (not yet flushed) events. */
  get bufferedCount(): number {
    return this.#buffer.length;
  }

  /** Number of events dropped by the backpressure policy. */
  get droppedCount(): number {
    return this.#dropped;
  }

  /** The next sequence number that will be assigned to a batch. */
  get nextSequence(): number {
    return this.#sequence;
  }

  /** Buffers an event, dropping the oldest when the buffer is full. */
  push(event: CaptureEvent): void {
    if (this.#disposed) {
      return;
    }
    if (this.#buffer.length >= this.#maxBuffered) {
      this.#buffer.shift();
      this.#dropped += 1;
    }
    this.#buffer.push(event);
    this.#ensureTimer();
  }

  /** Emits the current buffer as a batch (no-op when empty). */
  flush(): void {
    if (this.#buffer.length === 0) {
      return;
    }
    const batch: CaptureBatch = {
      sequence: this.#sequence,
      dropped: this.#dropped,
      events: [...this.#buffer],
    };
    this.#sequence += 1;
    this.#buffer = [];
    this.#options.emit(batch);
  }

  /**
   * Handles a navigation: flushes the current batch, then resets the log for the
   * new page unless `preserveLog` is set (which keeps prior events in the stream).
   */
  navigate(options: { readonly preserveLog?: boolean } = {}): void {
    this.flush();
    if (options.preserveLog !== true) {
      this.#buffer = [];
      this.#sequence += 1;
      this.#dropped = 0;
    }
  }

  /** Stops the timer (flushing first) and marks the pipeline disposed. */
  dispose(): void {
    this.#disposed = true;
    this.#cancel?.();
    this.#cancel = undefined;
    this.flush();
  }

  #ensureTimer(): void {
    if (this.#cancel !== undefined || this.#disposed) {
      return;
    }
    this.#cancel = this.#schedule(() => {
      this.#cancel = undefined;
      this.flush();
      if (this.#buffer.length > 0) {
        this.#ensureTimer();
      }
    }, this.#intervalMs);
  }
}

function defaultSchedule(callback: () => void, delayMs: number): () => void {
  const handle = globalThis.setTimeout(callback, delayMs);
  return () => {
    globalThis.clearTimeout(handle);
  };
}
