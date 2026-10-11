import { describe, expect, it } from 'vitest';
import { aSnapshot, toMillis } from '../../core';
import { createOverviewStore } from './stores';

describe('createOverviewStore', () => {
  it('derives findings and health from an applied snapshot', () => {
    const store = createOverviewStore();
    store.applySnapshot(aSnapshot().network({ url: 'https://a.test/x', status: 500 }).build());

    expect(store.isEmpty.value).toBe(false);
    expect(store.findings.value.length).toBeGreaterThan(0);
    expect(store.topFindings.value.length).toBeLessThanOrEqual(3);
    expect(store.health.value.score).toBeLessThan(100);
    expect(store.networkCount.value).toBe(1);
  });

  it('counts console errors', () => {
    const store = createOverviewStore();
    store.applySnapshot(
      aSnapshot()
        .console({ id: 'c1', kind: 'uncaught' })
        .console({ id: 'c2', level: 'log' })
        .build(),
    );
    expect(store.consoleErrors.value).toBe(1);
  });

  it('ignores console events older than the snapshot, adds newer ones, and de-duplicates by id', () => {
    const store = createOverviewStore();
    store.applySnapshot(aSnapshot().capturedAt(1000).build());

    const stale = {
      at: toMillis(500),
      channel: 'console' as const,
      entry: {
        id: 'old',
        kind: 'console' as const,
        level: 'error' as const,
        timestamp: toMillis(500),
        args: [],
        count: 1,
      },
    };
    store.applyEvent(stale);
    expect(store.consoleErrors.value).toBe(0);

    const fresh = {
      ...stale,
      entry: { ...stale.entry, id: 'new', timestamp: toMillis(2000) },
    };
    store.applyEvent(fresh);
    store.applyEvent(fresh);
    expect(store.consoleErrors.value).toBe(1);
  });

  it('tracks connection status', () => {
    const store = createOverviewStore();
    store.setConnection('disconnected');
    expect(store.connection.value).toBe('disconnected');
  });
});
