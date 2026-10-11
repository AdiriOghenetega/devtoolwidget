import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_SCHEMA_VERSION } from '../../core';
import { migrateSettings } from '../../protocol';
import { exportSettings, importSettings } from './settings-io';

describe('settings export/import', () => {
  it('exports settings as JSON containing the schema version', () => {
    const text = exportSettings(DEFAULT_SETTINGS);
    expect(JSON.parse(text)).toMatchObject({ schemaVersion: SETTINGS_SCHEMA_VERSION });
  });

  it('round-trips current settings', () => {
    const result = importSettings(exportSettings(DEFAULT_SETTINGS));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('migrates an older document on import', () => {
    const result = importSettings(JSON.stringify({ capture: 'deep', theme: 'dark' }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.schemaVersion).toBe(1);
      expect(result.value.captureLevel).toBe('deep');
    }
  });

  it('rejects malformed JSON', () => {
    const result = importSettings('{ not json');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-json');
    }
  });

  it('rejects a document that fails schema validation', () => {
    const result = importSettings(JSON.stringify({ ...DEFAULT_SETTINGS, captureLevel: 'nope' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-settings');
    }
  });

  it('rejects a document from a newer schema version', () => {
    const result = importSettings(JSON.stringify({ ...DEFAULT_SETTINGS, schemaVersion: 99 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-settings');
    }
    expect(migrateSettings({ ...DEFAULT_SETTINGS, schemaVersion: 99 }).ok).toBe(false);
  });
});
