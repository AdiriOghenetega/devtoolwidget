import { z } from 'zod';
import { toMillis, type Result, type TabId } from '../../core';
import type { PlatformError, StoragePort } from '../../platform/ports';
import type { Batch, PipelineEvent } from './event-pipeline';

/** The persisted per-tab pipeline session (PRD 8.5, 7). */
export interface StoredSession {
  readonly url: string;
  readonly sequence: number;
  readonly events: readonly PipelineEvent[];
  readonly dropped: number;
}

const eventSchema = z.object({
  kind: z.string(),
  at: z.number().transform((value) => toMillis(value)),
});
const sessionSchema = z.object({
  url: z.string(),
  sequence: z.number().int(),
  events: z.array(eventSchema),
  dropped: z.number().int(),
});
const STORAGE_VERSION = 1;

/** Options for {@link TabSessionStore}. */
export interface TabSessionStoreOptions {
  /** Maximum events retained per tab (older events are trimmed). */
  readonly maxEvents?: number;
}

/**
 * The per-tab session store (PRD 8.1), persisted through the storage port in
 * `storage.session` (see ADR 0012). The stored document carries a monotonic
 * sequence so out-of-order batches are ignored, and it survives a service-worker
 * restart because it lives in `storage.session`, not in worker memory.
 */
export class TabSessionStore {
  readonly #storage: StoragePort;
  readonly #maxEvents: number;

  constructor(storage: StoragePort, options: TabSessionStoreOptions = {}) {
    this.#storage = storage;
    this.#maxEvents = options.maxEvents ?? 500;
  }

  #key(tabId: TabId): string {
    return `pipeline:${String(tabId)}`;
  }

  /** Reads the stored session for a tab, or `undefined`. */
  async snapshot(tabId: TabId): Promise<Result<StoredSession | undefined, PlatformError>> {
    const read = await this.#storage.read('session', this.#key(tabId), {
      version: STORAGE_VERSION,
      schema: sessionSchema,
    });
    if (!read.ok) {
      return read;
    }
    return { ok: true, value: read.value ?? undefined };
  }

  /**
   * Applies a batch, appending its events. A batch whose sequence is not newer
   * than the stored one is ignored (out-of-order/stale) and returns `false`.
   */
  async applyBatch(batch: Batch): Promise<Result<boolean, PlatformError>> {
    const current = await this.snapshot(batch.tabId);
    if (!current.ok) {
      return current;
    }
    const previous = current.value;
    if (previous !== undefined && batch.sequence <= previous.sequence) {
      return { ok: true, value: false };
    }
    const events = [...(previous?.events ?? []), ...batch.events].slice(-this.#maxEvents);
    const next: StoredSession = {
      url: previous?.url ?? '',
      sequence: batch.sequence,
      events,
      dropped: previous?.dropped ?? 0,
    };
    const written = await this.#storage.write(
      'session',
      this.#key(batch.tabId),
      { version: STORAGE_VERSION, schema: sessionSchema },
      next,
    );
    return written.ok ? { ok: true, value: true } : written;
  }

  /** Records a navigation, optionally preserving the existing event log. */
  async markNavigation(
    tabId: TabId,
    url: string,
    options: { readonly preserveLog?: boolean } = {},
  ): Promise<Result<void, PlatformError>> {
    const current = await this.snapshot(tabId);
    if (!current.ok) {
      return current;
    }
    const previous = current.value;
    const next: StoredSession = {
      url,
      sequence: previous?.sequence ?? -1,
      events: options.preserveLog === true ? (previous?.events ?? []) : [],
      dropped: previous?.dropped ?? 0,
    };
    return this.#storage.write(
      'session',
      this.#key(tabId),
      { version: STORAGE_VERSION, schema: sessionSchema },
      next,
    );
  }

  /** Removes the stored session for a tab (called on tab close). */
  async clear(tabId: TabId): Promise<Result<void, PlatformError>> {
    return this.#storage.remove('session', this.#key(tabId));
  }
}
