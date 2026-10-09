import { z } from 'zod';
import { protocolErrorSchema } from './errors';
import {
  clearStoragePresetSchema,
  consoleEntrySchema,
  exportFormatSchema,
  longTaskSchema,
  networkEntrySchema,
  pageSnapshotSchema,
  storageSummarySchema,
  throttleProfileSchema,
  vitalMetricSchema,
} from './payloads';

/** Builds a message envelope around a payload schema. */
function envelope<TType extends string, TPayload extends z.ZodType>(
  type: TType,
  payload: TPayload,
) {
  return z.object({
    type: z.literal(type),
    version: z.number().int(),
    correlationId: z.string().min(1),
    payload,
  });
}

// --- Events -----------------------------------------------------------------

const consoleEventSchema = envelope('event.console', consoleEntrySchema);
const networkEventSchema = envelope('event.network', networkEntrySchema);
const performanceEventSchema = envelope(
  'event.performance',
  z.object({
    vitals: z.array(vitalMetricSchema),
    longTasks: z.array(longTaskSchema),
  }),
);
const storageEventSchema = envelope('event.storage', storageSummarySchema);

const eventMessageSchemas = [
  consoleEventSchema,
  networkEventSchema,
  performanceEventSchema,
  storageEventSchema,
] as const;

/** Every event message (PRD 8.2). */
export const eventMessageSchema = z.discriminatedUnion('type', eventMessageSchemas);

// --- Commands ---------------------------------------------------------------

const clearStorageCommandSchema = envelope(
  'command.clearStorage',
  z.object({ preset: clearStoragePresetSchema }),
);
const hardReloadCommandSchema = envelope('command.hardReload', z.object({}));
const setThrottleCommandSchema = envelope(
  'command.setThrottle',
  z.object({ profile: throttleProfileSchema }),
);
const toggleDisableCacheCommandSchema = envelope(
  'command.toggleDisableCache',
  z.object({ enabled: z.boolean() }),
);
const getSnapshotCommandSchema = envelope('command.getSnapshot', z.object({}));
const exportReportCommandSchema = envelope(
  'command.exportReport',
  z.object({ format: exportFormatSchema }),
);
const pingCommandSchema = envelope('command.ping', z.object({}));

const commandMessageSchemas = [
  clearStorageCommandSchema,
  hardReloadCommandSchema,
  setThrottleCommandSchema,
  toggleDisableCacheCommandSchema,
  getSnapshotCommandSchema,
  exportReportCommandSchema,
  pingCommandSchema,
] as const;

/** Every command message (PRD 8.2). */
export const commandMessageSchema = z.discriminatedUnion('type', commandMessageSchemas);

// --- Results ----------------------------------------------------------------

const clearStorageResultSchema = envelope(
  'result.clearStorage',
  z.object({ preset: clearStoragePresetSchema, cleared: z.boolean() }),
);
const hardReloadResultSchema = envelope('result.hardReload', z.object({ reloaded: z.boolean() }));
const setThrottleResultSchema = envelope(
  'result.setThrottle',
  z.object({ profile: throttleProfileSchema }),
);
const toggleDisableCacheResultSchema = envelope(
  'result.toggleDisableCache',
  z.object({ enabled: z.boolean() }),
);
const getSnapshotResultSchema = envelope('result.getSnapshot', pageSnapshotSchema);
const exportReportResultSchema = envelope(
  'result.exportReport',
  z.object({ format: exportFormatSchema, filename: z.string() }),
);
const pingResultSchema = envelope('result.ping', z.object({ pong: z.boolean() }));

const resultMessageSchemas = [
  clearStorageResultSchema,
  hardReloadResultSchema,
  setThrottleResultSchema,
  toggleDisableCacheResultSchema,
  getSnapshotResultSchema,
  exportReportResultSchema,
  pingResultSchema,
] as const;

/** Every command result message (PRD 8.2). */
export const resultMessageSchema = z.discriminatedUnion('type', resultMessageSchemas);

// --- Errors -----------------------------------------------------------------

/** The single error message shape. */
export const errorMessageSchema = envelope('error', protocolErrorSchema);

// --- Combined ---------------------------------------------------------------

/** Any protocol message. */
export const protocolMessageSchema = z.union([
  eventMessageSchema,
  commandMessageSchema,
  resultMessageSchema,
  errorMessageSchema,
]);

export type ProtocolMessage = z.infer<typeof protocolMessageSchema>;
export type EventMessage = z.infer<typeof eventMessageSchema>;
export type CommandMessage = z.infer<typeof commandMessageSchema>;
export type ResultMessage = z.infer<typeof resultMessageSchema>;
export type ErrorMessage = z.infer<typeof errorMessageSchema>;

const EVENT_TYPES = [
  'event.console',
  'event.network',
  'event.performance',
  'event.storage',
] as const;
const COMMAND_TYPES = [
  'command.clearStorage',
  'command.hardReload',
  'command.setThrottle',
  'command.toggleDisableCache',
  'command.getSnapshot',
  'command.exportReport',
  'command.ping',
] as const;
const RESULT_TYPES = [
  'result.clearStorage',
  'result.hardReload',
  'result.setThrottle',
  'result.toggleDisableCache',
  'result.getSnapshot',
  'result.exportReport',
  'result.ping',
] as const;

export const EVENT_MESSAGE_TYPES: ReadonlySet<string> = new Set(EVENT_TYPES);
export const COMMAND_MESSAGE_TYPES: ReadonlySet<string> = new Set(COMMAND_TYPES);
export const RESULT_MESSAGE_TYPES: ReadonlySet<string> = new Set(RESULT_TYPES);
export const ALL_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  ...EVENT_TYPES,
  ...COMMAND_TYPES,
  ...RESULT_TYPES,
  'error',
]);

/** Distributes `Omit` across a union so each command keeps its own payload. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A command as supplied by a caller: type and payload only. */
export type CommandInput = DistributiveOmit<CommandMessage, 'version' | 'correlationId'>;
