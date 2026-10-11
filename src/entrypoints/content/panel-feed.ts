import type { PanelMessage } from '../../protocol';

/** Upper bound on UI panel deltas buffered before the lazy shell attaches. */
export const MAX_BUFFERED_DELTAS = 1_000;

/** The store-side handler the lazy shell registers. */
export interface PanelAttach {
  onMessage(message: PanelMessage): void;
  onConnection(connected: boolean): void;
}

/**
 * Buffers the UI slice of the panel-port stream between `document_start` (when the
 * port connects, so the agent config can be relayed) and the first interaction
 * (when the lazily imported shell creates the store). The latest snapshot is kept
 * whole; deltas are bounded (ADR 0019).
 */
export interface PanelFeed {
  /** Pushes a validated UI panel message (`panel.snapshot` / `panel.delta`). */
  push(message: PanelMessage): void;
  /** Records the port connection state. */
  setConnected(connected: boolean): void;
  /** Attaches the store; replays what arrived first, then streams live. */
  attach(handler: PanelAttach): void;
}

function isSnapshot(message: PanelMessage): boolean {
  return message.type === 'panel.snapshot';
}

/** Creates a {@link PanelFeed}. */
export function createPanelFeed(): PanelFeed {
  let handler: PanelAttach | undefined;
  let snapshot: PanelMessage | undefined;
  const deltas: PanelMessage[] = [];
  let connected = true;

  return {
    push(message) {
      if (handler !== undefined) {
        handler.onMessage(message);
        return;
      }
      if (isSnapshot(message)) {
        snapshot = message;
        return;
      }
      deltas.push(message);
      while (deltas.length > MAX_BUFFERED_DELTAS) {
        deltas.shift();
      }
    },
    setConnected(next) {
      connected = next;
      handler?.onConnection(next);
    },
    attach(next) {
      handler = next;
      if (snapshot !== undefined) {
        next.onMessage(snapshot);
        snapshot = undefined;
      }
      for (const delta of deltas) {
        next.onMessage(delta);
      }
      deltas.length = 0;
      next.onConnection(connected);
    },
  };
}
