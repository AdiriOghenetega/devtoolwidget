import { err, ok, type Result } from '../../core';
import type { ProtocolError, TypedChannel } from '../../protocol';
import type { OverviewStore } from './stores';

/** Why a sync attempt failed. */
export type SyncError = ProtocolError | { readonly code: 'transport'; readonly message: string };

/**
 * Subscribes to capture deltas from the channel. Each `event.batch` is fanned
 * out to the store, which de-duplicates by id / timestamp, so re-delivery after
 * a reconnect is harmless. Returns an unsubscribe function.
 */
export function attachDeltas(store: OverviewStore, channel: TypedChannel): () => void {
  return channel.on((message) => {
    if (message.type !== 'event.batch') {
      return;
    }
    for (const event of message.payload.events) {
      store.applyEvent(event);
    }
  });
}

/**
 * The snapshot-then-delta routine: first subscribe to deltas (so none are
 * missed), then request the full snapshot and replace the store from it. Calling
 * it again tolerates a reconnect: the store is rebuilt from a fresh snapshot and
 * later deltas are reconciled by id / timestamp.
 */
export async function synchronize(
  store: OverviewStore,
  channel: TypedChannel,
  options?: { readonly timeoutMs?: number },
): Promise<Result<'connected', SyncError>> {
  store.setConnection('connecting');
  const response = await channel.request({ type: 'command.getSnapshot', payload: {} }, options);
  if (!response.ok) {
    store.setConnection('error');
    return response;
  }
  if (response.value.type !== 'result.getSnapshot') {
    store.setConnection('error');
    return err({ code: 'unsupported', message: 'Expected a snapshot result' });
  }
  store.applySnapshot(response.value.payload);
  store.setConnection('connected');
  return ok('connected');
}

/**
 * Starts synchronization: subscribes to deltas once and runs the first
 * snapshot. Returns an unsubscribe function that also detaches deltas.
 */
export function startSync(store: OverviewStore, channel: TypedChannel): () => void {
  const unsubscribe = attachDeltas(store, channel);
  void synchronize(store, channel);
  return unsubscribe;
}
