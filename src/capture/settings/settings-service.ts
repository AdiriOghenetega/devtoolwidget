import { z } from 'zod';
import {
  DEFAULT_SETTINGS,
  migrateSettings,
  type Result,
  type Settings,
  type SettingsError,
} from '../../core';
import type { PlatformError, StoragePort } from '../../platform/ports';

/** Storage key for the settings document. */
export const SETTINGS_STORAGE_KEY = 'settings';
const STORAGE_FORMAT_VERSION = 1;
const rawSchema = z.unknown();

/** A settings operation result: transport (platform) or validation (settings) errors. */
export type SettingsResult<T> = Result<T, PlatformError | SettingsError>;

/**
 * Persists settings through the storage port (PRD 8.5). The stored value is the
 * whole settings document including its own `schemaVersion`; {@link migrateSettings}
 * upgrades older documents on load. Pure schema/migration logic lives in `core`.
 */
export class SettingsService {
  readonly #storage: StoragePort;

  constructor(storage: StoragePort) {
    this.#storage = storage;
  }

  /** Loads settings, writing and returning defaults on first run. */
  async load(): Promise<SettingsResult<Settings>> {
    const read = await this.#storage.read('local', SETTINGS_STORAGE_KEY, {
      version: STORAGE_FORMAT_VERSION,
      schema: rawSchema,
    });
    if (!read.ok) {
      return read;
    }
    if (read.value === undefined) {
      const saved = await this.save(DEFAULT_SETTINGS);
      return saved.ok ? { ok: true, value: DEFAULT_SETTINGS } : saved;
    }
    return migrateSettings(read.value);
  }

  /** Persists the given settings. */
  async save(settings: Settings): Promise<SettingsResult<void>> {
    return this.#storage.write(
      'local',
      SETTINGS_STORAGE_KEY,
      { version: STORAGE_FORMAT_VERSION, schema: rawSchema },
      settings,
    );
  }

  /** Loads, applies a synchronous mutator, and saves. */
  async update(mutator: (settings: Settings) => Settings): Promise<SettingsResult<Settings>> {
    const loaded = await this.load();
    if (!loaded.ok) {
      return loaded;
    }
    const next = mutator(loaded.value);
    const saved = await this.save(next);
    return saved.ok ? { ok: true, value: next } : saved;
  }
}
