import { describe, expect, it } from 'vitest';
import { toBytes, toMillis, toTabId } from '../domain/brands';
import type { CaptureEvent } from '../domain/capture-event';
import type { ConsoleEntry } from '../domain/console';
import type { NetworkEntry } from '../domain/network';
import type { LongTask, VitalMetric } from '../domain/performance';
import { foldCaptureEvents } from './fold';

function consoleEntry(id: string): ConsoleEntry {
  return {
    id,
    kind: 'console',
    level: 'log',
    timestamp: toMillis(0),
    args: [],
    count: 1,
  };
}

function networkEntry(id: string): NetworkEntry {
  return {
    id,
    method: 'GET',
    url: 'https://x.test/',
    status: 200,
    resourceType: 'fetch',
    transferSize: toBytes(0),
    decodedSize: toBytes(0),
    fromCache: false,
    timing: {
      dns: toMillis(0),
      connect: toMillis(0),
      tls: toMillis(0),
      ttfb: toMillis(0),
      download: toMillis(0),
      total: toMillis(0),
    },
  };
}

function vital(value: number): VitalMetric {
  return { name: 'LCP', value, rating: 'good' };
}

function longTask(duration: number): LongTask {
  return { startTime: toMillis(0), duration: toMillis(duration) };
}

const EVENTS: readonly CaptureEvent[] = [
  { at: toMillis(1), channel: 'console', entry: consoleEntry('c1') },
  { at: toMillis(2), channel: 'console', entry: consoleEntry('c2') },
  { at: toMillis(3), channel: 'network', entry: networkEntry('n1') },
  { at: toMillis(4), channel: 'performance', vitals: [vital(100)], longTasks: [longTask(5)] },
  { at: toMillis(5), channel: 'performance', vitals: [vital(200)], longTasks: [longTask(6)] },
  { at: toMillis(6), channel: 'storage', summary: { areas: [] } },
];

describe('foldCaptureEvents', () => {
  it('groups entries, deduplicates vitals by name, concatenates long tasks and takes the last storage summary', () => {
    const snapshot = foldCaptureEvents({
      tabId: toTabId(7),
      capturedAt: toMillis(9),
      url: 'https://x.test/',
      events: EVENTS,
    });

    expect(snapshot.tabId).toBe(7);
    expect(snapshot.url).toBe('https://x.test/');
    expect(snapshot.capturedAt).toBe(9);
    expect(snapshot.console.map((entry) => entry.id)).toEqual(['c1', 'c2']);
    expect(snapshot.network.map((entry) => entry.id)).toEqual(['n1']);
    expect(snapshot.vitals).toHaveLength(1);
    expect(snapshot.vitals[0]?.value).toBe(200);
    expect(snapshot.longTasks.map((task) => task.duration)).toEqual([5, 6]);
    expect(snapshot.storage).toEqual({ areas: [] });
  });

  it('returns an empty snapshot for no events and defaults the url', () => {
    const snapshot = foldCaptureEvents({ tabId: toTabId(1), capturedAt: toMillis(0), events: [] });
    expect(snapshot.url).toBe('');
    expect(snapshot.console).toEqual([]);
    expect(snapshot.network).toEqual([]);
    expect(snapshot.vitals).toEqual([]);
    expect(snapshot.longTasks).toEqual([]);
  });
});
