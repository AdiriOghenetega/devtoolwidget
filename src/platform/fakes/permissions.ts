import { ok } from '../../core';
import type { PermissionsPort } from '../ports/permissions';

/** A controllable {@link PermissionsPort} with grant/revoke helpers. */
export interface FakePermissionsPort extends PermissionsPort {
  grant(origins: readonly string[]): void;
  revoke(origins: readonly string[]): void;
  setRequestResult(result: boolean): void;
}

/** Creates an in-memory fake permissions port. */
export function createFakePermissionsPort(initial: readonly string[] = []): FakePermissionsPort {
  const granted = new Set(initial);
  const listeners = new Set<(removed: readonly string[]) => void>();
  let requestResult = true;
  return {
    grant(origins) {
      for (const origin of origins) {
        granted.add(origin);
      }
    },
    revoke(origins) {
      for (const origin of origins) {
        granted.delete(origin);
      }
      for (const listener of [...listeners]) {
        listener(origins);
      }
    },
    setRequestResult(result) {
      requestResult = result;
    },
    contains(origins) {
      return Promise.resolve(ok(origins.every((origin) => granted.has(origin))));
    },
    request(origins) {
      if (requestResult) {
        for (const origin of origins) {
          granted.add(origin);
        }
      }
      return Promise.resolve(ok(requestResult));
    },
    remove(origins) {
      for (const origin of origins) {
        granted.delete(origin);
      }
      return Promise.resolve(ok(undefined));
    },
    getAll() {
      return Promise.resolve(ok([...granted]));
    },
    onRemoved(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
