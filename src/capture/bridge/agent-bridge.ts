import { PROTOCOL_VERSION, parseCommand, type CommandMessage } from '../../protocol';
import { createAck, parseHandshake } from './handshake';

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
  /** The nonce of the adopted handshake, once connected. */
  readonly nonce: string | undefined;
  /** True once a handshake has been adopted. */
  readonly connected: boolean;
  dispose(): void;
}

function replyTo(port: AgentPort, command: CommandMessage): void {
  if (command.type === 'command.ping') {
    port.postMessage({
      type: 'result.ping',
      version: PROTOCOL_VERSION,
      correlationId: command.correlationId,
      payload: { pong: true },
    });
    return;
  }
  port.postMessage({
    type: 'error',
    version: PROTOCOL_VERSION,
    correlationId: command.correlationId,
    payload: { code: 'unsupported', message: `Agent cannot handle "${command.type}"` },
  });
}

/**
 * Installs the main-world agent bridge (PRD section 7). It registers a
 * **capturing** message listener immediately, adopts the first handshake whose
 * nonce it accepts, suppresses the event with `stopImmediatePropagation` so page
 * listeners never observe the port transfer, and then answers commands arriving
 * on the transferred port. Everything from the page is treated as untrusted and
 * validated with the protocol schemas.
 */
export function installAgentBridge(options: AgentBridgeOptions): AgentBridge {
  let nonce: string | undefined;
  let connected = false;

  const listener = (event: MessageEvent): void => {
    if (connected) {
      return;
    }
    const parsed = parseHandshake(event.data);
    if (!parsed.ok) {
      return;
    }
    const port = event.ports[0];
    if (port === undefined) {
      return;
    }
    connected = true;
    nonce = parsed.value.nonce;
    // Hide the transfer from every later page listener.
    event.stopImmediatePropagation();
    options.target.removeEventListener('message', listener, true);
    port.start();
    port.onmessage = (messageEvent: MessageEvent) => {
      const command = parseCommand(messageEvent.data);
      if (command.ok) {
        replyTo(port, command.value);
      }
    };
    port.postMessage(createAck(parsed.value.nonce));
  };

  options.target.addEventListener('message', listener, true);

  return {
    get nonce() {
      return nonce;
    },
    get connected() {
      return connected;
    },
    dispose() {
      options.target.removeEventListener('message', listener, true);
    },
  };
}
