import { toBytes, toMillis } from '../domain/brands';
import { DEFAULT_THRESHOLDS, type MetricThreshold, type Thresholds } from '../domain/constants';
import type { Settings, ThresholdOverrides } from './schema';

function mergeMetric(
  base: MetricThreshold,
  override:
    | { readonly needsImprovement?: number | undefined; readonly poor?: number | undefined }
    | undefined,
): MetricThreshold {
  if (override === undefined) {
    return base;
  }
  return {
    needsImprovement: override.needsImprovement ?? base.needsImprovement,
    poor: override.poor ?? base.poor,
  };
}

/** Applies sparse overrides on top of a base {@link Thresholds}, re-branding numbers. */
export function applyThresholdOverrides(
  base: Thresholds,
  overrides: ThresholdOverrides,
): Thresholds {
  return {
    slowRequestTotal:
      overrides.slowRequestTotal === undefined
        ? base.slowRequestTotal
        : toMillis(overrides.slowRequestTotal),
    slowRequestTtfb:
      overrides.slowRequestTtfb === undefined
        ? base.slowRequestTtfb
        : toMillis(overrides.slowRequestTtfb),
    largePayload:
      overrides.largePayload === undefined ? base.largePayload : toBytes(overrides.largePayload),
    largeImage:
      overrides.largeImage === undefined ? base.largeImage : toBytes(overrides.largeImage),
    uncompressedText:
      overrides.uncompressedText === undefined
        ? base.uncompressedText
        : toBytes(overrides.uncompressedText),
    duplicateRequestWindow:
      overrides.duplicateRequestWindow === undefined
        ? base.duplicateRequestWindow
        : toMillis(overrides.duplicateRequestWindow),
    maxRequests: overrides.maxRequests ?? base.maxRequests,
    maxDistinctOrigins: overrides.maxDistinctOrigins ?? base.maxDistinctOrigins,
    lcp: mergeMetric(base.lcp, overrides.lcp),
    cls: mergeMetric(base.cls, overrides.cls),
    inp: mergeMetric(base.inp, overrides.inp),
    totalBlockingTime: {
      warning:
        overrides.totalBlockingTime?.warning === undefined
          ? base.totalBlockingTime.warning
          : toMillis(overrides.totalBlockingTime.warning),
      critical:
        overrides.totalBlockingTime?.critical === undefined
          ? base.totalBlockingTime.critical
          : toMillis(overrides.totalBlockingTime.critical),
    },
    storage: {
      localStorage:
        overrides.storage?.localStorage === undefined
          ? base.storage.localStorage
          : toBytes(overrides.storage.localStorage),
      indexedDB:
        overrides.storage?.indexedDB === undefined
          ? base.storage.indexedDB
          : toBytes(overrides.storage.indexedDB),
      cookies:
        overrides.storage?.cookies === undefined
          ? base.storage.cookies
          : toBytes(overrides.storage.cookies),
    },
  };
}

/** Resolves the effective thresholds for the given settings. */
export function resolveThresholds(settings: Settings): Thresholds {
  return applyThresholdOverrides(DEFAULT_THRESHOLDS, settings.thresholds);
}
