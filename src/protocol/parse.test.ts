import { describe, expect, it } from 'vitest';
import { MAX_BATCH_EVENTS } from '../core';
import { parseCommand, parseEvent, parseMessage, parseResult } from './parse';
import { PROTOCOL_VERSION } from './version';

const consoleEntry = {
  id: 'id1',
  kind: 'uncaught',
  level: 'error',
  timestamp: 10,
  args: [{ type: 'string', value: 'boom' }],
  count: 1,
};

const consoleEvent = {
  type: 'event.batch',
  version: PROTOCOL_VERSION,
  correlationId: 'c1',
  payload: {
    sequence: 0,
    dropped: 0,
    events: [{ at: 10, channel: 'console', entry: consoleEntry }],
  },
};

describe('parseMessage', () => {
  it('parses a valid event batch and re-brands numbers', () => {
    const result = parseMessage(consoleEvent);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'event.batch') {
      const first = result.value.payload.events[0];
      expect(first?.channel).toBe('console');
      if (first?.channel === 'console') {
        expect(first.entry.kind).toBe('uncaught');
        expect(first.entry.timestamp).toBe(10);
        expect(first.at).toBe(10);
      }
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
      payload: {
        ...consoleEvent.payload,
        events: [{ at: 10, channel: 'console', entry: { ...consoleEntry, id: '' } }],
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-payload');
    }
  });

  it('accepts a batch exactly at the wire size cap', () => {
    const events = Array.from({ length: MAX_BATCH_EVENTS }, (_, index) => ({
      at: index,
      channel: 'console',
      entry: { ...consoleEntry, id: `id-${String(index)}` },
    }));
    const result = parseEvent({
      type: 'event.batch',
      version: PROTOCOL_VERSION,
      correlationId: 'c7',
      payload: { sequence: 0, dropped: 0, events },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a batch above the wire size cap', () => {
    const events = Array.from({ length: MAX_BATCH_EVENTS + 1 }, (_, index) => ({
      at: index,
      channel: 'console',
      entry: { ...consoleEntry, id: `id-${String(index)}` },
    }));
    const result = parseEvent({
      type: 'event.batch',
      version: PROTOCOL_VERSION,
      correlationId: 'c8',
      payload: { sequence: 0, dropped: 0, events },
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
