import type { InsightRule } from '../../domain/insight';
import { capEvidence, makeFinding, roundMillis } from './support';

/**
 * R02 Slow requests (PRD section 10): total time over the threshold or TTFB over
 * its threshold.
 */
export const r02SlowRequests: InsightRule = {
  id: 'R02',
  category: 'network',
  evaluate(input, thresholds) {
    const slow = input.network.filter(
      (entry) =>
        Number(entry.timing.total) > Number(thresholds.slowRequestTotal) ||
        Number(entry.timing.ttfb) > Number(thresholds.slowRequestTtfb),
    );
    if (slow.length === 0) {
      return [];
    }
    return [
      makeFinding({
        ruleId: 'R02',
        category: 'network',
        severity: 'warning',
        key: 'slow',
        title: `${String(slow.length)} slow request${slow.length === 1 ? '' : 's'}`,
        evidence: capEvidence(
          slow.map(
            (entry) =>
              `${entry.url} — ${roundMillis(Number(entry.timing.total))} total, ${roundMillis(Number(entry.timing.ttfb))} TTFB`,
          ),
        ),
        suggestion: 'Reduce server response time or add caching for these requests.',
        impact: Math.min(80, 30 + slow.length * 8),
      }),
    ];
  },
};
