import { z } from 'zod';
import { agentConfigPayloadSchema } from './bridge';
import { protocolErrorSchema } from './errors';
import {
  captureBatchSchema,
  captureEventSchema,
  clearStoragePresetSchema,
  exportFormatSchema,
  pageSnapshotSchema,
  throttleProfileSchema,
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

const eventBatchMessageSchema = envelope('event.batch', captureBatchSchema);

/** The capture event message: one typed batch of capture events (PRD 8.2, 8.4). */
export const eventMessageSchema = eventBatchMessageSchema;

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
const grantAccessCommandSchema = envelope(
  'command.grantAccess',
  z.object({ origin: z.string().exactOptional() }),
);
const revokeAccessCommandSchema = envelope(
  'command.revokeAccess',
  z.object({ origin: z.string().exactOptional() }),
);

const commandMessageSchemas = [
  clearStorageCommandSchema,
  hardReloadCommandSchema,
  setThrottleCommandSchema,
  toggleDisableCacheCommandSchema,
  getSnapshotCommandSchema,
  exportReportCommandSchema,
  pingCommandSchema,
  grantAccessCommandSchema,
  revokeAccessCommandSchema,
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
  z.object({ format: exportFormatSchema, filename: z.string(), content: z.string() }),
);
const pingResultSchema = envelope('result.ping', z.object({ pong: z.boolean() }));
const grantAccessResultSchema = envelope(
  'result.grantAccess',
  z.object({ origin: z.string(), status: z.enum(['granted', 'already-granted', 'denied']) }),
);
const revokeAccessResultSchema = envelope(
  'result.revokeAccess',
  z.object({ origin: z.string(), revoked: z.boolean() }),
);

const resultMessageSchemas = [
  clearStorageResultSchema,
  hardReloadResultSchema,
  setThrottleResultSchema,
  toggleDisableCacheResultSchema,
  getSnapshotResultSchema,
  exportReportResultSchema,
  pingResultSchema,
  grantAccessResultSchema,
  revokeAccessResultSchema,
] as const;

/** Every command result message (PRD 8.2). */
export const resultMessageSchema = z.discriminatedUnion('type', resultMessageSchemas);

// --- Errors -----------------------------------------------------------------

/** The single error message shape. */
export const errorMessageSchema = envelope('error', protocolErrorSchema);

// --- Panel push -------------------------------------------------------------

/**
 * Messages the service worker pushes to an open panel over its long-lived port:
 * one full snapshot when the panel opens, then one delta per capture event
 * (PRD 8.4, snapshot then deltas). Validated on receipt like every other
 * cross-context message.
 */
export const panelMessageSchema = z.discriminatedUnion('type', [
  envelope('panel.snapshot', pageSnapshotSchema),
  envelope('panel.delta', captureEventSchema),
  envelope('panel.agentConfig', agentConfigPayloadSchema),
]);

/** A panel push message. */
export type PanelMessage = z.infer<typeof panelMessageSchema>;

// --- Command responses ------------------------------------------------------

/**
 * The reply to a command: a typed result, or the `error` message when the
 * command failed. The service worker and the content script share this single
 * envelope so a reply can never be written in one shape and read in another
 * (integration gap G8).
 */
export const commandResponseSchema = z.union([resultMessageSchema, errorMessageSchema]);

/** A command reply: a result on success, an error on failure. */
export type CommandResponse = z.infer<typeof commandResponseSchema>;

// --- Combined ---------------------------------------------------------------

/** Any protocol message. */
export const protocolMessageSchema = z.union([
  eventMessageSchema,
  commandMessageSchema,
  resultMessageSchema,
  errorMessageSchema,
  panelMessageSchema,
]);

export type ProtocolMessage = z.infer<typeof protocolMessageSchema>;
export type EventMessage = z.infer<typeof eventMessageSchema>;
export type CommandMessage = z.infer<typeof commandMessageSchema>;
export type ResultMessage = z.infer<typeof resultMessageSchema>;
export type ErrorMessage = z.infer<typeof errorMessageSchema>;

const EVENT_TYPES = ['event.batch'] as const;
const COMMAND_TYPES = [
  'command.clearStorage',
  'command.hardReload',
  'command.setThrottle',
  'command.toggleDisableCache',
  'command.getSnapshot',
  'command.exportReport',
  'command.ping',
  'command.grantAccess',
  'command.revokeAccess',
] as const;
const RESULT_TYPES = [
  'result.clearStorage',
  'result.hardReload',
  'result.setThrottle',
  'result.toggleDisableCache',
  'result.getSnapshot',
  'result.exportReport',
  'result.ping',
  'result.grantAccess',
  'result.revokeAccess',
] as const;

export const EVENT_MESSAGE_TYPES: ReadonlySet<string> = new Set(EVENT_TYPES);
export const COMMAND_MESSAGE_TYPES: ReadonlySet<string> = new Set(COMMAND_TYPES);
export const RESULT_MESSAGE_TYPES: ReadonlySet<string> = new Set(RESULT_TYPES);
export const COMMAND_RESPONSE_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  ...RESULT_TYPES,
  'error',
]);
const PANEL_TYPES = ['panel.snapshot', 'panel.delta', 'panel.agentConfig'] as const;
export const PANEL_MESSAGE_TYPES: ReadonlySet<string> = new Set(PANEL_TYPES);
export const ALL_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  ...EVENT_TYPES,
  ...COMMAND_TYPES,
  ...RESULT_TYPES,
  ...PANEL_TYPES,
  'error',
]);

/** Distributes `Omit` across a union so each command keeps its own payload. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A command as supplied by a caller: type and payload only. */
export type CommandInput = DistributiveOmit<CommandMessage, 'version' | 'correlationId'>;
