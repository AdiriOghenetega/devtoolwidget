import { describe, expect, it } from 'vitest';
import { parseCommand, parseEvent, parseMessage, parseResult } from './parse';
import { PROTOCOL_VERSION } from './version';

const consoleEvent = {
  type: 'event.console',
  version: PROTOCOL_VERSION,
  correlationId: 'c1',
  payload: {
    id: 'id1',
    kind: 'uncaught',
    level: 'error',
    timestamp: 10,
    args: [{ type: 'string', value: 'boom' }],
    count: 1,
  },
};

describe('parseMessage', () => {
  it('parses a valid event and re-brands numbers', () => {
    const result = parseMessage(consoleEvent);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'event.console') {
      expect(result.value.payload.kind).toBe('uncaught');
      expect(result.value.payload.timestamp).toBe(10);
    }
  });

  it('parses a valid command', () => {
    const result = parseCommand({
      type: 'command.setThrottle',
      version: PROTOCOL_VERSION,
      correlationId: 'c2',
      payload: { profile: 'slow-3g' },
    });
    expect(result.ok).toBe(true);
  });

  it('parses a valid result', () => {
    const result = parseResult({
      type: 'result.hardReload',
      version: PROTOCOL_VERSION,
      correlationId: 'c3',
      payload: { reloaded: true },
    });
    expect(result.ok).toBe(true);
  });

  it('returns invalid-message for values that are not envelopes', () => {
    for (const invalid of [null, undefined, 42, 'nope', {}, { type: 'event.console' }]) {
      const result = parseMessage(invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('invalid-message');
      }
    }
  });

  it('returns unknown-type for an unrecognised message type', () => {
    const result = parseMessage({
      type: 'event.unknown',
      version: PROTOCOL_VERSION,
      correlationId: 'c4',
      payload: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unknown-type');
    }
  });

  it('returns version-mismatch for a different protocol version', () => {
    const result = parseMessage({ ...consoleEvent, version: PROTOCOL_VERSION + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('version-mismatch');
      expect(result.error.details).toContain(
        `this build speaks version ${String(PROTOCOL_VERSION)}`,
      );
    }
  });

  it('returns invalid-payload for a malformed payload', () => {
    const result = parseMessage({
      ...consoleEvent,
      payload: { ...consoleEvent.payload, id: '' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-payload');
    }
  });

  it('rejects a command passed to parseEvent', () => {
    const result = parseEvent({
      type: 'command.hardReload',
      version: PROTOCOL_VERSION,
      correlationId: 'c5',
      payload: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unknown-type');
    }
  });

  it('never throws on hostile input', () => {
    const values = [Symbol('x'), 10n, () => 1, Number.NaN, [1, 2, 3]];
    for (const value of values) {
      expect(() => parseMessage(value)).not.toThrow();
    }
  });
});
