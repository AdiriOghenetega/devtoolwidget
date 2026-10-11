import type { InsightRule } from '../../domain/insight';
import { capEvidence, formatBytes, makeFinding } from './support';

function isImage(resourceType: string): boolean {
  return resourceType.includes('image');
}

/**
 * R03 Large payloads (PRD section 10): non-media transfer over the payload
 * threshold, or images over the (larger) image threshold.
 */
export const r03LargePayloads: InsightRule = {
  id: 'R03',
  category: 'network',
  evaluate(input, thresholds) {
    const large = input.network.filter((entry) => {
      const limit = isImage(entry.resourceType) ? thresholds.largeImage : thresholds.largePayload;
      return entry.transferSize > limit;
    });
    if (large.length === 0) {
      return [];
    }
    return [
      makeFinding({
        ruleId: 'R03',
        category: 'network',
        severity: 'warning',
        key: 'large',
        title: `${String(large.length)} large resource${large.length === 1 ? '' : 's'}`,
        evidence: capEvidence(
          large.map(
            (entry) =>
              `${entry.url} — ${formatBytes(Number(entry.transferSize))} (${entry.resourceType || 'unknown'})`,
          ),
        ),
        suggestion: 'Compress, resize or lazy-load these resources.',
        impact: Math.min(75, 25 + large.length * 7),
      }),
    ];
  },
};
