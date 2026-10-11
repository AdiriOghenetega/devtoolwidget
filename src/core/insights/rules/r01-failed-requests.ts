import type { InsightRule } from '../../domain/insight';
import { capEvidence, makeFinding } from './support';

/**
 * R01 Failed requests (PRD section 10): any 4xx, 5xx or network error. Critical
 * when a 5xx or network error is present, otherwise warning.
 */
export const r01FailedRequests: InsightRule = {
  id: 'R01',
  category: 'network',
  evaluate(input) {
    const critical = input.network.filter((entry) => entry.status === null || entry.status >= 500);
    const warnings = input.network.filter(
      (entry) => entry.status !== null && entry.status >= 400 && entry.status < 500,
    );
    const failing = [...critical, ...warnings];
    if (failing.length === 0) {
      return [];
    }
    return [
      makeFinding({
        ruleId: 'R01',
        category: 'network',
        severity: critical.length > 0 ? 'critical' : 'warning',
        key: 'failures',
        title: `${String(failing.length)} failed request${failing.length === 1 ? '' : 's'}`,
        evidence: capEvidence(
          failing.map(
            (entry) => `${String(entry.status ?? 'network error')} ${entry.method} ${entry.url}`,
          ),
        ),
        suggestion: 'Fix the failing requests: check the status codes and the server response.',
        impact: Math.min(95, 40 + failing.length * 10),
        actions: [{ type: 'hardReload' }],
      }),
    ];
  },
};
