import { z } from 'zod';
import type { Result, TabId } from '../../core';
import type { PlatformError, StoragePort } from '../../platform/ports';

/** Per-tab capture session state, persisted in `storage.session` (PRD 8.1). */
export interface TabSession {
  readonly tabId: TabId;
  readonly url?: string;
  readonly agentConnected: boolean;
  readonly updatedAt: number;
}

const SESSION_SCHEMA_VERSION = 1;
const sessionSchema = z.object({
  url: z.string().optional(),
  agentConnected: z.boolean(),
  updatedAt: z.number(),
});

type StoredSession = z.infer<typeof sessionSchema>;

/**
 * The per-tab session registry. It persists through the storage port with a
 * schema version, so it survives the ephemeral MV3 service worker (PRD section
 * 7: persist session state in `storage.session`).
 */
export class TabSessionRegistry {
  readonly #storage: StoragePort;
  readonly #now: () => number;

  constructor(storage: StoragePort, now: () => number = () => Date.now()) {
    this.#storage = storage;
    this.#now = now;
  }

  #storageKey(tabId: TabId): string {
    return `session:${String(tabId)}`;
  }

  /** Reads the session for a tab, or `undefined` when none is stored. */
  async get(tabId: TabId): Promise<Result<TabSession | undefined, PlatformError>> {
    const read = await this.#storage.read('session', this.#storageKey(tabId), {
      version: SESSION_SCHEMA_VERSION,
      schema: sessionSchema,
    });
    if (!read.ok) {
      return read;
    }
    if (read.value === undefined) {
      return { ok: true, value: undefined };
    }
    return { ok: true, value: toSession(tabId, read.value) };
  }

  /** Creates or updates the session for a tab. */
  async upsert(
    tabId: TabId,
    patch: { readonly url?: string; readonly agentConnected?: boolean },
  ): Promise<Result<TabSession, PlatformError>> {
    const existing = await this.get(tabId);
    if (!existing.ok) {
      return existing;
    }
    const previous = existing.value;
    const next: TabSession = {
      tabId,
      agentConnected: patch.agentConnected ?? previous?.agentConnected ?? false,
      updatedAt: this.#now(),
      ...(patch.url !== undefined
        ? { url: patch.url }
        : previous?.url !== undefined
          ? { url: previous.url }
          : {}),
    };
    const stored: StoredSession = {
      agentConnected: next.agentConnected,
      updatedAt: next.updatedAt,
      ...(next.url === undefined ? {} : { url: next.url }),
    };
    const written = await this.#storage.write(
      'session',
      this.#storageKey(tabId),
      { version: SESSION_SCHEMA_VERSION, schema: sessionSchema },
      stored,
    );
    return written.ok ? { ok: true, value: next } : written;
  }

  /** Removes the session for a tab (e.g. when the tab closes). */
  async remove(tabId: TabId): Promise<Result<void, PlatformError>> {
    return this.#storage.remove('session', this.#storageKey(tabId));
  }
}

function toSession(tabId: TabId, stored: StoredSession): TabSession {
  return {
    tabId,
    agentConnected: stored.agentConnected,
    updatedAt: stored.updatedAt,
    ...(stored.url === undefined ? {} : { url: stored.url }),
  };
}
