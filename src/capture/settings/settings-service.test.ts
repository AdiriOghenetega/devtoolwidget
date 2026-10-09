import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../core';
import { createFakeStoragePort } from '../../platform/fakes';
import { SETTINGS_STORAGE_KEY, SettingsService } from './settings-service';

describe('SettingsService', () => {
  it('writes and returns defaults on first run', async () => {
    const storage = createFakeStoragePort();
    const loaded = await new SettingsService(storage).load();

    expect(loaded).toEqual({ ok: true, value: DEFAULT_SETTINGS });
    expect(storage.snapshot('local')[SETTINGS_STORAGE_KEY]).toBeDefined();
  });

  it('round-trips saved settings', async () => {
    const storage = createFakeStoragePort();
    const service = new SettingsService(storage);
    const next = { ...DEFAULT_SETTINGS, theme: 'dark' as const };

    expect((await service.save(next)).ok).toBe(true);
    const loaded = await service.load();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.theme).toBe('dark');
    }
  });

  it('migrates a legacy stored document on load', async () => {
    const storage = createFakeStoragePort();
    storage.seed('local', SETTINGS_STORAGE_KEY, { version: 1, value: { capture: 'deep' } });

    const loaded = await new SettingsService(storage).load();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.captureLevel).toBe('deep');
      expect(loaded.value.schemaVersion).toBe(1);
    }
  });

  it('updates settings through a mutator', async () => {
    const service = new SettingsService(createFakeStoragePort());

    const updated = await service.update((settings) => ({
      ...settings,
      onboardingCompleted: true,
    }));
    expect(updated.ok).toBe(true);

    const reloaded = await service.load();
    expect(reloaded.ok).toBe(true);
    if (reloaded.ok) {
      expect(reloaded.value.onboardingCompleted).toBe(true);
    }
  });
});
