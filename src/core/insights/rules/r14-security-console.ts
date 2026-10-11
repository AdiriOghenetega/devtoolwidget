import type { ConsoleEntry } from '../../domain/console';
import type { InsightRule } from '../../domain/insight';
import { capEvidence, makeFinding } from './support';

function isSecurityEntry(entry: ConsoleEntry): boolean {
  return entry.kind === 'csp' || entry.kind === 'resource';
}

/**
 * R14 Security-related console issues (PRD section 10): CSP violations
 * (`csp` kind) and failed resource loads (`resource` kind, e.g. mixed content or
 * CORS), grouped with counts. Degrades to no findings when there are none.
 */
export const r14SecurityConsole: InsightRule = {
  id: 'R14',
  category: 'console',
  evaluate(input) {
    const issues = input.console.filter((entry) => isSecurityEntry(entry));
    if (issues.length === 0) {
      return [];
    }
    const groups = new Map<string, number>();
    for (const entry of issues) {
      groups.set(entry.kind, (groups.get(entry.kind) ?? 0) + entry.count);
    }
    const hasCsp = issues.some((entry) => entry.kind === 'csp');
    const ranked = [...groups.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([kind, count]) => `${kind} ×${String(count)}`);
    return [
      makeFinding({
        ruleId: 'R14',
        category: 'console',
        severity: hasCsp ? 'warning' : 'info',
        key: 'security',
        title: `${String(issues.length)} security-related console issue${issues.length === 1 ? '' : 's'}`,
        evidence: capEvidence(ranked),
        suggestion:
          'Review CSP violations, mixed content and CORS failures flagged in the console.',
        impact: hasCsp ? 55 : 30,
      }),
    ];
  },
};
