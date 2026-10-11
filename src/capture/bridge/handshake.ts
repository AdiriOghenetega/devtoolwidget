import {
  BRIDGE_ACK_MESSAGE,
  BRIDGE_CHANNEL,
  BRIDGE_COMMIT_MESSAGE,
  DEFAULT_NONCE_BYTES,
  HANDSHAKE_MESSAGE,
  MAX_BRIDGE_NONCE_LENGTH,
  err,
  ok,
  type Result,
} from '../../core';
import { platformError, type PlatformError } from '../../platform/ports/errors';
import type { AckMessage, CommitMessage, HandshakeMessage } from '../../protocol';

/**
 * Hand-written, strict guards for the three bridge bootstrap messages (ADR 0018).
 *
 * These messages are the only cross-context inputs the page-world agent sees, and
 * its bundle budget forbids importing Zod. The guards are typed against the
 * `z.infer` types of the source-of-truth schemas in `protocol/bridge.ts`, are
 * strict (exact expected keys, primitive types, nonce length limits), and never
 * throw. `capture/bridge/handshake.test.ts` asserts they always agree with those
 * schemas over a shared corpus.
 */
export {
  BRIDGE_ACK_MESSAGE,
  BRIDGE_CHANNEL,
  BRIDGE_COMMIT_MESSAGE,
  DEFAULT_NONCE_BYTES,
  HANDSHAKE_MESSAGE,
};

/** True when `value` is a non-array object with no unknown own enumerable keys. */
function isStrictRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  for (const key of Object.keys(value)) {
    if (key !== 'channel' && key !== 'message' && key !== 'nonce') {
      return false;
    }
  }
  return true;
}

/** True when `value` is a valid nonce: a non-empty string within the length cap. */
function isNonce(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= MAX_BRIDGE_NONCE_LENGTH;
}

function guard<TMessage>(
  data: unknown,
  message: string,
  label: string,
): Result<TMessage, PlatformError> {
  if (!isStrictRecord(data)) {
    return err(platformError('invalid-data', `Not a bridge ${label}`));
  }
  if (data.channel !== BRIDGE_CHANNEL || data.message !== message || !isNonce(data.nonce)) {
    return err(platformError('invalid-data', `Not a bridge ${label}`));
  }
  return ok({ channel: BRIDGE_CHANNEL, message, nonce: data.nonce } as TMessage);
}

/** Validates untrusted window data as a handshake. Never throws. */
export function parseHandshake(data: unknown): Result<HandshakeMessage, PlatformError> {
  return guard<HandshakeMessage>(data, HANDSHAKE_MESSAGE, 'handshake');
}

/** Validates untrusted window data as an ack. Never throws. */
export function parseAck(data: unknown): Result<AckMessage, PlatformError> {
  return guard<AckMessage>(data, BRIDGE_ACK_MESSAGE, 'ack');
}

/** Validates untrusted port data as a commit. Never throws. */
export function parseCommit(data: unknown): Result<CommitMessage, PlatformError> {
  return guard<CommitMessage>(data, BRIDGE_COMMIT_MESSAGE, 'commit');
}

/** Builds a handshake message for the given nonce. */
export function createHandshake(nonce: string): HandshakeMessage {
  return { channel: BRIDGE_CHANNEL, message: HANDSHAKE_MESSAGE, nonce };
}

/** Builds an acknowledgement message for the given nonce. */
export function createAck(nonce: string): AckMessage {
  return { channel: BRIDGE_CHANNEL, message: BRIDGE_ACK_MESSAGE, nonce };
}

/** Builds a commit message for the given nonce. */
export function createCommit(nonce: string): CommitMessage {
  return { channel: BRIDGE_CHANNEL, message: BRIDGE_COMMIT_MESSAGE, nonce };
}

/** Generates a nonce from injected randomness (hex, `bytes` bytes). */
export function createNonce(random: () => number, bytes = DEFAULT_NONCE_BYTES): string {
  let out = '';
  for (let index = 0; index < bytes; index += 1) {
    out += Math.floor(random() * 256)
      .toString(16)
      .padStart(2, '0');
  }
  return out;
}
