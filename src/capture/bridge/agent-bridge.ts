import type { AgentConfigMessage } from '../../protocol';
import { createAck, parseCommit, parseHandshake } from './handshake';
import { parseAgentConfig } from './agent-config';

/** Minimal port surface the agent needs (structurally satisfied by MessagePort). */
export interface AgentPort {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
  start?(): void;
}

/** Minimal window surface the agent needs. */
export interface AgentWindow {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: 'message',
    listener: (event: MessageEvent) => void,
    options?: boolean | EventListenerOptions,
  ): void;
}

/** Options for {@link installAgentBridge}. */
export interface AgentBridgeOptions {
  readonly target: AgentWindow;
}

/** Handle to a live agent bridge. */
export interface AgentBridge {
  /** The nonce of the adopted handshake, once one has been seen. */
  readonly nonce: string | undefined;
  /** True once the content script has committed to this port (see below). */
  readonly connected: boolean;
  /**
   * Runs `handler` once the content script has committed to the adopted port
   * (immediately if it already has), and returns an unsubscribe. Capture starts
   * here so no batch is produced before there is a committed port.
   */
  onConnect(handler: () => void): () => void;
  /**
   * Subscribes to validated `agent.config` messages. They are accepted only on
   * the committed secure port (never from the window), and a rejected message
   * invokes no handler, so the agent keeps its last safe config (G13).
   */
  onConfig(handler: (message: AgentConfigMessage) => void): () => void;
  /** Sends a protocol message over the committed port. No-op before commit. */
  send(message: unknown): void;
  dispose(): void;
}

/**
 * Installs the main-world agent bridge (PRD section 7). It registers a
 * **capturing** message listener immediately and adopts each valid handshake it
 * sees, suppressing the event with `stopImmediatePropagation` so page listeners
 * never observe the port transfer. Everything from the page is treated as
 * untrusted and validated; the three bootstrap messages use the hand-written
 * guards in `handshake.ts` (ADR 0018) so the agent stays under its bundle budget.
 *
 * Adoption is **tentative** until the content script sends a `commit` on the
 * port. The content script abandons a handshake attempt after its retry window,
 * which at `document_start` can be shorter than the round trip under main-thread
 * contention, so a committed-on-first-handshake agent would deadlock against a
 * content script that moved on to a fresh channel. Staying tentative lets the
 * agent adopt the attempt the content script is actually waiting on. This is the
 * root-cause fix for integration gap G7; it does not change the nonce, the
 * capturing-listener ordering, the suppression, or the one-time port transfer.
 */
export function installAgentBridge(options: AgentBridgeOptions): AgentBridge {
  let nonce: string | undefined;
  let committed = false;
  let tentative: AgentPort | undefined;
  let port: AgentPort | undefined;
  const connectHandlers = new Set<() => void>();
  const configHandlers = new Set<(message: AgentConfigMessage) => void>();

  const listener = (event: MessageEvent): void => {
    if (committed) {
      return;
    }
    const parsed = parseHandshake(event.data);
    if (!parsed.ok) {
      return;
    }
    const candidate = event.ports[0];
    if (candidate === undefined) {
      return;
    }
    // Hide the transfer from every later page listener.
    event.stopImmediatePropagation();
    if (tentative !== undefined && tentative !== candidate) {
      tentative.onmessage = null;
    }
    tentative = candidate;
    nonce = parsed.value.nonce;
    const expected = parsed.value.nonce;
    candidate.start();
    candidate.onmessage = (messageEvent: MessageEvent) => {
      const commit = parseCommit(messageEvent.data);
      if (commit.ok && commit.value.nonce === expected) {
        committed = true;
        port = candidate;
        options.target.removeEventListener('message', listener, true);
        for (const handler of [...connectHandlers]) {
          handler();
        }
        connectHandlers.clear();
        return;
      }
      if (committed) {
        const config = parseAgentConfig(messageEvent.data);
        if (config.ok) {
          for (const handler of [...configHandlers]) {
            handler(config.value);
          }
        }
      }
    };
    candidate.postMessage(createAck(expected));
  };

  options.target.addEventListener('message', listener, true);

  return {
    get nonce() {
      return nonce;
    },
    get connected() {
      return committed;
    },
    onConnect(handler) {
      if (committed) {
        handler();
        return () => undefined;
      }
      connectHandlers.add(handler);
      return () => {
        connectHandlers.delete(handler);
      };
    },
    onConfig(handler) {
      configHandlers.add(handler);
      return () => {
        configHandlers.delete(handler);
      };
    },
    send(message) {
      if (committed) {
        port?.postMessage(message);
      }
    },
    dispose() {
      options.target.removeEventListener('message', listener, true);
      connectHandlers.clear();
      configHandlers.clear();
    },
  };
}
