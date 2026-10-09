import { describe, expect, it } from 'vitest';
import {
  buildDisableCacheRule,
  disableCacheRuleId,
  planDisableCache,
  reconcileDisableCacheRules,
  tabIdOfDisableCacheRule,
  type SessionRule,
} from './disable-cache-rules';

describe('disable-cache rule ids', () => {
  it('maps tab ids to rule ids and back', () => {
    expect(disableCacheRuleId(7)).toBe(1_000_007);
    expect(tabIdOfDisableCacheRule(1_000_007)).toBe(7);
    expect(tabIdOfDisableCacheRule(5)).toBeUndefined();
  });

  it('builds a tab-scoped rule', () => {
    expect(buildDisableCacheRule(3)).toEqual({
      id: 1_000_003,
      priority: 1,
      action: { type: 'modifyHeaders' },
      condition: { tabIds: [3] },
    });
  });
});

describe('planDisableCache', () => {
  it('is idempotent for duplicate toggles', () => {
    const rule = buildDisableCacheRule(1);
    expect(planDisableCache([], 1, false)).toEqual({});
    expect(planDisableCache([rule], 1, true)).toEqual({});
    expect(planDisableCache([], 1, true)).toEqual({ addRules: [rule] });
    expect(planDisableCache([rule], 1, false)).toEqual({ removeRuleIds: [1_000_001] });
  });
});

describe('reconcileDisableCacheRules', () => {
  const rules: SessionRule[] = [
    buildDisableCacheRule(1),
    buildDisableCacheRule(2),
    buildDisableCacheRule(3),
  ];

  it('removes rules for tabs that are no longer open', () => {
    expect(reconcileDisableCacheRules(rules, [1, 3])).toEqual({ removeRuleIds: [1_000_002] });
  });

  it('is a no-op when every tab is still open (restart keeps rules)', () => {
    expect(reconcileDisableCacheRules(rules, [1, 2, 3])).toEqual({});
  });
});
