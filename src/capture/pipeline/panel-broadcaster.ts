import type { PipelineEvent } from './event-pipeline';

/** The full panel state sent when a panel opens. */
export interface PanelState {
  readonly tabId: number;
  readonly sequence: number;
  readonly events: readonly PipelineEvent[];
  readonly dropped: number;
}

/** Messages sent to a panel. */
export type PanelMessage =
  | { readonly type: 'snapshot'; readonly state: PanelState }
  | { readonly type: 'delta'; readonly event: PipelineEvent };

/** Dependencies for {@link PanelBroadcaster}. */
export interface PanelBroadcasterDeps {
  readonly getState: () => PanelState;
  readonly send: (message: PanelMessage) => void;
}

/**
 * Sends a full state snapshot when a panel opens, then a delta per subsequent
 * event (PRD 8.5). Events that arrive before the panel opens are buffered and
 * replayed immediately after the snapshot, so the panel never misses state.
 */
export class PanelBroadcaster {
  readonly #deps: PanelBroadcasterDeps;
  readonly #buffer: PipelineEvent[] = [];
  #open = false;

  constructor(deps: PanelBroadcasterDeps) {
    this.#deps = deps;
  }

  /** Marks the panel open and sends the snapshot followed by buffered deltas. */
  open(): void {
    this.#open = true;
    this.#deps.send({ type: 'snapshot', state: this.#deps.getState() });
    for (const event of this.#buffer) {
      this.#deps.send({ type: 'delta', event });
    }
    this.#buffer.length = 0;
  }

  /** Forwards a delta when open; buffers it otherwise. */
  push(event: PipelineEvent): void {
    if (this.#open) {
      this.#deps.send({ type: 'delta', event });
    } else {
      this.#buffer.push(event);
    }
  }

  /** Marks the panel closed and clears buffered deltas. */
  close(): void {
    this.#open = false;
    this.#buffer.length = 0;
  }
}
