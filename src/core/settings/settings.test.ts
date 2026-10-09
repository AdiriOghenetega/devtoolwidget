import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../domain/constants';
import {
  DEFAULT_SETTINGS,
  SETTINGS_SCHEMA_VERSION,
  applyThresholdOverrides,
  decideFirstRun,
  migrateSettings,
  resolveThresholds,
} from './index';

describe('settings schema defaults', () => {
  it('uses safe defaults', () => {
    expect(DEFAULT_SETTINGS.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
    expect(DEFAULT_SETTINGS.captureLevel).toBe('standard');
    expect(DEFAULT_SETTINGS.onboardingCompleted).toBe(false);
    expect(DEFAULT_SETTINGS.retention.maxSnapshots).toBeGreaterThan(0);
  });
});

describe('migrateSettings', () => {
  it('migrates a legacy v0 document to the current version', () => {
    const result = migrateSettings({ capture: 'deep', theme: 'dark' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.schemaVersion).toBe(1);
      expect(result.value.captureLevel).toBe('deep');
      expect(result.value.theme).toBe('dark');
    }
  });

  it('accepts a current document unchanged', () => {
    const result = migrateSettings(DEFAULT_SETTINGS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('rejects a document from a newer version', () => {
    const result = migrateSettings({ ...DEFAULT_SETTINGS, schemaVersion: 99 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unsupported-version');
    }
  });

  it('rejects non-objects and invalid fields', () => {
    expect(migrateSettings(null).ok).toBe(false);
    const invalid = migrateSettings({ ...DEFAULT_SETTINGS, captureLevel: 'nope' });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error.code).toBe('invalid');
    }
  });
});

describe('threshold overrides', () => {
  it('is the identity for empty overrides', () => {
    expect(applyThresholdOverrides(DEFAULT_THRESHOLDS, {})).toEqual(DEFAULT_THRESHOLDS);
  });

  it('overrides selected thresholds and keeps the rest', () => {
    const resolved = resolveThresholds({
      ...DEFAULT_SETTINGS,
      thresholds: { slowRequestTotal: 500, lcp: { poor: 5_000 } },
    });
    expect(resolved.slowRequestTotal).toBe(500);
    expect(resolved.lcp.poor).toBe(5_000);
    expect(resolved.lcp.needsImprovement).toBe(DEFAULT_THRESHOLDS.lcp.needsImprovement);
    expect(resolved.maxRequests).toBe(DEFAULT_THRESHOLDS.maxRequests);
  });

  it('applies every override field', () => {
    const resolved = resolveThresholds({
      ...DEFAULT_SETTINGS,
      thresholds: {
        slowRequestTotal: 1,
        slowRequestTtfb: 2,
        largePayload: 3,
        largeImage: 4,
        uncompressedText: 5,
        duplicateRequestWindow: 6,
        maxRequests: 7,
        maxDistinctOrigins: 8,
        lcp: { needsImprovement: 9, poor: 10 },
        cls: { needsImprovement: 11, poor: 12 },
        inp: { needsImprovement: 13, poor: 14 },
        totalBlockingTime: { warning: 15, critical: 16 },
        storage: { localStorage: 17, indexedDB: 18, cookies: 19 },
      },
    });
    expect(resolved.slowRequestTtfb).toBe(2);
    expect(resolved.totalBlockingTime.critical).toBe(16);
    expect(resolved.cls.poor).toBe(12);
    expect(resolved.inp.needsImprovement).toBe(13);
    expect(resolved.storage.cookies).toBe(19);
  });
});

describe('decideFirstRun', () => {
  it('shows onboarding on first install', () => {
    expect(decideFirstRun({ settings: DEFAULT_SETTINGS, installedReason: 'install' })).toEqual({
      showOnboarding: true,
      reason: 'first-install',
    });
  });

  it('does not show onboarding once completed', () => {
    const done = { ...DEFAULT_SETTINGS, onboardingCompleted: true };
    expect(decideFirstRun({ settings: done, installedReason: 'startup' })).toEqual({
      showOnboarding: false,
      reason: 'completed',
    });
  });

  it('shows onboarding for a not-yet-completed flow', () => {
    expect(decideFirstRun({ settings: DEFAULT_SETTINGS, installedReason: 'startup' }).reason).toBe(
      'not-completed',
    );
  });
});
