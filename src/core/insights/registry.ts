import type { InsightRule } from '../domain/insight';

/** A registry of insight rules keyed by id (PRD section 10). */
export interface InsightRuleRegistry {
  register(rule: InsightRule): void;
  get(id: string): InsightRule | undefined;
  all(): readonly InsightRule[];
}

/** Creates an insight rule registry, optionally seeded with rules. */
export function createInsightRuleRegistry(
  initial: readonly InsightRule[] = [],
): InsightRuleRegistry {
  const rules = new Map<string, InsightRule>();
  const registry: InsightRuleRegistry = {
    register(rule) {
      rules.set(rule.id, rule);
    },
    get(id) {
      return rules.get(id);
    },
    all() {
      return [...rules.values()];
    },
  };
  for (const rule of initial) {
    registry.register(rule);
  }
  return registry;
}
