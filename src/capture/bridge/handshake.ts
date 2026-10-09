import { z } from 'zod';
import { err, ok, type Result } from '../../core';
import { platformError, type PlatformError } from '../../platform/ports/errors';

/** Namespace for bridge bootstrap messages (PRD section 7). */
export const BRIDGE_CHANNEL = 'devtoolwidget:bridge';
/** One-time handshake message name. */
export const HANDSHAKE_MESSAGE = 'handshake';
/** Agent acknowledgement sent back over the freshly adopted port. */
export const BRIDGE_ACK_MESSAGE = 'ack';
/** Nonce size in bytes. */
export const DEFAULT_NONCE_BYTES = 16;

/** The one-time handshake: carries the nonce the transferred port is bound to. */
export interface HandshakeMessage {
  readonly channel: typeof BRIDGE_CHANNEL;
  readonly message: typeof HANDSHAKE_MESSAGE;
  readonly nonce: string;
}

/** The agent's acknowledgement, echoing the nonce so the content script can verify. */
export interface AckMessage {
  readonly channel: typeof BRIDGE_CHANNEL;
  readonly message: typeof BRIDGE_ACK_MESSAGE;
  readonly nonce: string;
}

const handshakeSchema = z.object({
  channel: z.literal(BRIDGE_CHANNEL),
  message: z.literal(HANDSHAKE_MESSAGE),
  nonce: z.string().min(1),
});

const ackSchema = z.object({
  channel: z.literal(BRIDGE_CHANNEL),
  message: z.literal(BRIDGE_ACK_MESSAGE),
  nonce: z.string().min(1),
});

/** Validates untrusted window data as a handshake. Never throws. */
export function parseHandshake(data: unknown): Result<HandshakeMessage, PlatformError> {
  const parsed = handshakeSchema.safeParse(data);
  return parsed.success
    ? ok(parsed.data)
    : err(platformError('invalid-data', 'Not a bridge handshake'));
}

/** Validates untrusted window data as an ack. Never throws. */
export function parseAck(data: unknown): Result<AckMessage, PlatformError> {
  const parsed = ackSchema.safeParse(data);
  return parsed.success ? ok(parsed.data) : err(platformError('invalid-data', 'Not a bridge ack'));
}

/** Builds a handshake message for the given nonce. */
export function createHandshake(nonce: string): HandshakeMessage {
  return { channel: BRIDGE_CHANNEL, message: HANDSHAKE_MESSAGE, nonce };
}

/** Builds an acknowledgement message for the given nonce. */
export function createAck(nonce: string): AckMessage {
  return { channel: BRIDGE_CHANNEL, message: BRIDGE_ACK_MESSAGE, nonce };
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
