import { toMillis, type Millis } from '../../core';
import type { ClockPort } from '../ports';

/**
 * Real clock backed by `Date.now` and `setTimeout`.
 *
 * It lives in its own module (not `adapters.ts`) so the page-world agent can
 * import it without pulling in the storage adapter's Zod dependency (ADR 0018).
 */
export function createClockPort(): ClockPort {
  return {
    now: (): Millis => toMillis(Date.now()),
    delay: (milliseconds) =>
      new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, milliseconds);
      }),
  };
}
