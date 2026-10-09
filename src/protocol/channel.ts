import { createIdFactory, err, ok, type Result } from '../core';
import type { ProtocolError } from './errors';
import type {
  CommandInput,
  CommandMessage,
  ErrorMessage,
  ProtocolMessage,
  ResultMessage,
} from './messages';
import { PROTOCOL_VERSION } from './version';

/** Default time a `request` waits for a matching response. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;

/** Removes a previously registered handler. */
export type Unsubscribe = () => void;

/** Receives every message delivered to a channel. */
export type MessageHandler = (message: ProtocolMessage) => void;

/** Options for {@link TypedChannel.request}. */
export interface RequestOptions {
  readonly timeoutMs?: number;
}

/** A typed message channel (PRD 8.2). */
export interface TypedChannel {
  /** Sends a message without waiting for a response. */
  send(message: ProtocolMessage): void;
  /**
   * Sends a command and resolves with the matching result message, or with a
   * `timeout` error when no response with the same correlationId arrives in
   * time. Never rejects.
   */
  request(
    command: CommandInput,
    options?: RequestOptions,
  ): Promise<Result<ResultMessage, ProtocolError>>;
  /** Subscribes to messages; returns an unsubscribe function. */
  on(handler: MessageHandler): Unsubscribe;
}

interface PendingRequest {
  readonly resolve: (value: Result<ResultMessage, ProtocolError>) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

interface Endpoint {
  readonly listeners: Set<MessageHandler>;
  readonly pending: Map<string, PendingRequest>;
  peer?: Endpoint;
}

function isResponse(message: ProtocolMessage): message is ResultMessage | ErrorMessage {
  return message.type === 'error' || message.type.startsWith('result.');
}

function deliver(target: Endpoint, message: ProtocolMessage): void {
  if (isResponse(message)) {
    const pending = target.pending.get(message.correlationId);
    if (pending !== undefined) {
      target.pending.delete(message.correlationId);
      clearTimeout(pending.timer);
      pending.resolve(message.type === 'error' ? err(message.payload) : ok(message));
    }
  }
  for (const listener of [...target.listeners]) {
    try {
      listener(message);
    } catch {
      // A listener must not break delivery to the others.
    }
  }
}

function materialize(
  endpoint: Endpoint,
  createId: () => string,
  defaultTimeoutMs: number,
): TypedChannel {
  return {
    send(message) {
      const peer = endpoint.peer;
      if (peer !== undefined) {
        deliver(peer, message);
      }
    },
    on(handler) {
      endpoint.listeners.add(handler);
      return () => {
        endpoint.listeners.delete(handler);
      };
    },
    request(command, options) {
      return new Promise((resolve) => {
        const correlationId = createId();
        const timeoutMs = options?.timeoutMs ?? defaultTimeoutMs;
        const message: CommandMessage = { ...command, version: PROTOCOL_VERSION, correlationId };
        const timer = setTimeout(() => {
          endpoint.pending.delete(correlationId);
          resolve(
            err({
              code: 'timeout',
              message: `Request "${command.type}" timed out after ${String(timeoutMs)} ms`,
            }),
          );
        }, timeoutMs);
        endpoint.pending.set(correlationId, { resolve, timer });
        const peer = endpoint.peer;
        if (peer !== undefined) {
          deliver(peer, message);
        }
      });
    },
  };
}

/** Options for {@link createInMemoryChannelPair}. */
export interface InMemoryChannelOptions {
  /** Correlation-id factory; defaults to a clock/randomness based one. */
  readonly createId?: () => string;
  /** Default request timeout; defaults to {@link DEFAULT_REQUEST_TIMEOUT_MS}. */
  readonly defaultTimeoutMs?: number;
}

/**
 * Creates two linked in-memory channels for tests. A message sent on one is
 * delivered to the other's handlers, so a handler on one side can answer a
 * `request` from the other.
 */
export function createInMemoryChannelPair(
  options: InMemoryChannelOptions = {},
): readonly [TypedChannel, TypedChannel] {
  const createId =
    options.createId ?? createIdFactory({ now: () => Date.now(), random: () => Math.random() });
  const defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const first: Endpoint = { listeners: new Set(), pending: new Map() };
  const second: Endpoint = { listeners: new Set(), pending: new Map() };
  first.peer = second;
  second.peer = first;
  return [
    materialize(first, createId, defaultTimeoutMs),
    materialize(second, createId, defaultTimeoutMs),
  ];
}
