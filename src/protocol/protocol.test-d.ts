import { describe, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import type {
  Bytes,
  ConsoleEntry,
  LongTask,
  Millis,
  NetworkEntry,
  NetworkTiming,
  StorageSummary,
  TabId,
  VitalMetric,
} from '../core';
import type {
  bytesSchema,
  consoleEntrySchema,
  longTaskSchema,
  millisSchema,
  networkEntrySchema,
  networkTimingSchema,
  pageSnapshotSchema,
  storageSummarySchema,
  tabIdSchema,
  vitalMetricSchema,
} from './payloads';

describe('payload schemas stay aligned with the core domain', () => {
  it('produces exactly the core branded types', () => {
    expectTypeOf<z.infer<typeof millisSchema>>().toEqualTypeOf<Millis>();
    expectTypeOf<z.infer<typeof bytesSchema>>().toEqualTypeOf<Bytes>();
    expectTypeOf<z.infer<typeof tabIdSchema>>().toEqualTypeOf<TabId>();
  });

  it('keeps the console entry required fields aligned', () => {
    expectTypeOf<z.infer<typeof consoleEntrySchema>>().toExtend<
      Pick<ConsoleEntry, 'id' | 'kind' | 'level' | 'timestamp' | 'args' | 'count'>
    >();
    expectTypeOf<z.infer<typeof consoleEntrySchema>['stack']>().toEqualTypeOf<string | undefined>();
  });

  it('keeps the network types aligned', () => {
    expectTypeOf<z.infer<typeof networkTimingSchema>>().toExtend<NetworkTiming>();
    expectTypeOf<z.infer<typeof networkEntrySchema>>().toExtend<
      Pick<
        NetworkEntry,
        | 'id'
        | 'method'
        | 'url'
        | 'status'
        | 'resourceType'
        | 'transferSize'
        | 'decodedSize'
        | 'fromCache'
        | 'timing'
      >
    >();
  });

  it('keeps the storage summary aligned', () => {
    expectTypeOf<z.infer<typeof storageSummarySchema>>().toExtend<StorageSummary>();
  });

  it('keeps the vitals and long tasks aligned', () => {
    expectTypeOf<z.infer<typeof vitalMetricSchema>['name']>().toEqualTypeOf<VitalMetric['name']>();
    expectTypeOf<z.infer<typeof longTaskSchema>>().toExtend<
      Pick<LongTask, 'startTime' | 'duration'>
    >();
  });

  it('keeps the snapshot fields aligned', () => {
    expectTypeOf<z.infer<typeof pageSnapshotSchema>['tabId']>().toEqualTypeOf<TabId>();
    expectTypeOf<z.infer<typeof pageSnapshotSchema>['capturedAt']>().toEqualTypeOf<Millis>();
    expectTypeOf<z.infer<typeof pageSnapshotSchema>['storage']>().toExtend<StorageSummary>();
  });
});
