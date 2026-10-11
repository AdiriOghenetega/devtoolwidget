import type { InsightRule } from '../../domain/insight';
import type { VitalMetric } from '../../domain/performance';
import { vitalLimit, vitalSeverity } from './cwv-thresholds';
import { makeFinding, roundMillis } from './support';

/**
 * R11 Interaction to Next Paint (PRD section 10) with the interaction target as
 * attribution evidence. Degrades to no findings when INP was not measured.
 */
export const r11Inp: InsightRule = {
  id: 'R11',
  category: 'performance',
  evaluate(input, thresholds) {
    const metric = input.vitals.find(
      (candidate): candidate is Extract<VitalMetric, { name: 'INP' }> => candidate.name === 'INP',
    );
    if (metric === undefined) {
      return [];
    }
    const severity = vitalSeverity(metric.value, vitalLimit(thresholds, 'INP'));
    if (severity === undefined) {
      return [];
    }
    const evidence = [`INP ${roundMillis(metric.value)} (${severity})`];
    if (metric.interactionTarget !== undefined) {
      evidence.push(`target: ${metric.interactionTarget}`);
    }
    return [
      makeFinding({
        ruleId: 'R11',
        category: 'performance',
        severity,
        key: 'INP',
        title: `INP is ${severity}`,
        evidence,
        suggestion: 'Reduce long tasks on the main thread so interactions respond faster.',
        impact: severity === 'critical' ? 95 : 55,
      }),
    ];
  },
};
