import { describe, expect, it } from 'vitest';
import { toMillis, type CaptureBatch, type CaptureEvent } from '../../core';
import type { ClockPort } from '../../platform/ports';
import type { FetchLike, ObserverFactory, ResourceEntryLike } from '../network/network-collector';
import { CaptureAgent } from './capture-agent';

function createClock(): ClockPort {
  const state = { value: 1_000 };
  return {
    now: () => toMillis(state.value),
    delay: () => Promise.resolve(),
  };
}

/** A no-op event target for collectors that are not under test. */
const noopTarget = {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

/** A target that records listeners and lets a test dispatch to them. */
function createDispatchTarget(): {
  readonly target: {
    addEventListener(type: string, listener: (event: unknown) => void): void;
    removeEventListener(type: string, listener: (event: unknown) => void): void;
  };
  readonly dispatch: (type: string, event: unknown) => void;
} {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  return {
    target: {
      addEventListener(type, listener) {
        const set = listeners.get(type) ?? new Set();
        set.add(listener);
        listeners.set(type, set);
      },
      removeEventListener(type, listener) {
        listeners.get(type)?.delete(listener);
      },
    },
    dispatch(type, event) {
      for (const listener of listeners.get(type) ?? []) {
        listener(event);
      }
    },
  };
}

/** A manual scheduler so a test decides when a batch flushes. */
function createManualSchedule(): {
  readonly schedule: (callback: () => void) => () => void;
  readonly flush: () => void;
} {
  let callback: (() => void) | undefined;
  return {
    schedule: (next) => {
      callback = next;
      return () => {
        callback = undefined;
      };
    },
    flush: () => {
      const current = callback;
      callback = undefined;
      current?.();
    },
  };
}

function flatten(batches: readonly CaptureBatch[]): readonly CaptureEvent[] {
  return batches.flatMap((batch) => batch.events);
}

describe('CaptureAgent', () => {
  it('batches a console entry captured through the patched console', () => {
    const scheduler = createManualSchedule();
    const batches: CaptureBatch[] = [];
    const fakeConsole = {
      log: (...args: unknown[]) => args.length,
      error: (...args: unknown[]) => args.length,
    };
    const agent = new CaptureAgent({
      clock: createClock(),
      console: fakeConsole,
      target: noopTarget,
      emit: (batch) => batches.push(batch),
      schedule: scheduler.schedule,
      createId: () => 'id-1',
    });

    agent.start();
    fakeConsole.log('hello');
    scheduler.flush();

    expect(batches).toHaveLength(1);
    const first = batches[0]?.events[0];
    expect(first?.channel).toBe('console');
    if (first?.channel === 'console') {
      expect(first.entry.kind).toBe('console');
      expect(first.entry.level).toBe('log');
    }
    agent.dispose();
  });

  it('batches an uncaught error dispatched on the target', () => {
    const dispatcher = createDispatchTarget();
    const scheduler = createManualSchedule();
    const batches: CaptureBatch[] = [];
    const agent = new CaptureAgent({
      clock: createClock(),
      console: {},
      target: dispatcher.target,
      emit: (batch) => batches.push(batch),
      schedule: scheduler.schedule,
      createId: () => 'id-1',
    });

    agent.start();
    dispatcher.dispatch('error', {
      message: 'boom',
      filename: 'https://x.test/app.js',
      lineno: 3,
      colno: 7,
      error: new Error('boom'),
    });
    scheduler.flush();

    const captured = flatten(batches).find((event) => event.channel === 'console');
    expect(captured?.channel).toBe('console');
    if (captured?.channel === 'console') {
      expect(captured.entry.kind).toBe('uncaught');
    }
    agent.dispose();
  });

  it('batches a network entry captured through the patched fetch', async () => {
    const scheduler = createManualSchedule();
    const batches: CaptureBatch[] = [];
    const response = {
      url: 'https://x.test/data',
      status: 200,
      redirected: false,
      headers: { forEach: () => undefined },
      clone: () => ({ text: () => Promise.resolve('') }),
    };
    const target: {
      fetch?: FetchLike;
      addEventListener(type: string, listener: (event: unknown) => void): void;
      removeEventListener(type: string, listener: (event: unknown) => void): void;
    } = { ...noopTarget, fetch: () => Promise.resolve(response) };

    const agent = new CaptureAgent({
      clock: createClock(),
      console: {},
      target,
      emit: (batch) => batches.push(batch),
      schedule: scheduler.schedule,
      createId: () => 'net-1',
    });

    agent.start();
    const patchedFetch = target.fetch;
    expect(patchedFetch).toBeDefined();
    if (patchedFetch !== undefined) {
      await patchedFetch('https://x.test/data');
    }
    await Promise.resolve();
    scheduler.flush();

    const network = flatten(batches).find((event) => event.channel === 'network');
    expect(network?.channel).toBe('network');
    if (network?.channel === 'network') {
      expect(network.entry.url).toBe('https://x.test/data');
      expect(network.entry.status).toBe(200);
    }
    agent.dispose();
  });

  it('batches long tasks delivered by the performance observer', () => {
    const scheduler = createManualSchedule();
    const batches: CaptureBatch[] = [];
    let deliver: ((entries: readonly ResourceEntryLike[]) => void) | undefined;
    const observer: ObserverFactory = (callback) => {
      deliver = callback;
      return { observe: () => undefined, disconnect: () => undefined };
    };

    const agent = new CaptureAgent({
      clock: createClock(),
      console: {},
      target: { ...noopTarget, PerformanceObserver: observer },
      globals: { PerformanceObserver: () => undefined },
      emit: (batch) => batches.push(batch),
      schedule: scheduler.schedule,
    });

    agent.start();
    deliver?.([{ name: 'self', startTime: 5, duration: 120 }]);
    scheduler.flush();

    const performance = flatten(batches).find((event) => event.channel === 'performance');
    expect(performance?.channel).toBe('performance');
    if (performance?.channel === 'performance') {
      expect(performance.longTasks[0]?.duration).toBe(120);
    }
    agent.dispose();
  });

  it('flushes the final batch on dispose', () => {
    const batches: CaptureBatch[] = [];
    const fakeConsole = { log: (...args: unknown[]) => args.length };
    const agent = new CaptureAgent({
      clock: createClock(),
      console: fakeConsole,
      target: noopTarget,
      emit: (batch) => batches.push(batch),
      schedule: () => () => undefined,
      createId: () => 'id-1',
    });

    agent.start();
    fakeConsole.log('last');
    agent.dispose();

    expect(batches).toHaveLength(1);
    expect(batches[0]?.events).toHaveLength(1);
  });
});
