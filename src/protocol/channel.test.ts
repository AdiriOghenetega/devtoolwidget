import { describe, expect, it } from 'vitest';
import { toBytes, toMillis, toTabId } from '../core';
import { createInMemoryChannelPair } from './channel';
import type { ProtocolMessage, ResultMessage } from './messages';
import { PROTOCOL_VERSION } from './version';

const snapshot = {
  tabId: toTabId(1),
  url: 'https://example.com',
  capturedAt: toMillis(1_000),
  console: [],
  network: [],
  vitals: [],
  longTasks: [],
  storage: { areas: [{ area: 'localStorage' as const, count: 1, approximateSize: toBytes(64) }] },
};

function getSnapshotResult(correlationId: string): ResultMessage {
  return {
    type: 'result.getSnapshot',
    version: PROTOCOL_VERSION,
    correlationId,
    payload: snapshot,
  };
}

function storageEvent(correlationId: string): ProtocolMessage {
  return {
    type: 'event.storage',
    version: PROTOCOL_VERSION,
    correlationId,
    payload: { areas: [] },
  };
}

describe('createInMemoryChannelPair', () => {
  it('delivers a sent message to the peer handler', () => {
    const [a, b] = createInMemoryChannelPair();
    const received: ProtocolMessage[] = [];
    a.on((message) => received.push(message));

    b.send(storageEvent('e1'));

    expect(received).toHaveLength(1);
    expect(received[0]?.type).toBe('event.storage');
  });

  it('resolves a request with the correlated result', async () => {
    const [a, b] = createInMemoryChannelPair({ createId: () => 'corr-1' });
    b.on((message) => {
      if (message.type === 'command.getSnapshot') {
        b.send(getSnapshotResult(message.correlationId));
      }
    });

    const result = await a.request({ type: 'command.getSnapshot', payload: {} });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe('result.getSnapshot');
      expect(result.value.correlationId).toBe('corr-1');
    }
  });

  it('ignores a response with a non-matching correlationId and times out', async () => {
    const [a, b] = createInMemoryChannelPair({ createId: () => 'corr-1' });
    b.on((message) => {
      if (message.type === 'command.hardReload') {
        b.send({
          type: 'result.hardReload',
          version: PROTOCOL_VERSION,
          correlationId: 'someone-else',
          payload: { reloaded: true },
        });
      }
    });

    const result = await a.request({ type: 'command.hardReload', payload: {} }, { timeoutMs: 20 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('timeout');
    }
  });

  it('resolves an error response as a failure', async () => {
    const [a, b] = createInMemoryChannelPair({ createId: () => 'corr-1' });
    b.on((message) => {
      if (message.type === 'command.exportReport') {
        b.send({
          type: 'error',
          version: PROTOCOL_VERSION,
          correlationId: message.correlationId,
          payload: { code: 'unsupported', message: 'not available' },
        });
      }
    });

    const result = await a.request(
      { type: 'command.exportReport', payload: { format: 'json' } },
      { timeoutMs: 50 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unsupported');
    }
  });

  it('times out when nothing responds', async () => {
    const [a] = createInMemoryChannelPair({ createId: () => 'corr-1' });

    const result = await a.request({ type: 'command.hardReload', payload: {} }, { timeoutMs: 10 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('timeout');
    }
  });

  it('stops delivering after unsubscribe', () => {
    const [a, b] = createInMemoryChannelPair();
    let count = 0;
    const unsubscribe = a.on(() => {
      count += 1;
    });

    b.send(storageEvent('e1'));
    unsubscribe();
    b.send(storageEvent('e2'));

    expect(count).toBe(1);
  });
});
