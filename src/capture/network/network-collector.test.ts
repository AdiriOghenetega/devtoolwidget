import { describe, expect, it } from 'vitest';
import { toMillis, type NetworkEntry } from '../../core';
import type { ClockPort } from '../../platform/ports';
import {
  NetworkCollector,
  type CaptureOptions,
  type FetchLike,
  type FetchResponseLike,
  type ObserverFactory,
  type ResourceEntryLike,
} from './network-collector';
import { instrumentWebSocket, type WebSocketInstanceLike } from './websocket-wrapper';
import { instrumentXhr, type XhrInstanceLike } from './xhr-wrapper';

function createClock(): {
  readonly clock: ClockPort;
  readonly set: (value: number) => void;
  readonly delays: number[];
} {
  const state = { value: 0 };
  const delays: number[] = [];
  return {
    clock: {
      now: () => toMillis(state.value),
      delay: (milliseconds) => {
        delays.push(Number(milliseconds));
        return Promise.resolve();
      },
    },
    set: (value) => {
      state.value = value;
    },
    delays,
  };
}

function createObserver(): {
  readonly factory: ObserverFactory;
  readonly push: (entry: ResourceEntryLike) => void;
  readonly disconnected: () => boolean;
} {
  let callback: ((entries: readonly ResourceEntryLike[]) => void) | undefined;
  let disconnected = false;
  return {
    factory: (next) => {
      callback = next;
      return {
        observe: () => undefined,
        disconnect: () => {
          disconnected = true;
        },
      };
    },
    push: (entry) => callback?.([entry]),
    disconnected: () => disconnected,
  };
}

function createResponse(): FetchResponseLike {
  return {
    url: 'https://api.test/x',
    status: 200,
    redirected: false,
    headers: {
      forEach: (callback) => {
        callback('Bearer secret', 'authorization');
        callback('application/json', 'content-type');
      },
    },
    clone: () => ({ text: () => Promise.resolve('x'.repeat(20)) }),
  };
}

const RESOURCE: ResourceEntryLike = {
  name: 'https://api.test/x',
  startTime: 100,
  duration: 50,
  initiatorType: 'fetch',
  transferSize: 120,
  decodedBodySize: 400,
  domainLookupStart: 100,
  domainLookupEnd: 105,
  connectStart: 105,
  connectEnd: 110,
  secureConnectionStart: 107,
  requestStart: 112,
  responseStart: 130,
  responseEnd: 150,
};

interface Harness {
  readonly call: (url: string, init?: unknown) => Promise<FetchResponseLike>;
  readonly entries: NetworkEntry[];
  readonly clock: ReturnType<typeof createClock>;
  readonly observer: ReturnType<typeof createObserver>;
  readonly collector: NetworkCollector;
  readonly originalFetch: FetchLike;
}

function setup(options: {
  fetchImpl: () => Promise<FetchResponseLike>;
  observer?: ReturnType<typeof createObserver>;
  capture?: Partial<CaptureOptions>;
  redactHeaders?: (headers: Readonly<Record<string, string>>) => Record<string, string>;
  redactString?: (value: string) => string;
  artificialDelayMs?: number;
}): Harness {
  const clock = createClock();
  const observer = options.observer ?? createObserver();
  const originalFetch: FetchLike = () => options.fetchImpl();
  const target: { fetch: FetchLike; PerformanceObserver?: ObserverFactory } = {
    fetch: originalFetch,
    PerformanceObserver: observer.factory,
  };
  const entries: NetworkEntry[] = [];
  const collector = new NetworkCollector({
    target,
    clock: clock.clock,
    emit: (entry) => entries.push(entry),
    ...(options.capture === undefined ? {} : { capture: options.capture }),
    ...(options.redactHeaders === undefined ? {} : { redactHeaders: options.redactHeaders }),
    ...(options.redactString === undefined ? {} : { redactString: options.redactString }),
    ...(options.artificialDelayMs === undefined
      ? {}
      : { artificialDelayMs: options.artificialDelayMs }),
  });
  return {
    call: (url, init) => target.fetch(url, init),
    entries,
    clock,
    observer,
    collector,
    originalFetch,
  };
}

