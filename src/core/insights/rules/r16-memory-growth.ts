import type { InsightRule } from '../../domain/insight';
import { formatBytes, makeFinding, roundMillis } from './support';

/**
 * R16 Memory growth trend (PRD section 10). Product-default constants (PRD
 * section 10 gives no number): flag at least a 50 MB rise across at least a 1 s
 * window with at least 3 samples. Degrades to no findings when memory samples are
 * unavailable.
 */
export const MEMORY_GROWTH_MIN_BYTES = 50 * 1024 * 1024;
export const MEMORY_WINDOW_MIN_MS = 1_000;
export const MEMORY_MIN_SAMPLES = 3;

export const r16MemoryGrowth: InsightRule = {
  id: 'R16',
  category: 'performance',
  evaluate(input) {
    const samples = input.memory ?? [];
    if (samples.length < MEMORY_MIN_SAMPLES) {
      return [];
    }
    const first = samples[0];
    const last = samples[samples.length - 1];
    if (first === undefined || last === undefined) {
      return [];
    }
    const growth = last.usedBytes - first.usedBytes;
    const windowMs = Number(last.at) - Number(first.at);
    if (growth < MEMORY_GROWTH_MIN_BYTES || windowMs < MEMORY_WINDOW_MIN_MS) {
      return [];
    }
    return [
      makeFinding({
        ruleId: 'R16',
        category: 'performance',
        severity: 'warning',
        key: 'memory-growth',
        title: `Memory grew by ${formatBytes(growth)}`,
        evidence: [
          `+${formatBytes(growth)} over ${roundMillis(windowMs)}`,
          `${String(samples.length)} samples`,
        ],
        suggestion: 'Investigate memory leaks: detached DOM nodes, listeners or unbounded caches.',
        impact: 50,
      }),
    ];
  },
};
