import { describe, expect, it } from 'vitest';
import { toMillis, toTabId } from '../../src/core';
import { createFakeStoragePort } from '../../src/platform/fakes';
import type { ClockPort } from '../../src/platform/ports';
import {
  EventPipeline,
  PanelBroadcaster,
  TabSessionStore,
  installNavigationWatcher,
  type Batch,
  type PipelineEvent,
  type Scheduler,
} from '../../src/capture/pipeline';

const TAB = toTabId(1);

function createClock(): { readonly clock: ClockPort; readonly set: (value: number) => void } {
  const state = { value: 0 };
  return {
    clock: { now: () => toMillis(state.value), delay: () => Promise.resolve() },
    set: (value) => {
      state.value = value;
    },
  };
}

function createScheduler(): {
  readonly schedule: Scheduler;
  readonly tick: () => void;
  readonly pending: () => boolean;
} {
  let callback: (() => void) | undefined;
  return {
    schedule: (next) => {
      callback = next;
      return () => {
        callback = undefined;
      };
    },
    tick: () => {
      const current = callback;
      callback = undefined;
      current?.();
    },
    pending: () => callback !== undefined,
  };
}

function event(kind: string, at: number): PipelineEvent {
  return { kind, at: toMillis(at) };
}

describe('EventPipeline batching and backpressure', () => {
  it('flushes buffered events on the batch interval', () => {
    const clock = createClock();
    const scheduler = createScheduler();
    const batches: Batch[] = [];
    const pipeline = new EventPipeline({
      tabId: TAB,
      clock: clock.clock,
      schedule: scheduler.schedule,
      intervalMs: 100,
      emit: (batch) => batches.push(batch),
    });

    pipeline.push(event('a', 1));
    pipeline.push(event('b', 2));
    expect(batches).toHaveLength(0);
    expect(scheduler.pending()).toBe(true);

    scheduler.tick();

    expect(batches).toHaveLength(1);
    expect(batches[0]).toMatchObject({ tabId: 1, sequence: 0 });
    expect(batches[0]?.events.map((entry) => entry.kind)).toEqual(['a', 'b']);
    expect(pipeline.bufferedCount).toBe(0);
    pipeline.dispose();
  });

  it('drops the oldest events under backpressure and counts them', () => {
    const clock = createClock();
    const scheduler = createScheduler();
    const batches: Batch[] = [];
    const pipeline = new EventPipeline({
      tabId: TAB,
      clock: clock.clock,
      schedule: scheduler.schedule,
      maxBuffered: 3,
      emit: (batch) => batches.push(batch),
    });

    for (let index = 0; index < 5; index += 1) {
      pipeline.push(event(`e${String(index)}`, index));
    }

    expect(pipeline.droppedCount).toBe(2);
    expect(pipeline.bufferedCount).toBe(3);
    scheduler.tick();
    expect(batches[0]?.events.map((entry) => entry.kind)).toEqual(['e2', 'e3', 'e4']);
    pipeline.dispose();
  });

  it('resets the log on navigation unless preserveLog is set', () => {
    const clock = createClock();
    const scheduler = createScheduler();
    const batches: Batch[] = [];
    const pipeline = new EventPipeline({
      tabId: TAB,
      clock: clock.clock,
      schedule: scheduler.schedule,
      emit: (batch) => batches.push(batch),
    });

    pipeline.push(event('a', 1));
    pipeline.navigate();
    expect(batches).toHaveLength(1);
    expect(pipeline.nextSequence).toBe(2);

    pipeline.push(event('b', 2));
    pipeline.navigate({ preserveLog: true });
    expect(pipeline.nextSequence).toBe(3);
    pipeline.dispose();
  });

  it('no-ops an empty flush and ignores events after dispose', () => {
    const clock = createClock();
    const scheduler = createScheduler();
    const pipeline = new EventPipeline({
      tabId: TAB,
      clock: clock.clock,
      schedule: scheduler.schedule,
      emit: () => undefined,
    });

    pipeline.flush();
    pipeline.dispose();
    pipeline.push(event('late', 1));

    expect(pipeline.bufferedCount).toBe(0);
  });
});

