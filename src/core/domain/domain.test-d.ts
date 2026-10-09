import { describe, expectTypeOf, it } from 'vitest';
import { toBytes, toMillis, toTabId, type Bytes, type Millis, type TabId } from './brands';
import { DEFAULT_THRESHOLDS, type MetricThreshold, type Thresholds } from './constants';
import type { ConsoleEntry } from './console';
import type { ActionRef, Finding, FindingCategory, Severity } from './finding';
import type { InsightRule } from './insight';
import type { NetworkEntry, NetworkTiming } from './network';
import type { LongTask, VitalMetric } from './performance';
import type { PageSnapshot } from './snapshot';
import type { StorageSummary } from './storage';

describe('domain type-level API', () => {
  it('brands plain numbers and blocks the reverse assignment', () => {
    expectTypeOf(toMillis(1)).toEqualTypeOf<Millis>();
    expectTypeOf(toTabId(1)).toEqualTypeOf<TabId>();
    expectTypeOf(toBytes(1)).toEqualTypeOf<Bytes>();
    expectTypeOf<Millis>().toExtend<number>();
    expectTypeOf<number>().not.toExtend<Millis>();
  });

  it('uses literal severities and categories', () => {
    expectTypeOf<Severity>().toEqualTypeOf<'critical' | 'warning' | 'info'>();
    expectTypeOf<FindingCategory>().toEqualTypeOf<
      'network' | 'performance' | 'console' | 'storage'
    >();
  });

  it('models ActionRef as a discriminated union', () => {
    expectTypeOf<Extract<ActionRef, { type: 'clearStorage' }>['preset']>().toEqualTypeOf<
      'fresh-visitor' | 'clear-everything-and-reload'
    >();
    expectTypeOf<Extract<ActionRef, { type: 'hardReload' }>>().toEqualTypeOf<{
      readonly type: 'hardReload';
    }>();
    expectTypeOf<Extract<ActionRef, { type: 'setThrottle' }>['profile']>().toEqualTypeOf<
      'offline' | 'slow-3g' | 'fast-3g' | '4g' | 'custom'
    >();
    expectTypeOf<
      Extract<ActionRef, { type: 'toggleDisableCache' }>['enabled']
    >().toEqualTypeOf<boolean>();
    expectTypeOf<Extract<ActionRef, { type: 'exportReport' }>['format']>().toEqualTypeOf<
      'markdown' | 'json' | 'har'
    >();
  });

  it('types the insight rule signature', () => {
    expectTypeOf<InsightRule['evaluate']>().toEqualTypeOf<
      (input: PageSnapshot, thresholds: Thresholds) => readonly Finding[]
    >();
  });

  it('types DEFAULT_THRESHOLDS and its unit-bearing fields', () => {
    expectTypeOf(DEFAULT_THRESHOLDS).toExtend<Thresholds>();
    expectTypeOf<Thresholds['lcp']>().toEqualTypeOf<MetricThreshold>();
    expectTypeOf<Thresholds['totalBlockingTime']['warning']>().toEqualTypeOf<Millis>();
    expectTypeOf<Thresholds['storage']['cookies']>().toEqualTypeOf<Bytes>();
  });

  it('types the captured entries', () => {
    expectTypeOf<ConsoleEntry['timestamp']>().toEqualTypeOf<Millis>();
    expectTypeOf<NetworkEntry['status']>().toEqualTypeOf<number | null>();
    expectTypeOf<NetworkTiming['total']>().toEqualTypeOf<Millis>();
    expectTypeOf<VitalMetric['name']>().toEqualTypeOf<'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB'>();
    expectTypeOf<LongTask['duration']>().toEqualTypeOf<Millis>();
    expectTypeOf<StorageSummary['areas']>().toExtend<readonly unknown[]>();
  });
});
