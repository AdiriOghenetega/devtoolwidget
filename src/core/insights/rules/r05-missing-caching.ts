import type { InsightRule } from '../../domain/insight';
import type { RedactedHeaders } from '../../domain/network';
import { capEvidence, makeFinding } from './support';

const STATIC_TYPES = ['script', 'stylesheet', 'image', 'font'];

function isStatic(resourceType: string): boolean {
  return STATIC_TYPES.includes(resourceType);
}

const CACHE_HEADERS = ['cache-control', 'etag', 'last-modified', 'expires'];

function hasCacheHeader(headers: RedactedHeaders): boolean {
  return Object.keys(headers).some((name) => CACHE_HEADERS.includes(name.toLowerCase()));
}

/**
 * R05 Missing caching (PRD section 10): static assets served without a
 * cache-control, ETag, last-modified or expires header. Only evaluated when
 * response headers were captured (header capture is opt-in), so the rule never
 * guesses.
 */
export const r05MissingCaching: InsightRule = {
  id: 'R05',
  category: 'network',
  evaluate(input) {
    const uncached = input.network.filter(
      (entry) =>
        isStatic(entry.resourceType) &&
        entry.transferSize > 0 &&
        entry.headers !== undefined &&
        !hasCacheHeader(entry.headers),
    );
    if (uncached.length === 0) {
      return [];
    }
    return [
      makeFinding({
        ruleId: 'R05',
        category: 'network',
        severity: 'info',
        key: 'uncached',
        title: `${String(uncached.length)} static resource${uncached.length === 1 ? '' : 's'} without caching`,
        evidence: capEvidence(uncached.map((entry) => `${entry.url} — no cache-control or ETag`)),
        suggestion: 'Add Cache-Control or ETag headers so the browser can cache these assets.',
        impact: Math.min(40, 10 + uncached.length * 4),
      }),
    ];
  },
};
