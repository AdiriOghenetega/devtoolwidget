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

/** Optional host permissions via `chrome.permissions`. */
export function createPermissionsPort(api: PermissionsApi): PermissionsPort {
  const permissions = api.permissions;
  return {
    contains: (origins) => attempt(() => permissions.contains({ origins })),
    request: (origins) => attempt(() => permissions.request({ origins })),
    remove: (origins) =>
      attempt(async () => {
        await permissions.remove({ origins });
      }),
    getAll: () => attempt(async () => (await permissions.getAll()).origins ?? []),
    onRemoved: (listener) => {
      const callback = (changed: { origins?: readonly string[] }): void => {
        listener(changed.origins ?? []);
      };
      permissions.onRemoved.addListener(callback);
      return () => {
        permissions.onRemoved.removeListener(callback);
      };
    },
  };
}
