import { z } from 'zod';
import { MAX_BATCH_EVENTS, toBytes, toMillis, toTabId, type SerializedValue } from '../core';

/**
 * Zod schemas for the payloads that cross the wire. They are the wire contract;
 * `core` stays the source of truth for the domain shapes, so each schema is
 * written to produce the matching core type (branded numbers are re-branded with
 * the core constructors) and is verified against it by the `*.test-d.ts` tests.
 */

/** Wire schema for core `Millis`. */
export const millisSchema = z.number().transform((value) => toMillis(value));
/** Wire schema for core `Bytes`. */
export const bytesSchema = z.number().transform((value) => toBytes(value));
/** Wire schema for core `TabId`. */
export const tabIdSchema = z
  .number()
  .int()
  .transform((value) => toTabId(value));

export const consoleKindSchema = z.enum(['console', 'uncaught', 'rejection', 'csp', 'resource']);
export const consoleLevelSchema = z.enum(['log', 'info', 'warn', 'error', 'debug', 'trace']);

/** Recursive wire schema for core `SerializedValue`. */
export const serializedValueSchema: z.ZodType<SerializedValue> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('string'), value: z.string() }),
    z.object({ type: z.literal('number'), value: z.number() }),
    z.object({ type: z.literal('boolean'), value: z.boolean() }),
    z.object({ type: z.literal('null') }),
    z.object({ type: z.literal('undefined') }),
    z.object({ type: z.literal('bigint'), value: z.string() }),
    z.object({ type: z.literal('symbol'), value: z.string() }),
    z.object({ type: z.literal('function'), name: z.string() }),
    z.object({
      type: z.literal('error'),
      name: z.string(),
      message: z.string(),
      stack: z.string().optional(),
    }),
    z.object({ type: z.literal('node'), nodeName: z.string() }),
    z.object({
      type: z.literal('array'),
      items: z.array(serializedValueSchema),
      truncated: z.boolean(),
    }),
    z.object({
      type: z.literal('object'),
      entries: z.array(z.object({ key: z.string(), value: serializedValueSchema })),
      truncated: z.boolean(),
    }),
    z.object({
      type: z.literal('map'),
      entries: z.array(z.object({ key: serializedValueSchema, value: serializedValueSchema })),
      truncated: z.boolean(),
    }),
    z.object({
      type: z.literal('set'),
      items: z.array(serializedValueSchema),
      truncated: z.boolean(),
    }),
    z.object({
      type: z.literal('typed-array'),
      kind: z.string(),
      length: z.number().int().nonnegative(),
      preview: z.array(z.string()),
      truncated: z.boolean(),
    }),
    z.object({ type: z.literal('date'), iso: z.string() }),
    z.object({ type: z.literal('regexp'), source: z.string(), flags: z.string() }),
    z.object({ type: z.literal('circular'), reference: z.string() }),
    z.object({ type: z.literal('unserializable'), reason: z.string() }),
  ]),
);

/** Wire schema for core `ConsoleEntry`. */
export const consoleEntrySchema = z.object({
  id: z.string().min(1),
  kind: consoleKindSchema,
  level: consoleLevelSchema,
  timestamp: millisSchema,
  args: z.array(serializedValueSchema).readonly(),
  stack: z.string().exactOptional(),
  count: z.number().int().nonnegative(),
});

/** Wire schema for core `NetworkTiming`. */
export const networkTimingSchema = z.object({
  dns: millisSchema,
  connect: millisSchema,
  tls: millisSchema,
  ttfb: millisSchema,
  download: millisSchema,
  total: millisSchema,
});

export const redactedHeaderValueSchema = z.union([z.string(), z.array(z.string()).readonly()]);
export const redactedHeadersSchema = z.record(z.string(), redactedHeaderValueSchema);

/** Wire schema for core `NetworkEntry`. */
/** Wire schema for core `WebSocketMeta`. */
export const webSocketMetaSchema = z.object({
  opened: z.boolean(),
  closed: z.boolean(),
  code: z.number().int().exactOptional(),
});

/** Wire schema for core `NetworkMeta` (all fields optional, as in core). */
export const networkMetaSchema = z.object({
  redirected: z.boolean().exactOptional(),
  finalUrl: z.string().exactOptional(),
  initiatorType: z.string().exactOptional(),
  simulatedLatencyMs: z.number().exactOptional(),
  webSocket: webSocketMetaSchema.exactOptional(),
});

