import {
  disableCacheRuleId,
  ok,
  planDisableCache,
  reconcileDisableCacheRules,
  resolveThrottleProfile,
  toTabId,
  type Result,
  type SessionRule,
  type TabId,
  type ThrottleProfile,
  type ThrottleResolution,
} from '../../core';
import type { NetworkRule, NetworkRulesPort, PlatformError, TabsPort } from '../../platform/ports';

/** Dependencies for {@link TabNetworkController}. */
export interface TabNetworkControllerDeps {
  readonly tabs: TabsPort;
  readonly rules: NetworkRulesPort;
}

function toSessionRules(rules: readonly NetworkRule[]): SessionRule[] {
  return rules
    .filter((rule) => rule.action.type === 'modifyHeaders' && rule.condition.tabIds !== undefined)
    .map((rule) => ({
      id: rule.id,
      priority: rule.priority,
      action: { type: 'modifyHeaders' as const },
      condition: { tabIds: rule.condition.tabIds ?? [] },
    }));
}

/**
 * Tab-scoped network controls (PRD FR-7): hard reload with cache bypass, a
 * per-tab disable-cache session rule with idempotent toggles and lifecycle
 * cleanup, and typed throttle resolution (soft fetch/XHR approximation vs deep
 * CDP). No browser API is touched directly; it goes through the ports.
 */
export class TabNetworkController {
  readonly #tabs: TabsPort;
  readonly #rules: NetworkRulesPort;

  constructor(deps: TabNetworkControllerDeps) {
    this.#tabs = deps.tabs;
    this.#rules = deps.rules;
  }

  /** Reloads a tab bypassing the HTTP cache. */
  hardReload(tabId: TabId): Promise<Result<void, PlatformError>> {
    return this.#tabs.reload(tabId, { bypassCache: true });
  }

  /** Enables or disables the per-tab disable-cache session rule (idempotent). */
  async setDisableCache(tabId: TabId, enabled: boolean): Promise<Result<void, PlatformError>> {
    const existing = await this.#rules.getSessionRules();
    if (!existing.ok) {
      return existing;
    }
    const change = planDisableCache(toSessionRules(existing.value), tabId, enabled);
    return this.#applyChange(change.removeRuleIds, change.addRules);
  }

  /** Removes the tab's disable-cache rule (called on tab close). */
  cleanup(tabId: TabId): Promise<Result<void, PlatformError>> {
    return this.#applyChange([disableCacheRuleId(tabId)], undefined);
  }

  /**
   * Reconciles disable-cache rules with the currently open tabs. Called on
   * extension restart so leftover session rules for closed tabs are removed.
   */
  async sync(liveTabIds: readonly number[]): Promise<Result<void, PlatformError>> {
    const existing = await this.#rules.getSessionRules();
    if (!existing.ok) {
      return existing;
    }
    const change = reconcileDisableCacheRules(toSessionRules(existing.value), liveTabIds);
    return this.#applyChange(change.removeRuleIds, change.addRules);
  }

  /** Resolves a throttle profile to its soft/deep support (pure). */
  setThrottle(profile: ThrottleProfile, customDelayMs?: number): ThrottleResolution {
    return resolveThrottleProfile(profile, customDelayMs);
  }

  async #applyChange(
    removeRuleIds: readonly number[] | undefined,
    addRules: readonly SessionRule[] | undefined,
  ): Promise<Result<void, PlatformError>> {
    const hasRemove = (removeRuleIds?.length ?? 0) > 0;
    const hasAdd = (addRules?.length ?? 0) > 0;
    if (!hasRemove && !hasAdd) {
      return ok(undefined);
    }
    return this.#rules.updateSessionRules({
      ...(removeRuleIds !== undefined && hasRemove ? { removeRuleIds } : {}),
      ...(addRules !== undefined && hasAdd
        ? {
            addRules: addRules.map((rule) => ({
              id: rule.id,
              priority: rule.priority,
              action: { type: rule.action.type },
              condition: { tabIds: rule.condition.tabIds.map((id) => toTabId(id)) },
            })),
          }
        : {}),
    });
  }
}
