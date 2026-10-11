import { DEFAULT_THRESHOLDS, type Thresholds } from '../domain/constants';
import type { Finding, Severity } from '../domain/finding';
import type { InsightRule } from '../domain/insight';
import type { PageSnapshot } from '../domain/snapshot';
import { computeHealthScore, type HealthScore } from './scoring';

/** Rank order for severities (lower is more severe). */
const SEVERITY_RANK: Readonly<Record<Severity, number>> = { critical: 0, warning: 1, info: 2 };

/** The result of evaluating a snapshot. */
export interface InsightRun {
  readonly findings: readonly Finding[];
  readonly score: HealthScore;
}

/** Options for {@link runInsights}. */
export interface RunOptions {
  readonly rules: readonly InsightRule[];
  /** Merged thresholds (defaults + user overrides); defaults when omitted. */
  readonly thresholds?: Thresholds;
}

/** Removes findings with a duplicate id, keeping the first occurrence. */
export function dedupeFindings(findings: readonly Finding[]): Finding[] {
  const seen = new Set<string>();
  const result: Finding[] = [];
  for (const finding of findings) {
    if (!seen.has(finding.id)) {
      seen.add(finding.id);
      result.push(finding);
    }
  }
  return result;
}

/** Ranks findings by severity, then estimated impact, then id (deterministic). */
export function rankFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      (b.impact ?? 0) - (a.impact ?? 0) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Evaluates every rule against a snapshot with the merged thresholds, then
 * deduplicates and ranks the findings and computes the health score. Rules are
 * pure; a rule that throws is isolated and contributes no findings. Pure.
 */
export function runInsights(snapshot: PageSnapshot, options: RunOptions): InsightRun {
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
  const collected: Finding[] = [];
  for (const rule of options.rules) {
    try {
      collected.push(...rule.evaluate(snapshot, thresholds));
    } catch {
      // A faulty rule must not break the run.
    }
  }
  const findings = rankFindings(dedupeFindings(collected));
  return { findings, score: computeHealthScore(findings) };
}
