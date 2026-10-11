import { describe, expect, it } from 'vitest';
import { toMillis, toTabId } from '../../core';
import { platformError } from '../../platform/ports/errors';
import {
  PROTOCOL_VERSION,
  parseCommand,
  parseCommandResponse,
  type CommandInput,
  type ResultMessage,
} from '../../protocol';
import { toCommandResponse, toProtocolError } from './command-response';

const wireSnapshot = {
  tabId: toTabId(1),
  url: 'https://example.com',
  capturedAt: toMillis(1_000),
  console: [],
  network: [],
  vitals: [],
  longTasks: [],
  storage: { areas: [] },
};

/** One representative request/result pair per command, so the contract covers all. */
const CASES: readonly { readonly input: CommandInput; readonly result: ResultMessage }[] = [
  {
    input: { type: 'command.ping', payload: {} },
    result: {
      type: 'result.ping',
      version: PROTOCOL_VERSION,
      correlationId: 'c1',
      payload: { pong: true },
    },
  },
  {
    input: { type: 'command.hardReload', payload: {} },
    result: {
      type: 'result.hardReload',
      version: PROTOCOL_VERSION,
      correlationId: 'c1',
      payload: { reloaded: true },
    },
  },
  {
    input: { type: 'command.setThrottle', payload: { profile: 'slow-3g' } },
    result: {
      type: 'result.setThrottle',
      version: PROTOCOL_VERSION,
      correlationId: 'c1',
      payload: { profile: 'slow-3g' },
    },
  },
  {
    input: { type: 'command.toggleDisableCache', payload: { enabled: true } },
    result: {
      type: 'result.toggleDisableCache',
      version: PROTOCOL_VERSION,
      correlationId: 'c1',
      payload: { enabled: true },
    },
  },
  {
    input: { type: 'command.clearStorage', payload: { preset: 'fresh-visitor' } },
    result: {
      type: 'result.clearStorage',
      version: PROTOCOL_VERSION,
      correlationId: 'c1',
      payload: { preset: 'fresh-visitor', cleared: true },
    },
  },
  {
    input: { type: 'command.getSnapshot', payload: {} },
    result: {
      type: 'result.getSnapshot',
      version: PROTOCOL_VERSION,
      correlationId: 'c1',
      payload: wireSnapshot,
    },
  },
  {
    input: { type: 'command.exportReport', payload: { format: 'json' } },
    result: {
      type: 'result.exportReport',
      version: PROTOCOL_VERSION,
      correlationId: 'c1',
      payload: { format: 'json', filename: 'report.json' },
    },
  },
];

describe('command response contract (integration gap G8)', () => {
  it('parses every command request through the real schema', () => {
    for (const testCase of CASES) {
      const parsed = parseCommand({
        ...testCase.input,
        version: PROTOCOL_VERSION,
        correlationId: 'c1',
      });
      expect(parsed.ok).toBe(true);
    }
  });

  it('parses every command result through parseCommandResponse', () => {
    for (const testCase of CASES) {
      const parsed = parseCommandResponse(testCase.result);
      expect(parsed.ok).toBe(true);
    }
  });

  it('parses an error envelope through parseCommandResponse', () => {
    const parsed = parseCommandResponse({
      type: 'error',
      version: PROTOCOL_VERSION,
      correlationId: 'c1',
      payload: { code: 'unsupported', message: 'not available' },
    });
    expect(parsed.ok).toBe(true);
  });

  it('round-trips both a success and a failure outcome', () => {
    for (const testCase of CASES) {
      const success = toCommandResponse('c1', { ok: true, value: testCase.result });
      expect(parseCommandResponse(success).ok).toBe(true);

      const failure = toCommandResponse('c1', {
        ok: false,
        error: platformError('unsupported', 'nope'),
      });
      const parsed = parseCommandResponse(failure);
      expect(parsed.ok).toBe(true);
      if (parsed.ok && parsed.value.type === 'error') {
        expect(parsed.value.payload.code).toBe('unsupported');
      }
    }
  });

  it('preserves shared error codes and wraps platform-only codes', () => {
    expect(toProtocolError(platformError('timeout', 't')).code).toBe('timeout');
    expect(toProtocolError(platformError('unsupported', 'u')).code).toBe('unsupported');

    const wrapped = toProtocolError(platformError('not-found', 'missing'));
    expect(wrapped.code).toBe('internal');
    expect(wrapped.details).toContain('platform:not-found');
  });
});
