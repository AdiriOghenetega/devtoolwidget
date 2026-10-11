import { z } from 'zod';
import type { CaptureEvent, Result, TabId } from '../../core';
import type { PlatformError, StoragePort } from '../../platform/ports';
import { captureEventSchema } from '../../protocol';

/** The persisted per-tab capture session (PRD 8.5, 7). */
export interface StoredSession {
  readonly url: string;
  readonly sequence: number;
  readonly events: readonly CaptureEvent[];
  readonly dropped: number;
}

/** A batch stamped with the tab it belongs to (the service worker adds the id). */
export interface StoredBatch {
  readonly tabId: TabId;
  readonly sequence: number;
  readonly dropped: number;
  readonly events: readonly CaptureEvent[];
}

const sessionSchema: z.ZodType<StoredSession> = z.object({
  url: z.string(),
  sequence: z.number().int(),
  events: z.array(captureEventSchema),
  dropped: z.number().int(),
});
const STORAGE_VERSION = 1;

/** Options for {@link TabSessionStore}. */
export interface TabSessionStoreOptions {
  /** Maximum events retained per tab (the ring-buffer cap; older events trim). */
  readonly maxEvents?: number;
}

/**
 * The per-tab capture session store (PRD 8.1), persisted through the storage port
 * in `storage.session` (see ADR 0012). It applies the ring-buffer cap
 * (`maxEvents`), records the pipeline's cumulative dropped count from each batch,
 * and keeps a monotonic sequence so out-of-order batches are ignored. Because it
 * lives in `storage.session`, it survives a service-worker restart.
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
   * Applies a batch, appending its events and recording the dropped count. A
   * batch whose sequence is not newer than the stored one is ignored
   * (out-of-order/stale) and returns `false`.
   */
  async applyBatch(batch: StoredBatch): Promise<Result<boolean, PlatformError>> {
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
      dropped: batch.dropped,
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
      dropped: options.preserveLog === true ? (previous?.dropped ?? 0) : 0,
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
