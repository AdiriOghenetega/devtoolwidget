import type { InsightRule } from '../../domain/insight';
import { capEvidence, formatBytes, makeFinding } from './support';

/**
 * R17 Storage bloat (PRD section 10): localStorage or IndexedDB over 5 MB,
 * cookies over 4 KB total per origin. Degrades to no findings when no storage
 * areas were summarised.
 */
export const r17StorageBloat: InsightRule = {
  id: 'R17',
  category: 'storage',
  evaluate(input, thresholds) {
    const bloated = input.storage.areas.filter((area) => {
      const limit =
        area.area === 'cookies'
          ? thresholds.storage.cookies
          : area.area === 'indexedDB'
            ? thresholds.storage.indexedDB
            : area.area === 'localStorage'
              ? thresholds.storage.localStorage
              : undefined;
      return limit !== undefined && area.approximateSize > limit;
    });
    if (bloated.length === 0) {
      return [];
    }
    return [
      makeFinding({
        ruleId: 'R17',
        category: 'storage',
        severity: 'warning',
        key: 'bloat',
        title: `${String(bloated.length)} oversized storage area${bloated.length === 1 ? '' : 's'}`,
        evidence: capEvidence(
          bloated.map(
            (area) =>
              `${area.area} — ${formatBytes(Number(area.approximateSize))} across ${String(area.count)} items`,
          ),
        ),
        suggestion: 'Clear unused site storage or reduce what the page stores.',
        impact: 40,
        actions: [{ type: 'clearStorage', preset: 'fresh-visitor' }],
      }),
    ];
  },
};
