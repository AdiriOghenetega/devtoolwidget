import type { InsightRule } from '../../domain/insight';
import type { VitalMetric } from '../../domain/performance';
import { vitalLimit, vitalSeverity } from './cwv-thresholds';
import { makeFinding, roundMillis } from './support';

/**
 * R09 Largest Contentful Paint (PRD section 10) with the offending element as
 * attribution evidence. Degrades to no findings when LCP was not measured.
 */
export const r09Lcp: InsightRule = {
  id: 'R09',
  category: 'performance',
  evaluate(input, thresholds) {
    const metric = input.vitals.find(
      (candidate): candidate is Extract<VitalMetric, { name: 'LCP' }> => candidate.name === 'LCP',
    );
    if (metric === undefined) {
      return [];
    }
    const severity = vitalSeverity(metric.value, vitalLimit(thresholds, 'LCP'));
    if (severity === undefined) {
      return [];
    }
    const evidence = [`LCP ${roundMillis(metric.value)} (${severity})`];
    if (metric.element !== undefined) {
      evidence.push(`element: ${metric.element}`);
    }
    return [
      makeFinding({
        ruleId: 'R09',
        category: 'performance',
        severity,
        key: 'LCP',
        title: `LCP is ${severity}`,
        evidence,
        suggestion: 'Speed up the largest contentful paint (optimize the hero image or text).',
        impact: severity === 'critical' ? 95 : 55,
      }),
    ];
  },
};
