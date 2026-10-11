import type { ConsoleEntry } from '../../domain/console';
import type { InsightRule } from '../../domain/insight';
import { capEvidence, makeFinding } from './support';

function isErrorEntry(entry: ConsoleEntry): boolean {
  return entry.kind === 'uncaught' || entry.kind === 'rejection' || entry.level === 'error';
}

/**
 * R13 Console errors (PRD section 10): uncaught errors, rejections and repeated
 * console errors, grouped by kind and level with counts. Degrades to no findings
 * when there are no console entries.
 */
export const r13ConsoleErrors: InsightRule = {
  id: 'R13',
  category: 'console',
  evaluate(input) {
    const errors = input.console.filter((entry) => isErrorEntry(entry));
    if (errors.length === 0) {
      return [];
    }
    const groups = new Map<string, number>();
    for (const entry of errors) {
      const key = `${entry.kind} (${entry.level})`;
      groups.set(key, (groups.get(key) ?? 0) + entry.count);
    }
    const severe = errors.some((entry) => entry.kind === 'uncaught' || entry.kind === 'rejection');
    const ranked = [...groups.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => `${key} ×${String(count)}`);
    return [
      makeFinding({
        ruleId: 'R13',
        category: 'console',
        severity: severe ? 'critical' : 'warning',
        key: 'errors',
        title: `${String(errors.length)} console error${errors.length === 1 ? '' : 's'}`,
        evidence: capEvidence(ranked),
        suggestion: 'Fix the reported console errors; repeated errors usually share one cause.',
        impact: severe ? 70 : 40,
      }),
    ];
  },
};
