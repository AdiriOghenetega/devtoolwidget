import { err, ok, type Result } from '../../core';
import { platformError, type PlatformError } from '../../platform/ports/errors';
import {
  PROTOCOL_VERSION,
  parseMessage,
  type CommandInput,
  type ErrorMessage,
  type ProtocolError,
  type ProtocolMessage,
  type ResultMessage,
} from '../../protocol';
import type { AgentPort } from './agent-bridge';
import { createHandshake, createNonce, parseAck } from './handshake';

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
  readonly timeoutMs?: number;
  readonly retryMs?: number;
  readonly maxAttempts?: number;
}

/** A live connection to the main-world agent. */
export interface AgentConnection {
  readonly nonce: string;
  request(command: CommandInput): Promise<Result<ResultMessage, BridgeError>>;
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

function createConnection(
  port: AgentPort,
  nonce: string,
  createId: () => string,
  timeoutMs: number,
): AgentConnection {
  const pending = new Map<string, Pending>();
  port.onmessage = (event: MessageEvent) => {
    const parsed = parseMessage(event.data);
    if (!parsed.ok) {
      return;
    }
    const message = parsed.value;
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
    dispose() {
      port.onmessage = null;
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
      return ok(createConnection(channel.port1, nonce, options.createId, timeoutMs));
    }
  }

  return err(platformError('timeout', 'Agent bridge did not acknowledge the handshake'));
}
