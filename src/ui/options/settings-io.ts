import { err, ok, type Result, type Settings } from '../../core';
import { migrateSettings } from '../../protocol';

/** Why an import failed. */
export interface SettingsIoError {
  readonly code: 'invalid-json' | 'invalid-settings';
  readonly message: string;
}

/** Serializes settings for export (pretty JSON). Pure. */
export function exportSettings(settings: Settings): string {
  return JSON.stringify(settings, null, 2);
}

/**
 * Parses and validates imported settings text. The text must be JSON, and the
 * parsed document is run through {@link migrateSettings}, so valid older
 * documents are migrated and invalid ones are rejected with a reason. Never
 * throws.
 */
export function importSettings(text: string): Result<Settings, SettingsIoError> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return err({ code: 'invalid-json', message: 'Settings are not valid JSON' });
  }
  const migrated = migrateSettings(raw);
  return migrated.ok
    ? ok(migrated.value)
    : err({ code: 'invalid-settings', message: migrated.error.message });
}
