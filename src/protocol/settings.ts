import { z } from 'zod';
import {
  DEFAULT_SETTINGS,
  SETTINGS_SCHEMA_VERSION,
  err,
  ok,
  type Result,
  type Settings,
} from '../core';

/**
 * Zod schemas for persisted settings and the migration chain that produces a
 * current {@link Settings} document. These are a **storage trust boundary**
 * (ADR 0009), so they live in `protocol`, not `core`: `core` keeps only the plain
 * TypeScript types and has no runtime Zod dependency (ADR 0018).
 */

export const captureLevelSchema = z.enum(['minimal', 'standard', 'deep']);
export const themeSchema = z.enum(['system', 'light', 'dark']);

/** Per-origin capture overrides (PRD FR-11). */
export const originProfileSchema = z.object({
  captureLevel: captureLevelSchema,
  bodyCapture: z.boolean(),
});

const metricThresholdOverrideSchema = z.object({
  needsImprovement: z.number().exactOptional(),
  poor: z.number().exactOptional(),
});

/** Sparse insight threshold overrides (PRD section 10); unspecified fields keep defaults. */
export const thresholdOverridesSchema = z.object({
  slowRequestTotal: z.number().exactOptional(),
  slowRequestTtfb: z.number().exactOptional(),
  largePayload: z.number().exactOptional(),
  largeImage: z.number().exactOptional(),
  uncompressedText: z.number().exactOptional(),
  duplicateRequestWindow: z.number().exactOptional(),
  maxRequests: z.number().int().exactOptional(),
  maxDistinctOrigins: z.number().int().exactOptional(),
  lcp: metricThresholdOverrideSchema.exactOptional(),
  cls: metricThresholdOverrideSchema.exactOptional(),
  inp: metricThresholdOverrideSchema.exactOptional(),
  totalBlockingTime: z
    .object({ warning: z.number().exactOptional(), critical: z.number().exactOptional() })
    .exactOptional(),
  storage: z
    .object({
      localStorage: z.number().exactOptional(),
      indexedDB: z.number().exactOptional(),
      cookies: z.number().exactOptional(),
    })
    .exactOptional(),
});

/** A user redaction rule; `pattern` is a source string compiled to a global RegExp. */
export const redactionRuleSettingSchema = z.object({
  name: z.string().min(1),
  pattern: z.string().min(1),
  replacement: z.string().exactOptional(),
});

/** The full persisted settings document. */
export const settingsSchema = z.object({
  schemaVersion: z.literal(SETTINGS_SCHEMA_VERSION),
  captureLevel: captureLevelSchema,
  perOriginProfiles: z.record(z.string(), originProfileSchema),
  thresholds: thresholdOverridesSchema,
  redactionRules: z.array(redactionRuleSettingSchema),
  retention: z.object({
    maxSnapshots: z.number().int().positive(),
    maxAgeDays: z.number().int().positive(),
  }),
  theme: themeSchema,
  shortcuts: z.record(z.string(), z.string().nullable()),
  onboardingCompleted: z.boolean(),
});

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
