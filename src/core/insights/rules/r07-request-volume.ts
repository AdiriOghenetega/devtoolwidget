import type { InsightRule } from '../../domain/insight';
import { capEvidence, makeFinding, originOf } from './support';

/**
 * R07 Request volume (PRD section 10): more than the maximum number of requests,
 * or more than the maximum number of distinct origins. Emits up to two findings.
 */
export const r07RequestVolume: InsightRule = {
  id: 'R07',
  category: 'network',
  evaluate(input, thresholds) {
    const findings = [];
    const origins = new Map<string, number>();
    for (const entry of input.network) {
      const origin = originOf(entry.url);
      if (origin !== undefined) {
        origins.set(origin, (origins.get(origin) ?? 0) + 1);
      }
    }

    if (input.network.length > thresholds.maxRequests) {
      findings.push(
        makeFinding({
          ruleId: 'R07',
          category: 'network',
          severity: 'warning',
          key: 'count',
          title: `${String(input.network.length)} requests on this page`,
          evidence: [
            `${String(input.network.length)} requests across ${String(origins.size)} origins`,
          ],
          suggestion: 'Reduce the number of requests by bundling or removing unused resources.',
          impact: Math.min(70, 25 + (input.network.length - thresholds.maxRequests)),
          actions: [{ type: 'exportReport', format: 'markdown' }],
        }),
      );
    }

    if (origins.size > thresholds.maxDistinctOrigins) {
      const ranked = [...origins.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([origin, count]) => `${origin} — ${String(count)} requests`);
      findings.push(
        makeFinding({
          ruleId: 'R07',
          category: 'network',
          severity: 'warning',
          key: 'origins',
          title: `${String(origins.size)} distinct origins`,
          evidence: capEvidence(ranked),
          suggestion: 'Consolidate third-party origins to reduce connection overhead.',
          impact: Math.min(70, 25 + (origins.size - thresholds.maxDistinctOrigins)),
        }),
      );
    }

    return findings;
  },
};
