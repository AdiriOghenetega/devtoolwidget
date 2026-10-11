import { z } from 'zod';
import {
  applyRetention,
  RETAINED_SNAPSHOTS,
  toMillis,
  type Finding,
  type Result,
  type SavedSnapshot,
} from '../../core';
import type { PlatformError, StoragePort } from '../../platform/ports';

const SNAPSHOTS_KEY = 'snapshots';
const STORAGE_VERSION = 1;

const snapshotSchema = z.object({
  id: z.string(),
  label: z.string(),
  createdAt: z.number(),
  metrics: z.record(z.string(), z.number()),
  findings: z.array(z.record(z.string(), z.unknown())),
});
const snapshotsSchema = z.array(snapshotSchema);

/** Options for {@link SnapshotStore}. */
export interface SnapshotStoreOptions {
  readonly maxSnapshots?: number;
}

/**
 * Persists saved snapshots through the storage port with a schema version
 * (PRD FR-9). The list is capped by the retention policy on every write, so it
 * never grows past {@link RETAINED_SNAPSHOTS} by default.
 */
export class SnapshotStore {
  readonly #storage: StoragePort;
  readonly #max: number;

  constructor(storage: StoragePort, options: SnapshotStoreOptions = {}) {
    this.#storage = storage;
    this.#max = options.maxSnapshots ?? RETAINED_SNAPSHOTS;
  }

  /** Reads the stored snapshots (newest first). */
  async list(): Promise<Result<readonly SavedSnapshot[], PlatformError>> {
    const read = await this.#storage.read('local', SNAPSHOTS_KEY, {
      version: STORAGE_VERSION,
      schema: snapshotsSchema,
    });
    if (!read.ok) {
      return read;
    }
    const stored = read.value ?? [];
    return {
      ok: true,
      value: stored.map((entry) => ({
        id: entry.id,
        label: entry.label,
        createdAt: toMillis(entry.createdAt),
        metrics: entry.metrics,
        findings: entry.findings as unknown as readonly Finding[],
      })),
    };
  }

  /** Saves a snapshot, applying the retention policy. */
  async save(snapshot: SavedSnapshot): Promise<Result<void, PlatformError>> {
    const existing = await this.list();
    if (!existing.ok) {
      return existing;
    }
    const retained = applyRetention([snapshot, ...existing.value], this.#max);
    return this.#write(retained);
  }

  /** Removes one snapshot by id. */
  async remove(id: string): Promise<Result<void, PlatformError>> {
    const existing = await this.list();
    if (!existing.ok) {
      return existing;
    }
    return this.#write(existing.value.filter((snapshot) => snapshot.id !== id));
  }

  /** Removes every snapshot. */
  async clear(): Promise<Result<void, PlatformError>> {
    return this.#write([]);
  }

  #write(snapshots: readonly SavedSnapshot[]): Promise<Result<void, PlatformError>> {
    return this.#storage.write(
      'local',
      SNAPSHOTS_KEY,
      { version: STORAGE_VERSION, schema: snapshotsSchema },
      snapshots.map((snapshot) => ({
        id: snapshot.id,
        label: snapshot.label,
        createdAt: Number(snapshot.createdAt),
        metrics: snapshot.metrics,
        findings: snapshot.findings as unknown as Record<string, unknown>[],
      })),
    );
  }
}
