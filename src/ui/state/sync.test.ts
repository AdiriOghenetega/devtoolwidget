import { describe, expect, it } from 'vitest';
import { aSnapshot, toMillis } from '../../core';
import { PROTOCOL_VERSION, type ProtocolMessage } from '../../protocol';
import { createInMemoryChannelPair } from '../../protocol';
import { createOverviewStore } from './stores';
import { startSync, synchronize } from './sync';

const snapshot = aSnapshot().network({ url: 'https://a.test/x', status: 500 }).build();
type SnapshotPayload = Extract<ProtocolMessage, { type: 'result.getSnapshot' }>['payload'];
const wireSnapshot = snapshot as unknown as SnapshotPayload;

function answerSnapshots(): ReturnType<typeof createInMemoryChannelPair> {
  const pair = createInMemoryChannelPair({ createId: () => 'c1' });
  const responder = pair[1];
  responder.on((message) => {
    if (message.type === 'command.getSnapshot') {
      responder.send({
        type: 'result.getSnapshot',
        version: PROTOCOL_VERSION,
        correlationId: message.correlationId,
        payload: wireSnapshot,
      });
    }
  });
  return pair;
}

async function flush(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('synchronize (snapshot then deltas)', () => {
  it('applies the snapshot and then live deltas', async () => {
    const [client, responder] = answerSnapshots();
    const store = createOverviewStore();
    const unsubscribe = startSync(store, client);

    await flush();
    expect(store.connection.value).toBe('connected');
    expect(store.networkCount.value).toBe(1);

    responder.send({
      type: 'event.batch',
      version: PROTOCOL_VERSION,
      correlationId: 'e1',
      payload: {
        sequence: 0,
        dropped: 0,
        events: [
          {
            at: toMillis(Number(snapshot.capturedAt) + 1),
            channel: 'console',
            entry: {
              id: 'new',
              kind: 'uncaught',
              level: 'error',
              timestamp: toMillis(Number(snapshot.capturedAt) + 1),
              args: [],
              count: 1,
            },
          },
        ],
      },
    });
    expect(store.consoleErrors.value).toBe(1);
    unsubscribe();
  });

  it('tolerates a reconnect without duplicating state', async () => {
    const [client] = answerSnapshots();
    const store = createOverviewStore();

    await synchronize(store, client);
    await synchronize(store, client);

    expect(store.connection.value).toBe('connected');
    expect(store.networkCount.value).toBe(1);
    expect(store.findings.value.length).toBe(1);
  });

  it('reports an error when nothing answers the snapshot request', async () => {
    const [client] = createInMemoryChannelPair({ createId: () => 'c1' });
    const store = createOverviewStore();

    const result = await synchronize(store, client, { timeoutMs: 20 });

    expect(result.ok).toBe(false);
    expect(store.connection.value).toBe('error');
  });
});
