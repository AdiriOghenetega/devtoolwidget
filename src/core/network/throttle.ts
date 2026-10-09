import type { ThrottleProfile } from '../domain/finding';

/** How faithfully a throttle profile can be applied. */
export type ThrottleSupport = 'soft' | 'deep';

/** A resolved throttle profile. */
export interface ThrottleResolution {
  readonly profile: ThrottleProfile;
  /**
   * `soft` is approximate: it only delays the instrumented fetch/XHR (not
   * subresources, images, CSS or the real connection). `deep` is accurate and
   * needs the CDP Debugger path (Chromium only).
   */
  readonly support: ThrottleSupport;
  /** For soft support: the artificial per-request delay in milliseconds. */
  readonly softDelayMs?: number;
}

const SOFT_DELAYS: Readonly<Record<ThrottleProfile, number>> = {
  offline: 0,
  'slow-3g': 2_000,
  'fast-3g': 500,
  '4g': 100,
  custom: 200,
};

/**
 * Resolves a throttle profile to its support level and, for soft support, an
 * approximate delay for the network collector's `artificialDelayMs`. Offline
 * cannot be simulated by delaying fetch/XHR, so it requires deep (CDP) support.
 * Pure.
 */
export function resolveThrottleProfile(
  profile: ThrottleProfile,
  customDelayMs?: number,
): ThrottleResolution {
  if (profile === 'offline') {
    return { profile, support: 'deep' };
  }
  const delay = profile === 'custom' ? (customDelayMs ?? SOFT_DELAYS.custom) : SOFT_DELAYS[profile];
  return { profile, support: 'soft', softDelayMs: delay };
}

/** True when a profile can be approximated by the soft (fetch/XHR) path. */
export function isSoftThrottle(profile: ThrottleProfile): boolean {
  return profile !== 'offline';
}