describe('TabSessionStore across a service-worker restart', () => {
  it('persists batches and ignores out-of-order batches', async () => {
    const storage = createFakeStoragePort();
    const store = new TabSessionStore(storage, { maxEvents: 10 });

    expect((await store.applyBatch({ tabId: TAB, sequence: 1, events: [event('a', 1)] })).ok).toBe(
      true,
    );
    const stale = await store.applyBatch({ tabId: TAB, sequence: 0, events: [event('old', 0)] });
    expect(stale).toEqual({ ok: true, value: false });

    const snapshot = await store.snapshot(TAB);
    expect(snapshot.ok).toBe(true);
    if (snapshot.ok) {
      expect(snapshot.value?.sequence).toBe(1);
      expect(snapshot.value?.events.map((entry) => entry.kind)).toEqual(['a']);
    }
  });

  it('survives a simulated service-worker restart mid-session', async () => {
    const storage = createFakeStoragePort();
    const first = new TabSessionStore(storage, { maxEvents: 10 });
    await first.applyBatch({ tabId: TAB, sequence: 0, events: [event('a', 1)] });

    // Restart: a brand-new store over the same storage.session.
    const second = new TabSessionStore(storage, { maxEvents: 10 });
    const applied = await second.applyBatch({ tabId: TAB, sequence: 1, events: [event('b', 2)] });
    expect(applied).toEqual({ ok: true, value: true });

    const snapshot = await second.snapshot(TAB);
    expect(snapshot.ok).toBe(true);
    if (snapshot.ok) {
      expect(snapshot.value?.events.map((entry) => entry.kind)).toEqual(['a', 'b']);
    }

    await second.clear(TAB);
    expect((await second.snapshot(TAB)).ok).toBe(true);
  });

  it('records navigations and can preserve or reset the log', async () => {
    const storage = createFakeStoragePort();
    const store = new TabSessionStore(storage, { maxEvents: 10 });
    await store.applyBatch({ tabId: TAB, sequence: 0, events: [event('a', 1)] });

    await store.markNavigation(TAB, 'https://a.test/', { preserveLog: true });
    const preserved = await store.snapshot(TAB);
    expect(preserved.ok).toBe(true);
    if (preserved.ok) {
      expect(preserved.value?.events).toHaveLength(1);
      expect(preserved.value?.url).toBe('https://a.test/');
    }

    await store.markNavigation(TAB, 'https://b.test/');
    const reset = await store.snapshot(TAB);
    expect(reset.ok).toBe(true);
    if (reset.ok) {
      expect(reset.value?.events).toHaveLength(0);
    }
  });
});

describe('PanelBroadcaster snapshot then deltas', () => {
  it('sends a snapshot first, buffered deltas next, then live deltas', () => {
    const sent: { readonly type: string }[] = [];
    const broadcaster = new PanelBroadcaster({
      getState: () => ({ tabId: 1, sequence: 0, events: [], dropped: 0 }),
      send: (message) => sent.push({ type: message.type }),
    });

    broadcaster.push(event('before', 1));
    broadcaster.open();
    broadcaster.push(event('after', 2));

    expect(sent.map((message) => message.type)).toEqual(['snapshot', 'delta', 'delta']);
  });

  it('clears buffered deltas on close', () => {
    const sent: { readonly type: string }[] = [];
    const broadcaster = new PanelBroadcaster({
      getState: () => ({ tabId: 1, sequence: 0, events: [], dropped: 0 }),
      send: (message) => sent.push({ type: message.type }),
    });

    broadcaster.push(event('dropped', 1));
    broadcaster.close();
    broadcaster.open();

    expect(sent.map((message) => message.type)).toEqual(['snapshot']);
  });
});

describe('installNavigationWatcher SPA detection', () => {
  it('detects pushState, popstate and navigation, and uninstalls cleanly', () => {
    const listeners = new Map<string, () => void>();
    let url = 'https://app.test/';
    const changes: string[] = [];
    const historyCalls: unknown[][] = [];
    const historyState = {
      pushState: (...args: unknown[]): void => {
        historyCalls.push(args);
      },
      replaceState: (...args: unknown[]): void => {
        historyCalls.push(args);
      },
    };
    const uninstall = installNavigationWatcher({
      target: {
        addEventListener: (type, listener) => listeners.set(type, listener as () => void),
        removeEventListener: (type) => listeners.delete(type),
      },
      history: historyState,
      getUrl: () => url,
      onChange: (next, kind) => changes.push(`${kind}:${next}`),
    });

    url = 'https://app.test/a';
    historyState.pushState({}, '', '/a');
    url = 'https://app.test/b';
    historyState.replaceState({}, '', '/b');
    listeners.get('popstate')?.();
    listeners.get('navigation')?.();

    expect(historyCalls).toHaveLength(2);

    expect(changes).toEqual([
      'push:https://app.test/a',
      'replace:https://app.test/b',
      'pop:https://app.test/b',
      'navigate:https://app.test/b',
    ]);

    uninstall();
    expect(listeners.size).toBe(0);
  });
});
