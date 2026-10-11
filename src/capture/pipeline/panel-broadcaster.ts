import type { CaptureEvent, PageSnapshot } from '../../core';
import { PROTOCOL_VERSION } from '../../protocol';

/**
 * A panel push built from core values. The wire form is validated on receipt
 * with `parsePanelMessage`; this type is the writer side, so it uses the core
 * (readonly) payloads rather than the schema's inferred (mutable) ones.
 */
export type PanelPush =
  | {
      readonly type: 'panel.snapshot';
      readonly version: number;
      readonly correlationId: string;
      readonly payload: PageSnapshot;
    }
  | {
      readonly type: 'panel.delta';
      readonly version: number;
      readonly correlationId: string;
      readonly payload: CaptureEvent;
    };

/** Dependencies for {@link PanelBroadcaster}. */
export interface PanelBroadcasterDeps {
  /** Builds the current page state for the snapshot message. */
  readonly getSnapshot: () => Promise<PageSnapshot>;
  /** Correlation-id factory for the pushed envelopes. */
  readonly createId: () => string;
  readonly send: (message: PanelPush) => void;
}

/** Port name the panel connects on (PRD 8.4: the UI subscribes over a long-lived port). */
export const PANEL_PORT_NAME = 'devtoolwidget-panel';

/**
 * Pushes the panel the snapshot-then-deltas stream (PRD 8.4): one
 * `panel.snapshot` when the panel opens, then one `panel.delta` per capture
 * event. Events that arrive before the snapshot is sent are buffered and
 * replayed after it, so the panel never misses or reorders state. Pushes the
 * same validated envelopes the content script parses with `parsePanelMessage`.
 */
export class PanelBroadcaster {
  readonly #deps: PanelBroadcasterDeps;
  readonly #buffer: CaptureEvent[] = [];
  #ready = false;

  constructor(deps: PanelBroadcasterDeps) {
    this.#deps = deps;
  }

  /** Sends the snapshot, then replays any deltas buffered while it was built. */
  async open(): Promise<void> {
    const snapshot = await this.#deps.getSnapshot();
    this.#deps.send({
      type: 'panel.snapshot',
      version: PROTOCOL_VERSION,
      correlationId: this.#deps.createId(),
      payload: snapshot,
    });
    this.#ready = true;
    for (const event of this.#buffer) {
      this.#sendDelta(event);
    }
    this.#buffer.length = 0;
  }

  /** Forwards a delta once the snapshot has been sent; buffers it until then. */
  push(event: CaptureEvent): void {
    if (!this.#ready) {
      this.#buffer.push(event);
      return;
    }
    this.#sendDelta(event);
  }

  /** Marks the panel closed and clears any buffered deltas. */
  close(): void {
    this.#ready = false;
    this.#buffer.length = 0;
  }

  #sendDelta(event: CaptureEvent): void {
    this.#deps.send({
      type: 'panel.delta',
      version: PROTOCOL_VERSION,
      correlationId: this.#deps.createId(),
      payload: event,
    });
  }
}
