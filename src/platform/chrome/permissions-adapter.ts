import { hostOriginFromPattern, toHostPattern } from '../../core';
import type { PermissionsPort } from '../ports/permissions';
import { attempt } from './errors';

/** The narrow permissions surface the adapter needs. */
export interface PermissionsApi {
  readonly permissions: {
    contains(permissions: { origins?: readonly string[] }): Promise<boolean>;
    request(permissions: { origins?: readonly string[] }): Promise<boolean>;
    remove(permissions: { origins?: readonly string[] }): Promise<void>;
    getAll(): Promise<{ origins?: readonly string[] }>;
    readonly onRemoved: {
      addListener(listener: (permissions: { origins?: readonly string[] }) => void): void;
      removeListener(listener: (permissions: { origins?: readonly string[] }) => void): void;
    };
  };
}

function originsFromPatterns(patterns: readonly string[]): readonly string[] {
  const origins: string[] = [];
  for (const pattern of patterns) {
    const origin = hostOriginFromPattern(pattern);
    if (origin !== undefined) {
      origins.push(origin);
    }
  }
  return origins;
}

/**
 * Optional host permissions via `chrome.permissions`. The port speaks host
 * origins; Chrome speaks match patterns, so this adapter converts both ways
 * (G12). Match patterns ignore ports, so each origin is granted as
 * `scheme://host/*` (the whole host, on any port).
 */
export function createPermissionsPort(api: PermissionsApi): PermissionsPort {
  const permissions = api.permissions;
  return {
    contains: (origins) =>
      attempt(() => permissions.contains({ origins: origins.map(toHostPattern) })),
    request: (origins) =>
      attempt(() => permissions.request({ origins: origins.map(toHostPattern) })),
    remove: (origins) =>
      attempt(async () => {
        await permissions.remove({ origins: origins.map(toHostPattern) });
      }),
    getAll: () =>
      attempt(async () => originsFromPatterns((await permissions.getAll()).origins ?? [])),
    onRemoved: (listener) => {
      const callback = (changed: { origins?: readonly string[] }): void => {
        listener(originsFromPatterns(changed.origins ?? []));
      };
      permissions.onRemoved.addListener(callback);
      return () => {
        permissions.onRemoved.removeListener(callback);
      };
    },
  };
}
