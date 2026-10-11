import { MAX_SNAPSHOTS } from '../domain/constants';

/**
 * Plain TypeScript settings types (no runtime schema). `core` must have no
 * runtime Zod dependency (ADR 0018), so the Zod schemas that validate stored
 * settings live in `protocol/settings.ts`, the storage trust boundary.
 */

/** Current persisted settings schema version. Bump with a migration. */
export const SETTINGS_SCHEMA_VERSION = 1;

/** How much the widget captures (PRD FR-11). */
export type CaptureLevel = 'minimal' | 'standard' | 'deep';

/** The widget theme (PRD FR-11). */
export type Theme = 'system' | 'light' | 'dark';

/** Per-origin capture overrides (PRD FR-11). */
export interface OriginProfile {
  readonly captureLevel: CaptureLevel;
  readonly bodyCapture: boolean;
}

/** A single metric's threshold override: unspecified fields keep defaults. */
export interface MetricThresholdOverride {
  readonly needsImprovement?: number;
  readonly poor?: number;
}

/** Sparse insight threshold overrides (PRD section 10). */
export interface ThresholdOverrides {
  readonly slowRequestTotal?: number;
  readonly slowRequestTtfb?: number;
  readonly largePayload?: number;
  readonly largeImage?: number;
  readonly uncompressedText?: number;
  readonly duplicateRequestWindow?: number;
  readonly maxRequests?: number;
  readonly maxDistinctOrigins?: number;
  readonly lcp?: MetricThresholdOverride;
  readonly cls?: MetricThresholdOverride;
  readonly inp?: MetricThresholdOverride;
  readonly totalBlockingTime?: { readonly warning?: number; readonly critical?: number };
  readonly storage?: {
    readonly localStorage?: number;
    readonly indexedDB?: number;
    readonly cookies?: number;
  };
}

/** A user redaction rule; `pattern` is a source string compiled to a global RegExp. */
export interface RedactionRuleSetting {
  readonly name: string;
  readonly pattern: string;
  readonly replacement?: string;
}

/** The full persisted settings document. */
export interface Settings {
  readonly schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
  readonly captureLevel: CaptureLevel;
  readonly perOriginProfiles: Readonly<Record<string, OriginProfile>>;
  readonly thresholds: ThresholdOverrides;
  readonly redactionRules: readonly RedactionRuleSetting[];
  readonly retention: {
    readonly maxSnapshots: number;
    readonly maxAgeDays: number;
  };
  readonly theme: Theme;
  readonly shortcuts: Readonly<Record<string, string | null>>;
  readonly onboardingCompleted: boolean;
}

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
