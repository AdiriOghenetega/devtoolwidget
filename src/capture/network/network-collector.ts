import {
  toBytes,
  toMillis,
  createIdFactory,
  type NetworkEntry,
  type NetworkMeta,
  type NetworkTiming,
  type RedactedHeaders,
} from '../../core';
import type { ClockPort } from '../../platform/ports';

/** A response shaped like the Fetch API's `Response` (structural, for fakes). */
export interface FetchResponseLike {
  readonly url: string;
  readonly status: number;
  readonly redirected: boolean;
  readonly headers: { forEach(callback: (value: string, key: string) => void): void };
  clone(): { text(): Promise<string> };
}

/** A `fetch`-shaped function (structural, for fakes). */
export type FetchLike = (input: unknown, init?: unknown) => Promise<FetchResponseLike>;

/** A subset of a PerformanceResourceTiming entry. */
export interface ResourceEntryLike {
  readonly name: string;
  readonly startTime: number;
  readonly duration: number;
  readonly initiatorType?: string;
  readonly transferSize?: number;
  readonly decodedBodySize?: number;
  readonly domainLookupStart?: number;
  readonly domainLookupEnd?: number;
  readonly connectStart?: number;
  readonly connectEnd?: number;
  readonly secureConnectionStart?: number;
  readonly requestStart?: number;
  readonly responseStart?: number;
  readonly responseEnd?: number;
}

/** A `PerformanceObserver`-shaped observer (structural, for fakes). */
export interface ObserverLike {
  observe(options: { entryTypes: readonly string[] }): void;
  disconnect(): void;
}
export type ObserverFactory = (
  callback: (entries: readonly ResourceEntryLike[]) => void,
) => ObserverLike;

/** Capture-level options for headers and bodies (PRD 7: opt-in, capped, redacted). */
export interface CaptureOptions {
  readonly headers: boolean;
  readonly body: boolean;
  readonly maxBodyBytes: number;
}

/** Options for {@link NetworkCollector}. */
export interface NetworkCollectorOptions {
  readonly target: {
    fetch?: FetchLike;
    PerformanceObserver?: ObserverFactory;
  };
  readonly clock: ClockPort;
  readonly emit: (entry: NetworkEntry) => void;
  readonly capture?: Partial<CaptureOptions>;
  readonly redactHeaders?: (headers: Readonly<Record<string, string>>) => RedactedHeaders;
  readonly redactString?: (value: string) => string;
  readonly createId?: () => string;
  /** Opt-in approximate latency simulation; flagged on every affected entry. */
  readonly artificialDelayMs?: number;
  /** Reconciliation tolerance between a request start and a resource entry (ms). */
  readonly matchToleranceMs?: number;
}

const DEFAULT_CAPTURE: CaptureOptions = { headers: false, body: false, maxBodyBytes: 8_192 };

function phase(end: number | undefined, start: number | undefined): number {
  if (end === undefined || start === undefined || end <= 0 || start <= 0) {
    return 0;
  }
  return Math.max(0, end - start);
}

/** Builds timing phases from a resource entry, falling back to elapsed time. */
export function buildTiming(
  entry: ResourceEntryLike | undefined,
  elapsedMs: number,
): NetworkTiming {
  if (entry === undefined) {
    return {
      dns: toMillis(0),
      connect: toMillis(0),
      tls: toMillis(0),
      ttfb: toMillis(0),
      download: toMillis(0),
      total: toMillis(elapsedMs),
    };
  }
  const tlsStart = entry.secureConnectionStart ?? 0;
  return {
    dns: toMillis(phase(entry.domainLookupEnd, entry.domainLookupStart)),
    connect: toMillis(phase(entry.connectEnd, entry.connectStart)),
    tls: toMillis(tlsStart > 0 ? phase(entry.connectEnd, tlsStart) : 0),
    ttfb: toMillis(phase(entry.responseStart, entry.requestStart)),
    download: toMillis(phase(entry.responseEnd, entry.responseStart)),
    total: toMillis(entry.duration),
  };
}

/**
 * Instruments `fetch` defensively (PRD FR-4): it preserves the native signature,
 * resolves/rejects exactly like the original, and never consumes the page's
 * response body (an opt-in preview reads a `clone()`). Resource timing is
 * reconciled from PerformanceObserver entries by URL and start time.
 */
export class NetworkCollector {
  readonly #options: NetworkCollectorOptions;
  readonly #capture: CaptureOptions;
  readonly #createId: () => string;
  readonly #buffer: ResourceEntryLike[] = [];
  #observer: ObserverLike | undefined;
  #originalFetch: FetchLike | undefined;
  #disposed = false;

