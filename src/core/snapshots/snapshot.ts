import { MAX_SNAPSHOTS as DEFAULT_MAX_SNAPSHOTS } from '../domain/constants';
import type { Millis } from '../domain/brands';
import type { Finding } from '../domain/finding';
import type { PageSnapshot } from '../domain/snapshot';

/** How many snapshots are retained by default (PRD FR-9). */
export const RETAINED_SNAPSHOTS = DEFAULT_MAX_SNAPSHOTS;

/** A saved snapshot: the captured page state plus the derived metrics. */
export interface SavedSnapshot {
  readonly id: string;
  readonly label: string;
  readonly createdAt: Millis;
  /** Flat metric map (vitals, health score and counters) used for diffing. */
  readonly metrics: Readonly<Record<string, number>>;
  readonly findings: readonly Finding[];
}

/** The direction a metric moved between two snapshots. */
export type DeltaDirection = 'up' | 'down' | 'same';

/** A single metric change between two snapshots. */
export interface MetricDelta {
  readonly name: string;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
  readonly direction: DeltaDirection;
  readonly significant: boolean;
  readonly threshold: number;
}

/** The result of diffing two snapshots. */
export interface SnapshotDiff {
  readonly metrics: readonly MetricDelta[];
  readonly newFindings: readonly Finding[];
  readonly resolvedFindings: readonly Finding[];
  readonly changed: boolean;
}

/**
 * Per-metric significance thresholds (absolute). A metric delta is "significant"
 * only when it is non-zero and at least this large. Counters use 0, so any change
 * counts; the health score uses 1 point.
 */
export const METRIC_SIGNIFICANCE: Readonly<Record<string, number>> = {
  LCP: 100,
  CLS: 0.02,
  INP: 20,
  FCP: 100,
  TTFB: 50,
  health: 1,
  consoleErrors: 0,
  networkCount: 0,
};

/** The default significance threshold for unknown metrics. */
export const DEFAULT_SIGNIFICANCE = 0;

/** Builds the flat metric map used for diffing from a snapshot's derived data. */
export function metricsFromSnapshot(
  snapshot: PageSnapshot,
  findings: readonly Finding[],
  healthScore: number,
): Record<string, number> {
  const metrics: Record<string, number> = {
    health: healthScore,
    consoleErrors: findings.filter((finding) => finding.category === 'console').length,
    networkCount: snapshot.network.length,
  };
  for (const vital of snapshot.vitals) {
    metrics[vital.name] = vital.value;
  }
  return metrics;
}

function thresholdFor(name: string): number {
  return METRIC_SIGNIFICANCE[name] ?? DEFAULT_SIGNIFICANCE;
}

/** Creates a saved snapshot from the current state. Pure. */
export function createSnapshot(input: {
  readonly id: string;
  readonly label: string;
  readonly createdAt: Millis;
  readonly snapshot: PageSnapshot;
  readonly findings: readonly Finding[];
  readonly healthScore: number;
}): SavedSnapshot {
  return {
    id: input.id,
    label: input.label,
    createdAt: input.createdAt,
    metrics: metricsFromSnapshot(input.snapshot, input.findings, input.healthScore),
    findings: input.findings,
  };
}

function readMetric(map: Readonly<Record<string, number>>, name: string): number {
  return Object.prototype.hasOwnProperty.call(map, name) ? (map[name] ?? 0) : 0;
}

/**
 * Diffs two metric maps. Pure and antisymmetric: `diff(before, after)` and
 * `diff(after, before)` report the same names with negated deltas and flipped
 * directions; a map diffed with itself has no changes. Reads metric values via
 * own-property access, so inherited keys like `__proto__` are ignored.
 */
export function diffMetrics(
  before: Readonly<Record<string, number>>,
  after: Readonly<Record<string, number>>,
): readonly MetricDelta[] {
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return names.map((name) => {
    const beforeValue = readMetric(before, name);
    const afterValue = readMetric(after, name);
    const delta = afterValue - beforeValue;
    const threshold = thresholdFor(name);
    return {
      name,
      before: beforeValue,
      after: afterValue,
      delta,
      direction: delta === 0 ? 'same' : delta > 0 ? 'up' : 'down',
      significant: delta !== 0 && Math.abs(delta) >= threshold,
      threshold,
    };
  });
}

/** Findings present in `after` but not `before`, and vice versa, by id. */
export function diffFindings(
  before: readonly Finding[],
  after: readonly Finding[],
): { readonly newFindings: readonly Finding[]; readonly resolvedFindings: readonly Finding[] } {
  const beforeIds = new Set(before.map((finding) => finding.id));
  const afterIds = new Set(after.map((finding) => finding.id));
  return {
    newFindings: after.filter((finding) => !beforeIds.has(finding.id)),
    resolvedFindings: before.filter((finding) => !afterIds.has(finding.id)),
  };
}

/** Diffs two saved snapshots. Pure. */
export function diffSnapshots(before: SavedSnapshot, after: SavedSnapshot): SnapshotDiff {
  const metrics = diffMetrics(before.metrics, after.metrics);
  const { newFindings, resolvedFindings } = diffFindings(before.findings, after.findings);
  const changed =
    metrics.some((metric) => metric.direction !== 'same') ||
    newFindings.length > 0 ||
    resolvedFindings.length > 0;
  return { metrics, newFindings, resolvedFindings, changed };
}

/**
 * Applies the retention policy: keeps the `max` most recent snapshots by
 * `createdAt` (stable for equal timestamps), dropping the rest. Pure.
 */
export function applyRetention(
  snapshots: readonly SavedSnapshot[],
  max: number = RETAINED_SNAPSHOTS,
): readonly SavedSnapshot[] {
  return [...snapshots]
    .map((snapshot, index) => ({ snapshot, index }))
    .sort(
      (a, b) => Number(b.snapshot.createdAt) - Number(a.snapshot.createdAt) || a.index - b.index,
    )
    .slice(0, max)
    .map((entry) => entry.snapshot);
}
