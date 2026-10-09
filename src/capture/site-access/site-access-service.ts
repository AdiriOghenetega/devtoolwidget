import { ok, type Result } from '../../core';
import type {
  PermissionsPort,
  PlatformError,
  SiteScriptDescriptor,
  SiteScriptsPort,
} from '../../platform/ports';
import { contentScriptId, originOfScriptId, siteScriptDescriptors } from './descriptors';

/** Outcome of requesting access to an origin. */
export type GrantStatus = 'granted' | 'already-granted' | 'denied';

/** Dependencies for {@link SiteAccessService}. */
export interface SiteAccessDeps {
  readonly permissions: PermissionsPort;
  readonly siteScripts: SiteScriptsPort;
  readonly descriptors?: (origin: string) => readonly SiteScriptDescriptor[];
}

/**
 * Manages optional per-origin access (PRD 7, FR-15): requests the optional host
 * permission, registers the content and agent scripts for granted origins, and
 * unregisters them on revocation. {@link sync} re-registers for already-granted
 * origins after a browser restart.
 */
export class SiteAccessService {
  readonly #permissions: PermissionsPort;
  readonly #siteScripts: SiteScriptsPort;
  readonly #descriptors: (origin: string) => readonly SiteScriptDescriptor[];

  constructor(deps: SiteAccessDeps) {
    this.#permissions = deps.permissions;
    this.#siteScripts = deps.siteScripts;
    this.#descriptors = deps.descriptors ?? siteScriptDescriptors;
  }

  /** Requests access for an origin and registers its scripts when granted. */
  async grant(origin: string): Promise<Result<GrantStatus, PlatformError>> {
    const contained = await this.#permissions.contains([origin]);
    if (!contained.ok) {
      return contained;
    }
    if (contained.value) {
      const registered = await this.#register(origin);
      return registered.ok ? ok('already-granted') : registered;
    }

    const requested = await this.#permissions.request([origin]);
    if (!requested.ok) {
      return requested;
    }
    if (!requested.value) {
      return ok('denied');
    }

    const registered = await this.#register(origin);
    return registered.ok ? ok('granted') : registered;
  }

  /** Unregisters scripts for an origin and drops its host permission. */
  async revoke(origin: string): Promise<Result<void, PlatformError>> {
    const ids = this.#descriptors(origin).map((descriptor) => descriptor.id);
    const unregistered = await this.#siteScripts.unregister(ids);
    if (!unregistered.ok) {
      return unregistered;
    }
    return this.#permissions.remove([origin]);
  }

  /**
   * Reconciles registrations with the currently granted origins. Called on
   * install, update and startup so a browser restart restores access, and any
   * registration for a revoked origin is removed.
   */
  async sync(): Promise<Result<readonly string[], PlatformError>> {
    const grantedResult = await this.#permissions.getAll();
    if (!grantedResult.ok) {
      return grantedResult;
    }
    const granted = grantedResult.value;
    const grantedSet = new Set(granted);

    const registeredResult = await this.#siteScripts.list();
    if (!registeredResult.ok) {
      return registeredResult;
    }
    const registered = registeredResult.value;
    const registeredIds = new Set(registered.map((script) => script.id));

    const stale = registered
      .filter((script) => {
        const origin = originOfScriptId(script.id);
        return origin !== undefined && !grantedSet.has(origin);
      })
      .map((script) => script.id);
    if (stale.length > 0) {
      const removed = await this.#siteScripts.unregister(stale);
      if (!removed.ok) {
        return removed;
      }
    }

    for (const origin of granted) {
      if (!registeredIds.has(contentScriptId(origin))) {
        const registeredOrigin = await this.#register(origin);
        if (!registeredOrigin.ok) {
          return registeredOrigin;
        }
      }
    }

    return ok([...granted]);
  }

  /** Subscribes to permission revocation; unregisters the affected origins. */
  onRevoked(listener: (origins: readonly string[]) => void): () => void {
    return this.#permissions.onRemoved((removed) => {
      for (const origin of removed) {
        void this.revoke(origin);
      }
      listener(removed);
    });
  }

  async #register(origin: string): Promise<Result<void, PlatformError>> {
    return this.#siteScripts.register(this.#descriptors(origin));
  }
}
