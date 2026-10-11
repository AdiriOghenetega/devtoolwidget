import type { NetworkEntry } from '../../domain/network';
import type { InsightRule } from '../../domain/insight';
import { capEvidence, makeFinding } from './support';

function withinWindow(entries: readonly NetworkEntry[], window: number): boolean {
  if (window <= 0) {
    return true;
  }
  const times = entries.map((entry) => entry.startedAt ?? Number.NaN);
  if (times.some((time) => Number.isNaN(time))) {
    // Without timestamps the window cannot be checked; treat repeats as duplicates.
    return true;
  }
  return Math.max(...times) - Math.min(...times) <= window;
}

/**
 * R06 Duplicate requests (PRD section 10): the same method and URL requested
 * more than once within the duplicate-request window (`startedAt` timestamps).
 */
export const r06DuplicateRequests: InsightRule = {
  id: 'R06',
  category: 'network',
  evaluate(input, thresholds) {
    const groups = new Map<string, NetworkEntry[]>();
    for (const entry of input.network) {
      const key = `${entry.method} ${entry.url}`;
      const list = groups.get(key) ?? [];
      list.push(entry);
      groups.set(key, list);
    }
    const window = Number(thresholds.duplicateRequestWindow);
    const duplicates: string[] = [];
    for (const [key, entries] of groups) {
      if (entries.length > 1 && withinWindow(entries, window)) {
        duplicates.push(`${String(entries.length)}× ${key}`);
      }
    }
    if (duplicates.length === 0) {
      return [];
    }
    return [
      makeFinding({
        ruleId: 'R06',
        category: 'network',
        severity: 'warning',
        key: 'duplicates',
        title: `${String(duplicates.length)} duplicated request${duplicates.length === 1 ? '' : 's'}`,
        evidence: capEvidence(duplicates),
        suggestion: 'Deduplicate or cache repeated requests within a short window.',
        impact: Math.min(50, 15 + duplicates.length * 6),
      }),
    ];
  },
};
