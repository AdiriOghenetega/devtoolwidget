import type { Settings } from './schema';

/** Why the extension worker started (mirrors `runtime.onInstalled` reasons). */
export type InstalledReason = 'install' | 'update' | 'startup' | 'unknown';

/** Inputs to the first-run decision. */
export interface FirstRunContext {
  readonly settings: Settings;
  readonly installedReason: InstalledReason;
}

/** The typed first-run decision used by the background (PRD FR-14). */
export interface FirstRunDecision {
  readonly showOnboarding: boolean;
  readonly reason: 'first-install' | 'not-completed' | 'completed';
}

/**
 * Decides whether to show onboarding: never once completed, otherwise yes (and
 * the reason distinguishes a genuine first install from a not-yet-completed
 * flow). Pure so it can be unit-tested without the background.
 */
export function decideFirstRun(context: FirstRunContext): FirstRunDecision {
  if (context.settings.onboardingCompleted) {
    return { showOnboarding: false, reason: 'completed' };
  }
  return {
    showOnboarding: true,
    reason: context.installedReason === 'install' ? 'first-install' : 'not-completed',
  };
}
