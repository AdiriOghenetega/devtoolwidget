import type { InsightRule } from '../../domain/insight';
import { findOversizedImages } from '../../performance/derive';
import { capEvidence, makeFinding } from './support';

/**
 * R15 Oversized images (PRD section 10): images whose natural pixel area is far
 * above their rendered area. Degrades to no findings when no image samples are
 * available.
 */
export const r15OversizedImages: InsightRule = {
  id: 'R15',
  category: 'performance',
  evaluate(input) {
    const oversized = findOversizedImages(input.images ?? []);
    if (oversized.length === 0) {
      return [];
    }
    return [
      makeFinding({
        ruleId: 'R15',
        category: 'performance',
        severity: 'warning',
        key: 'oversized-images',
        title: `${String(oversized.length)} oversized image${oversized.length === 1 ? '' : 's'}`,
        evidence: capEvidence(
          oversized.map(
            (image) =>
              `${image.url} — ${image.ratio.toFixed(1)}× (${String(image.naturalPixels)}px natural vs ${String(image.renderedPixels)}px rendered)`,
          ),
        ),
        suggestion: 'Serve images sized for their rendered dimensions (srcset or resizing).',
        impact: Math.min(50, 15 + oversized.length * 5),
      }),
    ];
  },
};
