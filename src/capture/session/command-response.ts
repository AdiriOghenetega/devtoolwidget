import { protocolErrorCodeSchema, type ErrorMessage, type ProtocolError } from '../../protocol';
import { PROTOCOL_VERSION, type ResultMessage } from '../../protocol';
import { type Result } from '../../core';
import type { PlatformError } from '../../platform/ports';

/** Narrows a platform error code to one the wire protocol understands. */
function isProtocolErrorCode(value: string): value is ProtocolError['code'] {
  return protocolErrorCodeSchema.safeParse(value).success;
}

/**
 * Maps a platform failure onto the wire protocol error so a command reply always
 * has a single, schema-valid envelope (integration gap G8). Codes the protocol
 * shares with the platform are preserved; any other platform code becomes
 * `internal` with the original code kept in `details` so nothing is lost.
 */
export function toProtocolError(error: PlatformError): ProtocolError {
  if (isProtocolErrorCode(error.code)) {
    return { code: error.code, message: error.message };
  }
  return { code: 'internal', message: error.message, details: [`platform:${error.code}`] };
}

/**
 * Builds the reply to a command: the typed result on success, or the error
 * message on failure. The service worker sends exactly this and the content
 * script parses it with `parseCommandResponse`, so the two ends agree (G8).
 */
export function toCommandResponse(
  correlationId: string,
  outcome: Result<ResultMessage, PlatformError>,
): ResultMessage | ErrorMessage {
  if (outcome.ok) {
    return outcome.value;
  }
  return {
    type: 'error',
    version: PROTOCOL_VERSION,
    correlationId,
    payload: toProtocolError(outcome.error),
  };
}
