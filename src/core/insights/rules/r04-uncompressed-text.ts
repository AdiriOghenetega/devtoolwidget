import type { InsightRule } from '../../domain/insight';
import { capEvidence, formatBytes, makeFinding } from './support';

const TEXT_LIKE_TYPES = ['script', 'stylesheet', 'document', 'xmlhttprequest', 'fetch', 'other'];

function isTextLike(resourceType: string): boolean {
  return TEXT_LIKE_TYPES.includes(resourceType);
}

/**
 * R04 Uncompressed text (PRD section 10): text-like responses over the size
 * threshold that are not compressed. Compression is inferred from the transfer
 * vs decoded size (a compressed response transfers fewer bytes than it decodes).
 */
export const r04UncompressedText: InsightRule = {
  id: 'R04',
  category: 'network',
  evaluate(input, thresholds) {
    const limit = Number(thresholds.uncompressedText);
    const uncompressed = input.network.filter(
      (entry) =>
        isTextLike(entry.resourceType) &&
        Number(entry.decodedSize) > limit &&
        Number(entry.transferSize) >= Number(entry.decodedSize),
    );
    if (uncompressed.length === 0) {
      return [];
    }
    return [
      makeFinding({
        ruleId: 'R04',
        category: 'network',
        severity: 'warning',
        key: 'uncompressed',
        title: `${String(uncompressed.length)} uncompressed text response${uncompressed.length === 1 ? '' : 's'}`,
        evidence: capEvidence(
          uncompressed.map(
            (entry) =>
              `${entry.url} — ${formatBytes(Number(entry.decodedSize))} decoded, not compressed`,
          ),
        ),
        suggestion: 'Enable gzip or brotli compression on the server for these responses.',
        impact: Math.min(60, 20 + uncompressed.length * 6),
      }),
    ];
  },
};
