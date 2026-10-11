import type { Finding, FindingCategory, Severity } from '../../domain/finding';
import { formatBytes } from '../../format/formatters';
import { stableFindingId } from '../ids';

/** Maximum evidence lines included in a finding (top offenders). */
export const MAX_EVIDENCE_LINES = 5;

/** Input for {@link makeFinding}. */
export interface FindingSpec {
  readonly ruleId: string;
  readonly category: FindingCategory;
  readonly severity: Severity;
  /** Stable key (usually a rule-scoped label) used to derive the finding id. */
  readonly key: string;
  readonly title: string;
  readonly evidence: readonly string[];
  readonly suggestion: string;
  readonly impact: number;
  readonly docsUrl?: string;
  readonly actions?: Finding['actions'];
}

/** Builds a finding with a deterministic id. */
export function makeFinding(spec: FindingSpec): Finding {
  return {
    id: stableFindingId(spec.ruleId, spec.key),
    ruleId: spec.ruleId,
    severity: spec.severity,
    category: spec.category,
    title: spec.title,
    evidence: spec.evidence,
    suggestion: spec.suggestion,
    impact: spec.impact,
    ...(spec.docsUrl === undefined ? {} : { docsUrl: spec.docsUrl }),
    actions: spec.actions ?? [],
  };
}

/** Caps an evidence list at `max` lines, appending an "…and N more" summary. */
export function capEvidence(
  lines: readonly string[],
  max: number = MAX_EVIDENCE_LINES,
): readonly string[] {
  if (lines.length <= max) {
    return lines;
  }
  return [...lines.slice(0, max), `…and ${String(lines.length - max)} more`];
}

/** Formats a millisecond value for evidence, e.g. `1234ms`. */
export function roundMillis(value: number): string {
  return `${String(Math.round(value))}ms`;
}

/** Extracts an origin from a URL without the URL constructor (fast, no throw). */
export function originOf(url: string): string | undefined {
  const scheme = url.indexOf('://');
  if (scheme === -1) {
    return undefined;
  }
  const start = scheme + 3;
  const slash = url.indexOf('/', start);
  return slash === -1 ? url.slice(start) : url.slice(start, slash);
}

export { formatBytes };
