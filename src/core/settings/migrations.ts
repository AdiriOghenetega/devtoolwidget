import { err, ok, type Result } from '../result';
import { DEFAULT_SETTINGS, SETTINGS_SCHEMA_VERSION, settingsSchema, type Settings } from './schema';

/** Why a stored settings document could not be turned into {@link Settings}. */
export interface SettingsError {
  readonly code: 'invalid' | 'unsupported-version';
  readonly message: string;
}

interface Migration {
  readonly from: number;
  readonly to: number;
  migrate(data: Readonly<Record<string, unknown>>): Record<string, unknown>;
}

/**
 * The ordered migration chain. Version 0 is the pre-versioning legacy shape
 * (`{ capture, theme, ... }` with no `schemaVersion`); each entry upgrades one
 * version. Add a new entry and bump `SETTINGS_SCHEMA_VERSION` for every change.
 */
const MIGRATIONS: readonly Migration[] = [
  {
    from: 0,
    to: 1,
    migrate(data) {
      const legacyCapture = typeof data.capture === 'string' ? data.capture : undefined;
      const captureLevel =
        typeof data.captureLevel === 'string'
          ? data.captureLevel
          : (legacyCapture ?? DEFAULT_SETTINGS.captureLevel);
      return {
        ...DEFAULT_SETTINGS,
        ...data,
        schemaVersion: 1,
        captureLevel,
        onboardingCompleted: data.onboardingCompleted === true,
      };
    },
  },
];

/**
 * Validates and migrates a raw stored settings value to the current schema.
 * Never throws. Unknown-but-parseable legacy fields are dropped by the schema.
 */
export function migrateSettings(raw: unknown): Result<Settings, SettingsError> {
  if (typeof raw !== 'object' || raw === null) {
    return err({ code: 'invalid', message: 'Settings must be an object' });
  }
  let data: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;

  if (version > SETTINGS_SCHEMA_VERSION) {
    return err({
      code: 'unsupported-version',
      message: `Settings version ${String(version)} is newer than supported ${String(SETTINGS_SCHEMA_VERSION)}`,
    });
  }

  while (version < SETTINGS_SCHEMA_VERSION) {
    const migration = MIGRATIONS.find((entry) => entry.from === version);
    if (migration === undefined) {
      return err({
        code: 'invalid',
        message: `No migration from settings version ${String(version)}`,
      });
    }
    data = migration.migrate(data);
    version = migration.to;
  }

  const parsed = settingsSchema.safeParse(data);
  return parsed.success
    ? ok(parsed.data)
    : err({ code: 'invalid', message: 'Settings failed schema validation' });
}
