import { toBytes, type NetworkEntry } from '../../core';
import type { ClockPort } from '../../platform/ports';
import { buildTiming } from './network-collector';

/** A minimal XMLHttpRequest surface (structural, for fakes). */
export interface XhrInstanceLike {
  open(method: string, url: string): void;
  send(body?: unknown): void;
  addEventListener(type: string, listener: () => void): void;
  readonly status: number;
  readonly responseURL: string;
}
export type XhrConstructor = new () => XhrInstanceLike;

/** Dependencies for {@link instrumentXhr}. */
export interface XhrInstrumentDeps {
  readonly clock: ClockPort;
  readonly emit: (entry: NetworkEntry) => void;
  readonly createId: () => string;
}

/**
 * Wraps an XMLHttpRequest constructor defensively: it preserves the instance and
 * its behavior, recording an entry on `loadend` (PRD FR-4).
 */
export function instrumentXhr(Original: XhrConstructor, deps: XhrInstrumentDeps): XhrConstructor {
  const Patched = function PatchedXhr(this: unknown): XhrInstanceLike {
    const instance = new Original();
    let method = 'GET';
    let url = '';
    let start = 0;
    const originalOpen = instance.open.bind(instance);
    instance.open = (nextMethod: string, nextUrl: string): void => {
      method = nextMethod.toUpperCase();
      url = nextUrl;
      originalOpen(nextMethod, nextUrl);
    };
    const originalSend = instance.send.bind(instance);
    instance.send = (body?: unknown): void => {
      start = Number(deps.clock.now());
      instance.addEventListener('loadend', () => {
        const elapsed = Number(deps.clock.now()) - start;
        deps.emit({
          id: deps.createId(),
          method,
          url,
          status: instance.status,
          resourceType: 'xhr',
          transferSize: toBytes(0),
          decodedSize: toBytes(0),
          fromCache: false,
          timing: buildTiming(undefined, elapsed),
          meta: { finalUrl: instance.responseURL, initiatorType: 'xmlhttprequest' },
        });
      });
      originalSend(body);
    };
    return instance;
  };
  return Patched as unknown as XhrConstructor;
}
