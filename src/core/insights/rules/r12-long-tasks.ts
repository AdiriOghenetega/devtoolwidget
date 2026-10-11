import type { Severity } from '../../domain/finding';
import { estimateTotalBlockingTime } from '../../performance/derive';
import type { InsightRule } from '../../domain/insight';
import { makeFinding, roundMillis } from './support';

/**
 * R12 Long tasks / total blocking time (PRD section 10): estimated TBT over the
 * warning or critical threshold. Degrades to no findings when no long tasks were
 * captured.
 */
export const r12LongTasks: InsightRule = {
  id: 'R12',
  category: 'performance',
  evaluate(input, thresholds) {
    if (input.longTasks.length === 0) {
      return [];
    }
    const tbt = Number(estimateTotalBlockingTime(input.longTasks));
    const limit = thresholds.totalBlockingTime;
    if (tbt <= Number(limit.warning)) {
      return [];
    }
    const severity: Severity = tbt > Number(limit.critical) ? 'critical' : 'warning';
    return [
      makeFinding({
        ruleId: 'R12',
        category: 'performance',
        severity,
        key: 'tbt',
        title: `High total blocking time (${roundMillis(tbt)})`,
        evidence: [
          `${String(input.longTasks.length)} long task(s)`,
          `estimated TBT ${roundMillis(tbt)}`,
        ],
        suggestion: 'Break up long tasks so the main thread can respond to input sooner.',
        impact: severity === 'critical' ? 80 : 45,
      }),
    ];
  },
};