  constructor(options: NetworkCollectorOptions) {
    this.#options = options;
    this.#capture = { ...DEFAULT_CAPTURE, ...options.capture };
    this.#createId =
      options.createId ??
      createIdFactory({ now: () => Number(options.clock.now()), random: () => Math.random() });
    this.#startObserver();
    this.#patchFetch();
  }

  /** Restores the original fetch and disconnects the observer. */
  dispose(): void {
    this.#disposed = true;
    this.#observer?.disconnect();
    this.#observer = undefined;
    if (this.#options.target.fetch !== undefined && this.#originalFetch !== undefined) {
      this.#options.target.fetch = this.#originalFetch;
    }
  }

  #startObserver(): void {
    const factory = this.#options.target.PerformanceObserver;
    if (factory === undefined) {
      return;
    }
    this.#observer = factory((entries) => {
      for (const entry of entries) {
        this.#buffer.push(entry);
      }
    });
    try {
      this.#observer.observe({ entryTypes: ['resource'] });
    } catch {
      // Observing resource timing is best-effort.
    }
  }

  #reconcile(url: string, startTime: number): ResourceEntryLike | undefined {
    const tolerance = this.#options.matchToleranceMs ?? 100;
    let fallback: ResourceEntryLike | undefined;
    for (const entry of this.#buffer) {
      if (entry.name !== url && !entry.name.endsWith(url)) {
        continue;
      }
      if (Math.abs(entry.startTime - startTime) <= tolerance) {
        return entry;
      }
      fallback = entry;
    }
    return fallback;
  }

  #emit(entry: NetworkEntry): void {
    if (!this.#disposed) {
      this.#options.emit(entry);
    }
  }

  #captureHeaders(response: FetchResponseLike): RedactedHeaders | undefined {
    if (!this.#capture.headers) {
      return undefined;
    }
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return this.#options.redactHeaders?.(headers) ?? headers;
  }

  async #captureBody(response: FetchResponseLike): Promise<string | undefined> {
    if (!this.#capture.body) {
      return undefined;
    }
    try {
      const text = await response.clone().text();
      const capped = text.slice(0, this.#capture.maxBodyBytes);
      return this.#options.redactString?.(capped) ?? capped;
    } catch {
      return undefined;
    }
  }

  #patchFetch(): void {
    const original = this.#options.target.fetch;
    if (original === undefined) {
      return;
    }
    this.#originalFetch = original;
    const wrapped: FetchLike = async (input, init) => {
      const url = typeof input === 'string' ? input : ((input as { url?: string }).url ?? '');
      const method = this.#method(init);
      const start = Number(this.#options.clock.now());
      try {
        const response = await original(input, init);
        const elapsed = Number(this.#options.clock.now()) - start;
        await this.#finish(url, method, response, elapsed);
        return response;
      } catch (error: unknown) {
        if (!this.#disposed) {
          this.#emit({
            id: this.#createId(),
            method,
            url,
            status: null,
            resourceType: 'fetch',
            transferSize: toBytes(0),
            decodedSize: toBytes(0),
            fromCache: false,
            timing: buildTiming(undefined, Number(this.#options.clock.now()) - start),
            failure: describeError(error),
            meta: { initiatorType: 'fetch' },
          });
        }
        throw error;
      }
    };
    this.#options.target.fetch = wrapped;
  }

  #method(init: unknown): string {
    if (typeof init === 'object' && init !== null && 'method' in init) {
      const method = (init as { method?: unknown }).method;
      if (typeof method === 'string') {
        return method.toUpperCase();
      }
    }
    return 'GET';
  }

  async #finish(
    url: string,
    method: string,
    response: FetchResponseLike,
    elapsed: number,
  ): Promise<void> {
    if (this.#disposed) {
      return;
    }
    const delay = this.#options.artificialDelayMs ?? 0;
    if (delay > 0) {
      await this.#options.clock.delay(toMillis(delay));
    }
    const resource = this.#reconcile(url, Number(this.#options.clock.now()) - elapsed);
    const transferSize = resource?.transferSize ?? 0;
    const decodedSize = resource?.decodedBodySize ?? 0;
    const meta: NetworkMeta = {
      redirected: response.redirected,
      finalUrl: response.url,
      initiatorType: resource?.initiatorType ?? 'fetch',
      ...(delay > 0 ? { simulatedLatencyMs: delay } : {}),
    };
    const headers = this.#captureHeaders(response);
    const bodyPreview = await this.#captureBody(response);
    this.#emit({
      id: this.#createId(),
      method,
      url,
      status: response.status,
      resourceType: resource?.initiatorType ?? 'fetch',
      transferSize: toBytes(transferSize),
      decodedSize: toBytes(decodedSize),
      fromCache: transferSize === 0 && decodedSize > 0,
      timing: buildTiming(resource, elapsed),
      ...(headers === undefined ? {} : { headers }),
      ...(bodyPreview === undefined ? {} : { bodyPreview }),
      meta,
    });
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}
