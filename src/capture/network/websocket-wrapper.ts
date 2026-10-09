import { toBytes, toMillis, type NetworkEntry } from '../../core';
import type { ClockPort } from '../../platform/ports';

/** A minimal WebSocket surface (structural, for fakes). */
export interface WebSocketInstanceLike {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  readonly url: string;
}
export type WebSocketConstructor = new (url: string) => WebSocketInstanceLike;

/** Dependencies for {@link instrumentWebSocket}. */
export interface WebSocketInstrumentDeps {
  readonly clock: ClockPort;
  readonly emit: (entry: NetworkEntry) => void;
  readonly createId: () => string;
}

/**
 * Wraps a WebSocket constructor defensively, recording basic open/close
 * metadata (PRD FR-4).
 */
export function instrumentWebSocket(
  Original: WebSocketConstructor,
  deps: WebSocketInstrumentDeps,
): WebSocketConstructor {
  const Patched = function PatchedWebSocket(this: unknown, url: string): WebSocketInstanceLike {
    const socket = new Original(url);
    const started = Number(deps.clock.now());
    const emit = (opened: boolean, closed: boolean, code?: number): void => {
      deps.emit({
        id: deps.createId(),
        method: 'GET',
        url: socket.url,
        status: null,
        resourceType: 'websocket',
        transferSize: toBytes(0),
        decodedSize: toBytes(0),
        fromCache: false,
        timing: {
          dns: toMillis(0),
          connect: toMillis(0),
          tls: toMillis(0),
          ttfb: toMillis(0),
          download: toMillis(0),
          total: toMillis(Number(deps.clock.now()) - started),
        },
        meta: {
          initiatorType: 'websocket',
          webSocket: { opened, closed, ...(code === undefined ? {} : { code }) },
        },
      });
    };
    socket.addEventListener('open', () => {
      emit(true, false);
    });
    socket.addEventListener('close', (event) => {
      const code =
        typeof event === 'object' && event !== null && 'code' in event
          ? (event as { code?: number }).code
          : undefined;
      emit(true, true, code);
    });
    return socket;
  };
  return Patched as unknown as WebSocketConstructor;
}
