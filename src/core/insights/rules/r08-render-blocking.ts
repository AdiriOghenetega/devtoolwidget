import type { InsightRule } from '../../domain/insight';
import { capEvidence, makeFinding } from './support';

/**
 * R08 Render-blocking resources (PRD section 10): resources flagged by the
 * browser as render-blocking. Degrades to no findings when resource data (or the
 * `renderBlockingStatus` support) is unavailable.
 */
export const r08RenderBlocking: InsightRule = {
  id: 'R08',
  category: 'performance',
  evaluate(input) {
    const blocking = (input.resources ?? []).filter((resource) => resource.renderBlocking === true);
    if (blocking.length === 0) {
      return [];
    }
    return [
      makeFinding({
        ruleId: 'R08',
        category: 'performance',
        severity: 'warning',
        key: 'render-blocking',
        title: `${String(blocking.length)} render-blocking resource${blocking.length === 1 ? '' : 's'}`,
        evidence: capEvidence(
          blocking.map((resource) => `${resource.url} — ${resource.resourceType || 'unknown'}`),
        ),
        suggestion:
          'Inline critical CSS and defer or async scripts so the first paint is not blocked.',
        impact: Math.min(65, 25 + blocking.length * 6),
      }),
    ];
  },
};
