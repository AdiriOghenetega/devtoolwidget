import { describe, expect, it } from 'vitest';
import { toMillis, toTabId, type CaptureBatch, type CaptureEvent } from '../../src/core';
import { createFakeStoragePort } from '../../src/platform/fakes';
import type { ClockPort } from '../../src/platform/ports';
import { MAX_BATCH_EVENTS } from '../../src/core';
import {
  EventPipeline,
  PanelBroadcaster,
  TabSessionStore,
  installNavigationWatcher,
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

function event(id: string, at: number): CaptureEvent {
  return {
    at: toMillis(at),
    channel: 'console',
    entry: {
      id,
      kind: 'console',
      level: 'log',
      timestamp: toMillis(at),
      args: [],
      count: 1,
    },
  };
}

function ids(batch: CaptureBatch | undefined): (string | undefined)[] {
  return (
    batch?.events.map((entry) => (entry.channel === 'console' ? entry.entry.id : undefined)) ?? []
  );
}

describe('EventPipeline batching and backpressure', () => {
  it('flushes buffered events on the batch interval with a sequence and dropped count', () => {
    const clock = createClock();
    const scheduler = createScheduler();
    const batches: CaptureBatch[] = [];
    const pipeline = new EventPipeline({
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
    expect(batches[0]?.sequence).toBe(0);
    expect(batches[0]?.dropped).toBe(0);
    expect(ids(batches[0])).toEqual(['a', 'b']);
    expect(pipeline.bufferedCount).toBe(0);
    pipeline.dispose();
  });

  it('drops the oldest events under backpressure and reports the dropped count', () => {
    const clock = createClock();
    const scheduler = createScheduler();
    const batches: CaptureBatch[] = [];
    const pipeline = new EventPipeline({
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
    expect(ids(batches[0])).toEqual(['e2', 'e3', 'e4']);
    expect(batches[0]?.dropped).toBe(2);
    pipeline.dispose();
  });

  it('resets the log and the dropped counter on navigation unless preserveLog is set', () => {
    const clock = createClock();
    const scheduler = createScheduler();
    const batches: CaptureBatch[] = [];
    const pipeline = new EventPipeline({
      clock: clock.clock,
      schedule: scheduler.schedule,
      maxBuffered: 1,
      emit: (batch) => batches.push(batch),
    });

    pipeline.push(event('a', 1));
    pipeline.push(event('dropped', 2));
    expect(pipeline.droppedCount).toBe(1);

    pipeline.navigate();
    expect(batches).toHaveLength(1);
    expect(pipeline.nextSequence).toBe(2);
    expect(pipeline.droppedCount).toBe(0);

    pipeline.push(event('b', 3));
    pipeline.navigate({ preserveLog: true });
    expect(pipeline.nextSequence).toBe(3);
    pipeline.dispose();
  });

  it('caps a full buffer at the batch size so a flushed batch never exceeds the wire cap', () => {
    const clock = createClock();
    const scheduler = createScheduler();
    const batches: CaptureBatch[] = [];
    const pipeline = new EventPipeline({
      clock: clock.clock,
      schedule: scheduler.schedule,
      emit: (batch) => batches.push(batch),
    });

    for (let index = 0; index < MAX_BATCH_EVENTS + 25; index += 1) {
      pipeline.push(event(`e${String(index)}`, index));
    }
    scheduler.tick();

    expect(batches[0]?.events).toHaveLength(MAX_BATCH_EVENTS);
    expect(batches[0]?.dropped).toBe(25);
    pipeline.dispose();
  });

  it('no-ops an empty flush and ignores events after dispose', () => {
    const clock = createClock();
    const scheduler = createScheduler();
    const pipeline = new EventPipeline({
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
  it('persists typed batches and ignores out-of-order batches', async () => {
    const storage = createFakeStoragePort();
    const store = new TabSessionStore(storage, { maxEvents: 10 });

    const applied = await store.applyBatch({
      tabId: TAB,
      sequence: 1,
      dropped: 0,
      events: [event('a', 1)],
    });
    expect(applied.ok).toBe(true);

    const stale = await store.applyBatch({
      tabId: TAB,
      sequence: 0,
      dropped: 0,
      events: [event('old', 0)],
    });
    expect(stale).toEqual({ ok: true, value: false });

    const snapshot = await store.snapshot(TAB);
    expect(snapshot.ok).toBe(true);
    if (snapshot.ok) {
      expect(snapshot.value?.sequence).toBe(1);
      expect(ids({ sequence: 1, dropped: 0, events: snapshot.value?.events ?? [] })).toEqual(['a']);
    }
  });

  it('ignores a duplicate sequence number', async () => {
    const storage = createFakeStoragePort();
    const store = new TabSessionStore(storage, { maxEvents: 10 });
    await store.applyBatch({ tabId: TAB, sequence: 1, dropped: 0, events: [event('a', 1)] });

    const duplicate = await store.applyBatch({
      tabId: TAB,
      sequence: 1,
      dropped: 0,
      events: [event('b', 2)],
    });
    expect(duplicate).toEqual({ ok: true, value: false });

    const snapshot = await store.snapshot(TAB);
    expect(snapshot.ok).toBe(true);
    if (snapshot.ok) {
      expect(snapshot.value?.events).toHaveLength(1);
    }
  });

  it('records the pipeline dropped count from the newest batch', async () => {
    const storage = createFakeStoragePort();
    const store = new TabSessionStore(storage, { maxEvents: 10 });
    await store.applyBatch({ tabId: TAB, sequence: 0, dropped: 0, events: [event('a', 1)] });
    await store.applyBatch({ tabId: TAB, sequence: 1, dropped: 7, events: [event('b', 2)] });

    const snapshot = await store.snapshot(TAB);
    expect(snapshot.ok).toBe(true);
    if (snapshot.ok) {
      expect(snapshot.value?.dropped).toBe(7);
    }
  });

  it('trims stored events to the ring-buffer cap', async () => {
    const storage = createFakeStoragePort();
    const store = new TabSessionStore(storage, { maxEvents: 3 });
    await store.applyBatch({
      tabId: TAB,
      sequence: 0,
      dropped: 0,
      events: [event('a', 1), event('b', 2)],
    });
    await store.applyBatch({
      tabId: TAB,
      sequence: 1,
      dropped: 0,
      events: [event('c', 3), event('d', 4)],
    });

    const snapshot = await store.snapshot(TAB);
    expect(snapshot.ok).toBe(true);
    if (snapshot.ok) {
      expect(ids({ sequence: 1, dropped: 0, events: snapshot.value?.events ?? [] })).toEqual([
        'b',
        'c',
        'd',
      ]);
    }
  });

  it('survives a simulated service-worker restart mid-session', async () => {
    const storage = createFakeStoragePort();
    const first = new TabSessionStore(storage, { maxEvents: 10 });
    await first.applyBatch({ tabId: TAB, sequence: 0, dropped: 0, events: [event('a', 1)] });

    // Restart: a brand-new store over the same storage.session.
    const second = new TabSessionStore(storage, { maxEvents: 10 });
    const applied = await second.applyBatch({
      tabId: TAB,
      sequence: 1,
      dropped: 0,
      events: [event('b', 2)],
    });
    expect(applied).toEqual({ ok: true, value: true });

    const snapshot = await second.snapshot(TAB);
    expect(snapshot.ok).toBe(true);
    if (snapshot.ok) {
      expect(ids({ sequence: 1, dropped: 0, events: snapshot.value?.events ?? [] })).toEqual([
        'a',
        'b',
      ]);
    }

    await second.clear(TAB);
    expect((await second.snapshot(TAB)).ok).toBe(true);
  });

  it('records navigations and can preserve or reset the log', async () => {
    const storage = createFakeStoragePort();
    const store = new TabSessionStore(storage, { maxEvents: 10 });
    await store.applyBatch({ tabId: TAB, sequence: 0, dropped: 0, events: [event('a', 1)] });

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
  const snapshot = {
    tabId: toTabId(1),
    url: 'https://a.test/',
    capturedAt: toMillis(1),
    console: [],
    network: [],
    vitals: [],
    longTasks: [],
    storage: { areas: [] },
  };

  it('sends a snapshot first, buffered deltas next, then live deltas', async () => {
    const sent: { readonly type: string }[] = [];
    const broadcaster = new PanelBroadcaster({
      getSnapshot: () => Promise.resolve(snapshot),
      createId: () => 'c1',
      send: (message) => sent.push({ type: message.type }),
    });

    broadcaster.push(event('before', 1));
    await broadcaster.open();
    broadcaster.push(event('after', 2));

    expect(sent.map((message) => message.type)).toEqual([
      'panel.snapshot',
      'panel.delta',
      'panel.delta',
    ]);
  });

  it('clears buffered deltas on close', async () => {
    const sent: { readonly type: string }[] = [];
    const broadcaster = new PanelBroadcaster({
      getSnapshot: () => Promise.resolve(snapshot),
      createId: () => 'c1',
      send: (message) => sent.push({ type: message.type }),
    });

    broadcaster.push(event('dropped', 1));
    broadcaster.close();
    await broadcaster.open();

    expect(sent.map((message) => message.type)).toEqual(['panel.snapshot']);
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
