import { describe, expect, it } from 'vitest';
import { toBytes, toMillis, toTabId } from './brands';
import { DEFAULT_THRESHOLDS } from './constants';
import type { ConsoleEntry } from './console';
import type { ActionRef, Finding } from './finding';
import type { InsightRule } from './insight';
import type { NetworkEntry } from './network';
import type { VitalMetric } from './performance';
import type { PageSnapshot } from './snapshot';

function describeAction(action: ActionRef): string {
  switch (action.type) {
    case 'clearStorage':
      return `clear:${action.preset}`;
    case 'hardReload':
      return 'reload';
    case 'setThrottle':
      return `throttle:${action.profile}`;
    case 'toggleDisableCache':
      return `cache:${String(action.enabled)}`;
    case 'exportReport':
      return `export:${action.format}`;
  }
}

const consoleEntry: ConsoleEntry = {
  id: 'c1',
  kind: 'uncaught',
  level: 'error',
  timestamp: toMillis(10),
  args: [
    { type: 'string', value: 'boom' },
    {
      type: 'object',
      entries: [{ key: 'status', value: { type: 'number', value: 500 } }],
      truncated: false,
    },
  ],
  count: 2,
};

const networkEntry: NetworkEntry = {
  id: 'n1',
  method: 'GET',
  url: 'https://example.com/app.js',
  status: 200,
  resourceType: 'script',
  transferSize: toBytes(1024),
  decodedSize: toBytes(4096),
  fromCache: false,
  timing: {
    dns: toMillis(1),
    connect: toMillis(2),
    tls: toMillis(3),
    ttfb: toMillis(40),
    download: toMillis(5),
    total: toMillis(51),
  },
};

const vitals: readonly VitalMetric[] = [
  { name: 'LCP', value: 1_800, rating: 'good', element: 'img.hero' },
  { name: 'CLS', value: 0.05, rating: 'good', shiftedNodes: ['#ad'] },
  { name: 'INP', value: 120, rating: 'good', interactionTarget: 'button#buy' },
  { name: 'FCP', value: 900, rating: 'good' },
  { name: 'TTFB', value: 300, rating: 'good' },
];

const snapshot: PageSnapshot = {
  tabId: toTabId(1),
  url: 'https://example.com',
  capturedAt: toMillis(1_000),
  console: [consoleEntry],
  network: [networkEntry],
  vitals,
  longTasks: [{ startTime: toMillis(1_200), duration: toMillis(120), name: 'self' }],
  storage: {
    areas: [{ area: 'localStorage', count: 3, approximateSize: toBytes(2_048) }],
  },
};

const slowRequestsRule: InsightRule = {
  id: 'R02',
  category: 'network',
  evaluate(input, thresholds) {
    return input.network
      .filter(
        (entry) =>
          entry.timing.total > thresholds.slowRequestTotal ||
          entry.timing.ttfb > thresholds.slowRequestTtfb,
      )
      .map((entry): Finding => ({
        id: `R02:${entry.id}`,
        ruleId: 'R02',
        severity: 'warning',
        category: 'network',
        title: 'Slow request',
        evidence: [entry.url],
        suggestion: 'Reduce server response time or cache the resource.',
        actions: [{ type: 'hardReload' }],
      }));
  },
};

describe('ActionRef', () => {
  it('renders every variant of the discriminated union', () => {
    expect(describeAction({ type: 'clearStorage', preset: 'fresh-visitor' })).toBe(
      'clear:fresh-visitor',
    );
    expect(describeAction({ type: 'hardReload' })).toBe('reload');
    expect(describeAction({ type: 'setThrottle', profile: 'slow-3g' })).toBe('throttle:slow-3g');
    expect(describeAction({ type: 'toggleDisableCache', enabled: true })).toBe('cache:true');
    expect(describeAction({ type: 'exportReport', format: 'har' })).toBe('export:har');
  });
});

describe('PageSnapshot', () => {
  it('carries the captured console, network, performance and storage data', () => {
    expect(snapshot.console[0]?.count).toBe(2);
    expect(snapshot.network[0]?.status).toBe(200);
    expect(snapshot.vitals).toHaveLength(5);
    expect(snapshot.longTasks[0]?.duration).toBe(120);
    expect(snapshot.storage.areas[0]?.area).toBe('localStorage');
  });
});

describe('InsightRule', () => {
  it('produces no findings when the request is under the thresholds', () => {
    const findings = slowRequestsRule.evaluate(snapshot, DEFAULT_THRESHOLDS);
    expect(findings).toHaveLength(0);
  });

  it('produces a finding when the request exceeds the thresholds', () => {
    const findings = slowRequestsRule.evaluate(snapshot, {
      ...DEFAULT_THRESHOLDS,
      slowRequestTotal: toMillis(10),
      slowRequestTtfb: toMillis(5),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('R02');
    expect(findings[0]?.actions).toEqual([{ type: 'hardReload' }]);
  });
});
