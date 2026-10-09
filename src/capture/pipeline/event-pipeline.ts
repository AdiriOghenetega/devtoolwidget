import { EVENT_BATCH_INTERVAL, toMillis, type Millis, type TabId } from '../../core';
import type { ClockPort } from '../../platform/ports';

/** A single captured event flowing through the pipeline. */
export interface PipelineEvent {
  readonly kind: string;
  readonly at: Millis;
}

/** A flushed batch of events with a monotonic sequence per pipeline. */
export interface Batch {
  readonly tabId: TabId;
  readonly sequence: number;
  readonly events: readonly PipelineEvent[];
}

/** Schedules a callback and returns a cancel function (injected for tests). */
export type Scheduler = (callback: () => void, delayMs: number) => () => void;

/** Default cap on buffered events before backpressure drops the oldest. */
export const DEFAULT_MAX_BUFFERED = 1_000;

/** Options for {@link EventPipeline}. */
export interface EventPipelineOptions {
  readonly tabId: TabId;
  readonly clock: ClockPort;
  readonly emit: (batch: Batch) => void;
  readonly schedule?: Scheduler;
  readonly intervalMs?: number;
  readonly maxBuffered?: number;
}

/**
 * Batches captured events and flushes them every `intervalMs` (default 100ms,
 * PRD 7). Backpressure policy: when the buffer is full, the **oldest** buffered
 * event is dropped and the dropped counter is incremented, so the pipeline keeps
 * the freshest data and never grows unbounded. Navigations flush the current
 * batch and, unless `preserveLog` is set, start a fresh log for the new page.
 */
export class EventPipeline {
  readonly #options: EventPipelineOptions;
  readonly #intervalMs: number;
  readonly #maxBuffered: number;
  readonly #schedule: Scheduler;
  #buffer: PipelineEvent[] = [];
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
  push(event: PipelineEvent): void {
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
    const batch: Batch = {
      tabId: this.#options.tabId,
      sequence: this.#sequence,
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

/** Convenience for tests: an event stamped with the injected clock. */
export function pipelineEvent(kind: string, at: Millis): PipelineEvent {
  return { kind, at };
}

/** Re-export so callers can brand timestamps when building events. */
export { toMillis };
