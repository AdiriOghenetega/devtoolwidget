import type {
  RegisteredSiteScript,
  SiteScriptDescriptor,
  SiteScriptsPort,
} from '../ports/site-scripts';
import { attempt } from './errors';

/** The narrow scripting-registration surface the adapter needs. */
export interface SiteScriptsApi {
  readonly scripting: {
    registerContentScripts(scripts: readonly unknown[]): Promise<void>;
    unregisterContentScripts(filter?: { readonly ids?: readonly string[] }): Promise<void>;
    getRegisteredContentScripts(): Promise<readonly unknown[]>;
  };
}

function toBrowserScript(descriptor: SiteScriptDescriptor): Record<string, unknown> {
  return {
    id: descriptor.id,
    matches: [...descriptor.matches],
    js: [...descriptor.js],
    runAt: descriptor.runAt,
    ...(descriptor.world === undefined ? {} : { world: descriptor.world }),
  };
}

function toRegistered(raw: unknown): RegisteredSiteScript {
  const record = raw as { readonly id?: unknown; readonly matches?: unknown };
  return {
    id: typeof record.id === 'string' ? record.id : '',
    matches: Array.isArray(record.matches) ? record.matches.map((match) => String(match)) : [],
  };
}

/** Dynamic content-script registration via `chrome.scripting`. */
export function createSiteScriptsPort(api: SiteScriptsApi): SiteScriptsPort {
  const scripting = api.scripting;
  return {
    register: (descriptors) =>
      attempt(async () => {
        if (descriptors.length > 0) {
          await scripting.registerContentScripts(descriptors.map(toBrowserScript));
        }
      }),
    unregister: (ids) =>
      attempt(async () => {
        if (ids.length > 0) {
          await scripting.unregisterContentScripts({ ids: [...ids] });
        }
      }),
    list: () =>
      attempt(async () =>
        (await scripting.getRegisteredContentScripts()).map((raw) => toRegistered(raw)),
      ),
  };
}
