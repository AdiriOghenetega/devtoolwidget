import type { InsightRule } from '../../domain/insight';
import type { VitalMetric } from '../../domain/performance';
import { vitalLimit, vitalSeverity } from './cwv-thresholds';
import { capEvidence, makeFinding } from './support';

/**
 * R10 Cumulative Layout Shift (PRD section 10) with the shifted nodes as
 * attribution evidence. Degrades to no findings when CLS was not measured.
 */
export const r10Cls: InsightRule = {
  id: 'R10',
  category: 'performance',
  evaluate(input, thresholds) {
    const metric = input.vitals.find(
      (candidate): candidate is Extract<VitalMetric, { name: 'CLS' }> => candidate.name === 'CLS',
    );
    if (metric === undefined) {
      return [];
    }
    const severity = vitalSeverity(metric.value, vitalLimit(thresholds, 'CLS'));
    if (severity === undefined) {
      return [];
    }
    const nodes = metric.shiftedNodes ?? [];
    return [
      makeFinding({
        ruleId: 'R10',
        category: 'performance',
        severity,
        key: 'CLS',
        title: `CLS is ${severity}`,
        evidence: [
          `CLS ${String(metric.value)} (${severity})`,
          ...capEvidence(nodes.map((node) => `shifted node: ${node}`)),
        ],
        suggestion: 'Reserve space for images, ads and embeds so content does not shift.',
        impact: severity === 'critical' ? 95 : 55,
      }),
    ];
  },
};
