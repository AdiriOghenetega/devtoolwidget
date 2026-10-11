import {
  BRIDGE_ACK_MESSAGE,
  BRIDGE_CHANNEL,
  BRIDGE_COMMIT_MESSAGE,
  DEFAULT_NONCE_BYTES,
  HANDSHAKE_MESSAGE,
  type Result,
} from '../../core';
import type { PlatformError } from '../../platform/ports/errors';
import type { AckMessage, CommitMessage, HandshakeMessage } from '../../protocol';
import { nonceField, parseWith, stringValue, type MessageSpec } from './validate';

export {
  BRIDGE_ACK_MESSAGE,
  BRIDGE_CHANNEL,
  BRIDGE_COMMIT_MESSAGE,
  DEFAULT_NONCE_BYTES,
  HANDSHAKE_MESSAGE,
};

/**
 * Hand-written, strict guards for the three bootstrap messages (ADR 0018), built
 * from the shared table in `validate.ts`. They are typed against the `z.infer`
 * types of the source-of-truth schemas in `protocol/bridge.ts` and never throw.
 * `handshake.test.ts` asserts they always agree with those schemas.
 */
const handshakeSpec: MessageSpec<HandshakeMessage> = {
  message: HANDSHAKE_MESSAGE,
  label: 'handshake',
  fields: { nonce: nonceField },
  build: (data) => ({
    channel: BRIDGE_CHANNEL,
    message: HANDSHAKE_MESSAGE,
    nonce: stringValue(data, 'nonce'),
  }),
};

const ackSpec: MessageSpec<AckMessage> = {
  message: BRIDGE_ACK_MESSAGE,
  label: 'ack',
  fields: { nonce: nonceField },
  build: (data) => ({
    channel: BRIDGE_CHANNEL,
    message: BRIDGE_ACK_MESSAGE,
    nonce: stringValue(data, 'nonce'),
  }),
};

const commitSpec: MessageSpec<CommitMessage> = {
  message: BRIDGE_COMMIT_MESSAGE,
  label: 'commit',
  fields: { nonce: nonceField },
  build: (data) => ({
    channel: BRIDGE_CHANNEL,
    message: BRIDGE_COMMIT_MESSAGE,
    nonce: stringValue(data, 'nonce'),
  }),
};

/** Validates untrusted window data as a handshake. Never throws. */
export function parseHandshake(data: unknown): Result<HandshakeMessage, PlatformError> {
  return parseWith(handshakeSpec, data);
}

/** Validates untrusted window data as an ack. Never throws. */
export function parseAck(data: unknown): Result<AckMessage, PlatformError> {
  return parseWith(ackSpec, data);
}

/** Validates untrusted port data as a commit. Never throws. */
export function parseCommit(data: unknown): Result<CommitMessage, PlatformError> {
  return parseWith(commitSpec, data);
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
