import { z } from 'zod';
import { MAX_SNAPSHOTS } from '../domain/constants';

/** Current persisted settings schema version. Bump with a migration. */
export const SETTINGS_SCHEMA_VERSION = 1;

export const captureLevelSchema = z.enum(['minimal', 'standard', 'deep']);
export type CaptureLevel = z.infer<typeof captureLevelSchema>;

export const themeSchema = z.enum(['system', 'light', 'dark']);
export type Theme = z.infer<typeof themeSchema>;

/** Per-origin capture overrides (PRD FR-11). */
export const originProfileSchema = z.object({
  captureLevel: captureLevelSchema,
  bodyCapture: z.boolean(),
});
export type OriginProfile = z.infer<typeof originProfileSchema>;

const metricThresholdOverrideSchema = z.object({
  needsImprovement: z.number().optional(),
  poor: z.number().optional(),
});

/** Sparse insight threshold overrides (PRD section 10); unspecified fields keep defaults. */
export const thresholdOverridesSchema = z.object({
  slowRequestTotal: z.number().optional(),
  slowRequestTtfb: z.number().optional(),
  largePayload: z.number().optional(),
  largeImage: z.number().optional(),
  uncompressedText: z.number().optional(),
  duplicateRequestWindow: z.number().optional(),
  maxRequests: z.number().int().optional(),
  maxDistinctOrigins: z.number().int().optional(),
  lcp: metricThresholdOverrideSchema.optional(),
  cls: metricThresholdOverrideSchema.optional(),
  inp: metricThresholdOverrideSchema.optional(),
  totalBlockingTime: z
    .object({ warning: z.number().optional(), critical: z.number().optional() })
    .optional(),
  storage: z
    .object({
      localStorage: z.number().optional(),
      indexedDB: z.number().optional(),
      cookies: z.number().optional(),
    })
    .optional(),
});
export type ThresholdOverrides = z.infer<typeof thresholdOverridesSchema>;

/** A user redaction rule; `pattern` is a source string compiled to a global RegExp. */
export const redactionRuleSettingSchema = z.object({
  name: z.string().min(1),
  pattern: z.string().min(1),
  replacement: z.string().optional(),
});
export type RedactionRuleSetting = z.infer<typeof redactionRuleSettingSchema>;

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
export type Settings = z.infer<typeof settingsSchema>;

/** Default settings (body capture and onboarding are off/not done by default, PRD 7/14). */
export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  captureLevel: 'standard',
  perOriginProfiles: {},
  thresholds: {},
  redactionRules: [],
  retention: { maxSnapshots: MAX_SNAPSHOTS, maxAgeDays: 30 },
  theme: 'system',
  shortcuts: {},
  onboardingCompleted: false,
};
