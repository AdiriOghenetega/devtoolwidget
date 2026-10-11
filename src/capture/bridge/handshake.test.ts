import { describe, expect, it } from 'vitest';
import {
  BRIDGE_ACK_MESSAGE,
  BRIDGE_CHANNEL,
  BRIDGE_COMMIT_MESSAGE,
  HANDSHAKE_MESSAGE,
} from '../../core';
import { ackSchema, commitSchema, handshakeSchema } from '../../protocol';
import { parseAck, parseCommit, parseHandshake } from './handshake';

interface Case {
  readonly name: string;
  readonly value: unknown;
}

const channel = BRIDGE_CHANNEL;

/** A shared corpus: valid, invalid and adversarial shapes for all three messages. */
const CORPUS: readonly Case[] = [
  { name: 'valid handshake', value: { channel, message: HANDSHAKE_MESSAGE, nonce: 'abcdef' } },
  { name: 'valid ack', value: { channel, message: BRIDGE_ACK_MESSAGE, nonce: 'abcdef' } },
  { name: 'valid commit', value: { channel, message: BRIDGE_COMMIT_MESSAGE, nonce: 'abcdef' } },
  { name: 'empty nonce', value: { channel, message: HANDSHAKE_MESSAGE, nonce: '' } },
  {
    name: 'nonce at the length cap',
    value: { channel, message: HANDSHAKE_MESSAGE, nonce: 'a'.repeat(128) },
  },
  {
    name: 'nonce over the length cap',
    value: { channel, message: HANDSHAKE_MESSAGE, nonce: 'a'.repeat(129) },
  },
  { name: 'huge nonce', value: { channel, message: HANDSHAKE_MESSAGE, nonce: 'a'.repeat(1e6) } },
  { name: 'numeric nonce', value: { channel, message: HANDSHAKE_MESSAGE, nonce: 12 } },
  { name: 'missing nonce', value: { channel, message: HANDSHAKE_MESSAGE } },
  { name: 'wrong channel', value: { channel: 'nope', message: HANDSHAKE_MESSAGE, nonce: 'a' } },
  { name: 'wrong message name', value: { channel, message: 'nope', nonce: 'a' } },
  {
    name: 'extra key',
    value: { channel, message: HANDSHAKE_MESSAGE, nonce: 'a', extra: true },
  },
  { name: 'missing message', value: { channel, nonce: 'a' } },
  {
    name: 'mismatched kind (ack payload for handshake)',
    value: { channel, message: BRIDGE_ACK_MESSAGE, nonce: 'a' },
  },
  { name: 'null', value: null },
  { name: 'undefined', value: undefined },
  { name: 'array', value: [channel, HANDSHAKE_MESSAGE, 'a'] },
  { name: 'string', value: `${channel}:${HANDSHAKE_MESSAGE}:a` },
  { name: 'number', value: 42 },
  {
    name: 'nested nonce object',
    value: { channel, message: HANDSHAKE_MESSAGE, nonce: { toString: () => 'a' } },
  },
];

/** Shapes with dangerous prototypes must be treated the same by both. */
function prototypePollutionShapes(): readonly Case[] {
  const inherited = Object.create({ channel, message: HANDSHAKE_MESSAGE, nonce: 'a' }) as object;
  const protoBomb: unknown = JSON.parse(
    '{"channel":"x","message":"y","nonce":"z","__proto__":{"polluted":true}}',
  );
  return [
    { name: 'inherited channel (not own)', value: inherited },
    { name: 'proto pollution payload', value: protoBomb },
  ];
}

function schemaAccepts(
  schema: { safeParse(input: unknown): { success: boolean } },
  value: unknown,
): boolean {
  return schema.safeParse(value).success;
}

describe('bridge hand-written guards agree with the Zod schemas', () => {
  const cases = [...CORPUS, ...prototypePollutionShapes()];

  it.each(cases)('$name: handshake', ({ value }) => {
    expect(parseHandshake(value).ok).toBe(schemaAccepts(handshakeSchema, value));
  });

  it.each(cases)('$name: ack', ({ value }) => {
    expect(parseAck(value).ok).toBe(schemaAccepts(ackSchema, value));
  });

  it.each(cases)('$name: commit', ({ value }) => {
    expect(parseCommit(value).ok).toBe(schemaAccepts(commitSchema, value));
  });

  it('never throws on hostile input', () => {
    for (const fuzz of [Symbol('x'), 10n, () => undefined, Number.NaN]) {
      expect(() => parseHandshake(fuzz)).not.toThrow();
      expect(() => parseAck(fuzz)).not.toThrow();
      expect(() => parseCommit(fuzz)).not.toThrow();
    }
  });
});
