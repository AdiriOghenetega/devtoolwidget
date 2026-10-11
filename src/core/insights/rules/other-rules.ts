import { estimateTotalBlockingTime } from '../../performance/derive';
import type { ConsoleEntry } from '../../domain/console';
import type { Severity } from '../../domain/finding';
import type { Thresholds } from '../../domain/constants';
import type { InsightRule } from '../../domain/insight';
import type { VitalMetric } from '../../domain/performance';
import { makeFinding } from './support';

type MetricName = 'LCP' | 'CLS' | 'INP';
type MetricLike = Extract<VitalMetric, { name: MetricName }>;

function vitalRule(ruleId: string, name: MetricName): InsightRule {
  return {
    id: ruleId,
    category: 'performance',
    evaluate(input, thresholds) {
      const metric = input.vitals.find(
        (candidate): candidate is MetricLike => candidate.name === name,
      );
      if (metric === undefined) {
        return [];
      }
      const limit: Thresholds['lcp'] = thresholds[name.toLowerCase() as 'lcp' | 'cls' | 'inp'];
      const severity: Severity | undefined =
        metric.value > limit.poor
          ? 'critical'
          : metric.value > limit.needsImprovement
            ? 'warning'
            : undefined;
      if (severity === undefined) {
        return [];
      }
      const evidence = [`${name}: ${String(metric.value)} (${severity})`];
      const element = 'element' in metric ? metric.element : undefined;
      const target = 'interactionTarget' in metric ? metric.interactionTarget : undefined;
      if (element !== undefined) {
        evidence.push(`element: ${element}`);
      }
      if (target !== undefined) {
        evidence.push(`target: ${target}`);
      }
      return [
        makeFinding({
          ruleId,
          category: 'performance',
          severity,
          key: name,
          title: `${name} is ${severity}`,
          evidence,
          suggestion: `Improve ${name} (see the evidence for the offending element).`,
          impact: severity === 'critical' ? 95 : 55,
        }),
      ];
    },
  };
}

const r12TotalBlockingTime: InsightRule = {
  id: 'R12',
  category: 'performance',
  evaluate(input, thresholds) {
    const tbt = Number(estimateTotalBlockingTime(input.longTasks));
    if (tbt <= Number(thresholds.totalBlockingTime.warning)) {
      return [];
    }
    const severity: Severity =
      tbt > Number(thresholds.totalBlockingTime.critical) ? 'critical' : 'warning';
    return [
      makeFinding({
        ruleId: 'R12',
        category: 'performance',
        severity,
        key: 'tbt',
        title: `High total blocking time (${String(tbt)}ms)`,
        evidence: [`${String(input.longTasks.length)} long task(s)`],
        suggestion: 'Break up long tasks so the main thread can respond sooner.',
        impact: severity === 'critical' ? 80 : 45,
      }),
    ];
  },
};

function isErrorEntry(entry: ConsoleEntry): boolean {
  return entry.kind === 'uncaught' || entry.kind === 'rejection' || entry.level === 'error';
}

const r13ConsoleErrors: InsightRule = {
  id: 'R13',
  category: 'console',
  evaluate(input) {
    const errors = input.console.filter((entry) => isErrorEntry(entry));
    if (errors.length === 0) {
      return [];
    }
    const severe = errors.some((entry) => entry.kind === 'uncaught' || entry.kind === 'rejection');
    return [
      makeFinding({
        ruleId: 'R13',
        category: 'console',
        severity: severe ? 'critical' : 'warning',
        key: 'errors',
        title: `${String(errors.length)} console error${errors.length === 1 ? '' : 's'}`,
        evidence: errors
          .slice(0, 5)
          .map((entry) => `${entry.kind} (${entry.level}) ×${String(entry.count)}`),
        suggestion: 'Fix the reported console errors.',
        impact: severe ? 70 : 40,
      }),
    ];
  },
};

const r17StorageBloat: InsightRule = {
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
        evidence: bloated.map((area) => `${area.area} — ${String(area.count)} items`),
        suggestion: 'Clear unused site storage or reduce what is stored.',
        impact: 40,
        actions: [{ type: 'clearStorage', preset: 'fresh-visitor' }],
      }),
    ];
  },
};

/** Rules R09–R13 and R17 (performance, console and storage categories). */
export const OTHER_RULES: readonly InsightRule[] = [
  vitalRule('R09', 'LCP'),
  vitalRule('R10', 'CLS'),
  vitalRule('R11', 'INP'),
  r12TotalBlockingTime,
  r13ConsoleErrors,
  r17StorageBloat,
];