describe('NetworkCollector fetch instrumentation', () => {
  it('records status, sizes, timing phases and cache state from resource entries', async () => {
    const observer = createObserver();
    const harness = setup({
      fetchImpl: () => {
        harness.clock.set(150);
        return Promise.resolve(createResponse());
      },
      observer,
    });
    observer.push(RESOURCE);
    harness.clock.set(100);

    await harness.call('https://api.test/x');

    const entry = harness.entries[0];
    expect(entry).toMatchObject({
      status: 200,
      transferSize: 120,
      decodedSize: 400,
      fromCache: false,
    });
    expect(entry?.timing.dns).toBe(5);
    expect(entry?.timing.connect).toBe(5);
    expect(entry?.timing.tls).toBe(3);
    expect(entry?.timing.ttfb).toBe(18);
    expect(entry?.timing.total).toBe(50);
    expect(entry?.meta?.initiatorType).toBe('fetch');
    harness.collector.dispose();
  });

  it('flags cache hits when transfer is zero but decoded is not', async () => {
    const observer = createObserver();
    const harness = setup({
      fetchImpl: () => Promise.resolve(createResponse()),
      observer,
    });
    observer.push({ ...RESOURCE, startTime: 0, transferSize: 0, decodedBodySize: 400 });

    await harness.call('https://api.test/x');

    expect(harness.entries[0]?.fromCache).toBe(true);
    harness.collector.dispose();
  });

  it('records failures and re-rejects like the original', async () => {
    const harness = setup({ fetchImpl: () => Promise.reject(new Error('boom')) });

    await expect(harness.call('https://api.test/x')).rejects.toThrow('boom');
    expect(harness.entries[0]).toMatchObject({ status: null });
    expect(harness.entries[0]?.failure).toContain('Error: boom');
    harness.collector.dispose();
  });

  it('captures headers and a body preview opt-in without consuming the response', async () => {
    const harness = setup({
      fetchImpl: () => Promise.resolve(createResponse()),
      capture: { headers: true, body: true, maxBodyBytes: 4 },
      redactHeaders: (headers) => ({ ...headers, authorization: 'REDACTED' }),
      redactString: (value) => value.replace('x', 'y'),
    });

    await harness.call('https://api.test/x');

    expect(harness.entries[0]?.headers?.authorization).toBe('REDACTED');
    expect(harness.entries[0]?.headers?.['content-type']).toBe('application/json');
    expect(harness.entries[0]?.bodyPreview).toHaveLength(4);
    expect(harness.entries[0]?.bodyPreview?.startsWith('y')).toBe(true);
    harness.collector.dispose();
  });

  it('applies and flags an artificial delay', async () => {
    const harness = setup({
      fetchImpl: () => Promise.resolve(createResponse()),
      artificialDelayMs: 30,
    });

    await harness.call('https://api.test/x');

    expect(harness.clock.delays).toEqual([30]);
    expect(harness.entries[0]?.meta?.simulatedLatencyMs).toBe(30);
    harness.collector.dispose();
  });

  it('restores fetch and disconnects the observer on dispose', () => {
    const harness = setup({ fetchImpl: () => Promise.resolve(createResponse()) });

    harness.collector.dispose();

    expect(harness.observer.disconnected()).toBe(true);
  });

  it('reads the HTTP method from init', async () => {
    const harness = setup({ fetchImpl: () => Promise.resolve(createResponse()) });

    await harness.call('https://api.test/x', { method: 'post' });

    expect(harness.entries[0]?.method).toBe('POST');
    harness.collector.dispose();
  });

  it('reports a failure without throwing its own error', async () => {
    const harness = setup({ fetchImpl: () => Promise.reject(new Error('nope')) });

    await expect(harness.call('https://api.test/x')).rejects.toThrow('nope');
    expect(harness.entries[0]?.failure).toBe('Error: nope');
    harness.collector.dispose();
  });

  it('falls back to the same-URL resource entry when the start time is far off', async () => {
    const observer = createObserver();
    const harness = setup({
      fetchImpl: () => Promise.resolve(createResponse()),
      observer,
    });
    observer.push({ ...RESOURCE, startTime: 5_000 });

    await harness.call('https://api.test/x');

    expect(harness.entries[0]?.transferSize).toBe(120);
    harness.collector.dispose();
  });
});

describe('XHR and WebSocket instrumentation', () => {
  it('records an XHR loadend', () => {
    const clock = createClock();
    const listeners = new Map<string, () => void>();
    class FakeXhr implements XhrInstanceLike {
      status = 204;
      responseURL = 'https://api.test/x';
      open(): void {
        // no-op
      }
      send(): void {
        for (const listener of listeners.values()) {
          listener();
        }
      }
      addEventListener(type: string, listener: () => void): void {
        listeners.set(type, listener);
      }
    }
    const entries: NetworkEntry[] = [];
    const Patched = instrumentXhr(FakeXhr, {
      clock: clock.clock,
      createId: () => 'xhr-1',
      emit: (entry) => entries.push(entry),
    });
    const instance = new Patched();
    instance.open('post', 'https://api.test/x');
    instance.send();

    expect(entries[0]).toMatchObject({ method: 'POST', status: 204, resourceType: 'xhr' });
    expect(entries[0]?.meta?.finalUrl).toBe('https://api.test/x');
  });

  it('records WebSocket open and close metadata', () => {
    const clock = createClock();
    const listeners = new Map<string, (event: unknown) => void>();
    class FakeWebSocket implements WebSocketInstanceLike {
      url = 'wss://api.test/socket';
      addEventListener(type: string, listener: (event: unknown) => void): void {
        listeners.set(type, listener);
      }
    }
    const entries: NetworkEntry[] = [];
    const Patched = instrumentWebSocket(FakeWebSocket, {
      clock: clock.clock,
      createId: () => 'ws-1',
      emit: (entry) => entries.push(entry),
    });
    const socket = new Patched('wss://api.test/socket');
    listeners.get('open')?.({});
    listeners.get('close')?.({ code: 1000 });
    expect(socket.url).toBe('wss://api.test/socket');

    expect(entries[0]?.meta?.webSocket).toMatchObject({ opened: true, closed: false });
    expect(entries[1]?.meta?.webSocket).toMatchObject({ closed: true, code: 1000 });
  });
});
