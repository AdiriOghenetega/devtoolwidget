/** A minimal Declarative Net Request session rule (structural). */
export interface SessionRule {
  readonly id: number;
  readonly priority: number;
  readonly action: { readonly type: 'modifyHeaders' };
  readonly condition: { readonly tabIds: readonly number[] };
}

/** Base id for tab-scoped disable-cache rules; keeps ids in a reserved range. */
export const DISABLE_CACHE_RULE_BASE = 1_000_000;

/** Deterministic session-rule id for a tab's disable-cache rule. */
export function disableCacheRuleId(tabId: number): number {
  return DISABLE_CACHE_RULE_BASE + tabId;
}

/** Recovers the tab id from a disable-cache rule id, or `undefined`. */
export function tabIdOfDisableCacheRule(ruleId: number): number | undefined {
  return ruleId >= DISABLE_CACHE_RULE_BASE ? ruleId - DISABLE_CACHE_RULE_BASE : undefined;
}

/** Builds the tab-scoped disable-cache session rule. */
export function buildDisableCacheRule(tabId: number): SessionRule {
  return {
    id: disableCacheRuleId(tabId),
    priority: 1,
    action: { type: 'modifyHeaders' },
    condition: { tabIds: [tabId] },
  };
}

/** The change to apply to session rules. */
export interface SessionRuleChange {
  readonly removeRuleIds?: readonly number[];
  readonly addRules?: readonly SessionRule[];
}

/**
 * Plans an idempotent enable/disable of the per-tab disable-cache rule. A
 * duplicate toggle (enable when already enabled, or disable when absent)
 * produces an empty change. Pure.
 */
export function planDisableCache(
  existingRules: readonly SessionRule[],
  tabId: number,
  enabled: boolean,
): SessionRuleChange {
  const ruleId = disableCacheRuleId(tabId);
  const present = existingRules.some((rule) => rule.id === ruleId);
  if (enabled && !present) {
    return { addRules: [buildDisableCacheRule(tabId)] };
  }
  if (!enabled && present) {
    return { removeRuleIds: [ruleId] };
  }
  return {};
}

/**
 * Plans removal of disable-cache rules for tabs that are no longer open. Used on
 * tab close and on extension restart to reconcile leftover session rules. Pure.
 */
export function reconcileDisableCacheRules(
  existingRules: readonly SessionRule[],
  liveTabIds: readonly number[],
): SessionRuleChange {
  const live = new Set(liveTabIds);
  const removeRuleIds: number[] = [];
  for (const rule of existingRules) {
    const tabId = tabIdOfDisableCacheRule(rule.id);
    if (tabId !== undefined && !live.has(tabId)) {
      removeRuleIds.push(rule.id);
    }
  }
  return removeRuleIds.length === 0 ? {} : { removeRuleIds };
}