export const networkEntrySchema = z.object({
  id: z.string().min(1),
  method: z.string().min(1),
  url: z.string(),
  status: z.number().int().nullable(),
  resourceType: z.string(),
  transferSize: bytesSchema,
  decodedSize: bytesSchema,
  fromCache: z.boolean(),
  timing: networkTimingSchema,
  startedAt: millisSchema.exactOptional(),
  failure: z.string().exactOptional(),
  headers: redactedHeadersSchema.exactOptional(),
  bodyPreview: z.string().exactOptional(),
  meta: networkMetaSchema.exactOptional(),
});

export const vitalNameSchema = z.enum(['LCP', 'CLS', 'INP', 'FCP', 'TTFB']);
export const vitalRatingSchema = z.enum(['good', 'needs-improvement', 'poor']);

/** Wire schema for core `VitalMetric`. */
export const vitalMetricSchema = z.discriminatedUnion('name', [
  z.object({
    name: z.literal('LCP'),
    value: z.number(),
    rating: vitalRatingSchema,
    element: z.string().exactOptional(),
  }),
  z.object({
    name: z.literal('CLS'),
    value: z.number(),
    rating: vitalRatingSchema,
    shiftedNodes: z.array(z.string()).readonly().exactOptional(),
  }),
  z.object({
    name: z.literal('INP'),
    value: z.number(),
    rating: vitalRatingSchema,
    interactionTarget: z.string().exactOptional(),
  }),
  z.object({ name: z.literal('FCP'), value: z.number(), rating: vitalRatingSchema }),
  z.object({ name: z.literal('TTFB'), value: z.number(), rating: vitalRatingSchema }),
]);

/** Wire schema for core `LongTask`. */
export const longTaskSchema = z.object({
  startTime: millisSchema,
  duration: millisSchema,
  name: z.string().exactOptional(),
  blockingDuration: millisSchema.exactOptional(),
});

export const storageAreaSchema = z.enum([
  'cookies',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'cacheStorage',
  'serviceWorkers',
]);

export const storageAreaUsageSchema = z.object({
  area: storageAreaSchema,
  count: z.number().int().nonnegative(),
  approximateSize: bytesSchema,
});

/** Wire schema for core `StorageSummary`. */
export const storageSummarySchema = z.object({
  areas: z.array(storageAreaUsageSchema).readonly(),
});

/**
 * Wire schema for one core `CaptureEvent`. The discriminant is `channel`; every
 * variant carries the core domain payload plus the capture timestamp. It mirrors
 * the `CaptureEvent` union in `core/domain/capture-event.ts` (verified by
 * `payloads.test-d.ts`), so there is a single source of truth for the shapes.
 */
export const captureEventSchema = z.discriminatedUnion('channel', [
  z.object({ at: millisSchema, channel: z.literal('console'), entry: consoleEntrySchema }),
  z.object({ at: millisSchema, channel: z.literal('network'), entry: networkEntrySchema }),
  z.object({
    at: millisSchema,
    channel: z.literal('performance'),
    vitals: z.array(vitalMetricSchema).readonly(),
    longTasks: z.array(longTaskSchema).readonly(),
  }),
  z.object({ at: millisSchema, channel: z.literal('storage'), summary: storageSummarySchema }),
]);

/**
 * Wire schema for one `event.batch`: a typed batch of capture events with a
 * monotonic sequence and the pipeline's cumulative dropped count. A batch above
 * {@link MAX_BATCH_EVENTS} is rejected at the trust boundary (PRD 7).
 */
export const captureBatchSchema = z.object({
  sequence: z.number().int().nonnegative(),
  dropped: z.number().int().nonnegative(),
  events: z.array(captureEventSchema).max(MAX_BATCH_EVENTS).readonly(),
});

/** Wire schema for core `PageSnapshot`. */
export const pageSnapshotSchema = z.object({
  tabId: tabIdSchema,
  url: z.string(),
  capturedAt: millisSchema,
  console: z.array(consoleEntrySchema).readonly(),
  network: z.array(networkEntrySchema).readonly(),
  vitals: z.array(vitalMetricSchema).readonly(),
  longTasks: z.array(longTaskSchema).readonly(),
  storage: storageSummarySchema,
});

export const clearStoragePresetSchema = z.enum(['fresh-visitor', 'clear-everything-and-reload']);
export const throttleProfileSchema = z.enum(['offline', 'slow-3g', 'fast-3g', '4g', 'custom']);
export const exportFormatSchema = z.enum(['markdown', 'json', 'har']);
