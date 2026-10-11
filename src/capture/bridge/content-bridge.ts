import { err, ok, type Result } from '../../core';
import { platformError, type PlatformError } from '../../platform/ports/errors';
import { PROTOCOL_VERSION } from '../../protocol/version';
import type {
  CommandInput,
  ErrorMessage,
  EventMessage,
  ProtocolError,
  ProtocolMessage,
  ResultMessage,
} from '../../protocol';
import type { AgentPort } from './agent-bridge';
import { createCommit, createHandshake, createNonce, parseAck } from './handshake';

/** An error from the agent (protocol) or the transport (platform). */
export type BridgeError = ProtocolError | PlatformError;

/** A MessageChannel surface (structurally satisfied by the DOM MessageChannel). */
export interface MessageChannelLike {
  readonly port1: AgentPort;
  readonly port2: unknown;
}

/** The window surface the content script needs to hand over the port. */
export interface ContentWindow {
  postMessage(message: unknown, targetOrigin: string, transfer?: readonly Transferable[]): void;
}

/** Options for {@link connectAgentBridge}. */
export interface ConnectOptions {
  readonly target: ContentWindow;
  readonly createId: () => string;
  readonly createChannel: () => MessageChannelLike;
  readonly createRandom: () => number;
  /**
   * Validates a port message. Injected so this module needs no runtime Zod
   * import (ADR 0018); the content entrypoint passes the protocol's
   * `parseMessage`.
   */
  readonly parseMessage: (input: unknown) => Result<ProtocolMessage, ProtocolError>;
  readonly timeoutMs?: number;
  readonly retryMs?: number;
  readonly maxAttempts?: number;
}

/** A live connection to the main-world agent. */
export interface AgentConnection {
  readonly nonce: string;
  request(command: CommandInput): Promise<Result<ResultMessage, BridgeError>>;
  /** Sends a message to the agent without expecting a reply (e.g. `agent.config`). */
  send(message: unknown): void;
  /** Subscribes to capture events the agent pushes (e.g. `event.batch`). */
  onEvent(handler: (message: EventMessage) => void): () => void;
  dispose(): void;
}

interface Pending {
  readonly resolve: (value: Result<ResultMessage, BridgeError>) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

function waitForAck(port: AgentPort, nonce: string, retryMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      port.onmessage = null;
      resolve(false);
    }, retryMs);
    port.onmessage = (event: MessageEvent) => {
      const ack = parseAck(event.data);
      if (ack.ok && ack.value.nonce === nonce) {
        clearTimeout(timer);
        resolve(true);
      }
    };
    port.start?.();
  });
}

function isErrorMessage(message: ProtocolMessage): message is ErrorMessage {
  return message.type === 'error';
}

function isResultMessage(message: ProtocolMessage): message is ResultMessage {
  return message.type.startsWith('result.');
}

function isEventMessage(message: ProtocolMessage): message is EventMessage {
  return message.type.startsWith('event.');
}

function createConnection(
  port: AgentPort,
  nonce: string,
  createId: () => string,
  timeoutMs: number,
  parseMessage: (input: unknown) => Result<ProtocolMessage, ProtocolError>,
): AgentConnection {
  const pending = new Map<string, Pending>();
  const eventHandlers = new Set<(message: EventMessage) => void>();
  port.onmessage = (event: MessageEvent) => {
    const parsed = parseMessage(event.data);
    if (!parsed.ok) {
      return;
    }
    const message = parsed.value;
    if (isEventMessage(message)) {
      for (const handler of [...eventHandlers]) {
        handler(message);
      }
      return;
    }
    const entry = pending.get(message.correlationId);
    if (entry === undefined) {
      return;
    }
    if (isErrorMessage(message)) {
      pending.delete(message.correlationId);
      clearTimeout(entry.timer);
      entry.resolve(err(message.payload));
    } else if (isResultMessage(message)) {
      pending.delete(message.correlationId);
      clearTimeout(entry.timer);
      entry.resolve(ok(message));
    }
  };

  return {
    nonce,
    request(command) {
      return new Promise((resolve) => {
        const correlationId = createId();
        const timer = setTimeout(() => {
          pending.delete(correlationId);
          resolve(platformErrorResult(`Request "${command.type}" timed out`));
        }, timeoutMs);
        pending.set(correlationId, { resolve, timer });
        port.postMessage({ ...command, version: PROTOCOL_VERSION, correlationId });
      });
    },
    onEvent(handler) {
      eventHandlers.add(handler);
      return () => {
        eventHandlers.delete(handler);
      };
    },
    send(message) {
      port.postMessage(message);
    },
    dispose() {
      port.onmessage = null;
      eventHandlers.clear();
    },
  };
}

function platformErrorResult(message: string): Result<ResultMessage, PlatformError> {
  return err(platformError('timeout', message));
}

export async function connectAgentBridge(
  options: ConnectOptions,
): Promise<Result<AgentConnection, PlatformError>> {
  const timeoutMs = options.timeoutMs ?? 1_000;
  const retryMs = options.retryMs ?? 50;
  const maxAttempts = options.maxAttempts ?? 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const channel = options.createChannel();
    const nonce = createNonce(options.createRandom);
    const acked = waitForAck(channel.port1, nonce, retryMs);
    options.target.postMessage(createHandshake(nonce), '*', [channel.port2 as Transferable]);
    if (await acked) {
      // Commit the agent to this port so the one it adopts is the one we hold.
      channel.port1.postMessage(createCommit(nonce));
      return ok(
        createConnection(channel.port1, nonce, options.createId, timeoutMs, options.parseMessage),
      );
    }
  }

  return err(platformError('timeout', 'Agent bridge did not acknowledge the handshake'));
}
