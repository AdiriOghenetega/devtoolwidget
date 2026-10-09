import {
  decideFirstRun,
  type FirstRunDecision,
  type InstalledReason,
  type Result,
  type SettingsError,
} from '../../core';
import type { PlatformError } from '../../platform/ports';
import type { SettingsService } from '../settings/settings-service';

/**
 * The background first-run flow (PRD FR-14): loads settings and returns the typed
 * decision of whether to show onboarding. Pure-ish (only storage I/O), so it is
 * unit-testable with the storage fake.
 */
export async function runFirstRun(
  settings: SettingsService,
  installedReason: InstalledReason,
): Promise<Result<FirstRunDecision, PlatformError | SettingsError>> {
  const loaded = await settings.load();
  if (!loaded.ok) {
    return loaded;
  }
  return { ok: true, value: decideFirstRun({ settings: loaded.value, installedReason }) };
}
