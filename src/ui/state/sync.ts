import { err, ok, type PageSnapshot, type Result } from '../../core';
import type { ProtocolError, TypedChannel } from '../../protocol';
import type { OverviewStore } from './stores';

/** Why a sync attempt failed. */
export type SyncError = ProtocolError | { readonly code: 'transport'; readonly message: string };

/**
 * Subscribes to delta events from the channel. Returns an unsubscribe function.
 * Events are applied to the store, which de-duplicates by id, so re-delivery
 * after a reconnect is harmless.
 */
export function attachDeltas(store: OverviewStore, channel: TypedChannel): () => void {
  return channel.on((message) => {
    store.applyEvent(message);
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
  store.applySnapshot(response.value.payload as unknown as PageSnapshot);
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
