import { estimateTotalBlockingTime } from '../performance/derive';
import type { Thresholds } from '../domain/constants';
import type { ConsoleEntry } from '../domain/console';
import type { Finding, FindingCategory, Severity } from '../domain/finding';
import type { InsightRule } from '../domain/insight';
import type { NetworkEntry } from '../domain/network';
import type { VitalMetric } from '../domain/performance';
import { stableFindingId } from './ids';

interface FindingInput {
  readonly ruleId: string;
  readonly category: FindingCategory;
  readonly severity: Severity;
  readonly key: string;
  readonly title: string;
  readonly evidence: readonly string[];
  readonly suggestion: string;
  readonly impact: number;
  readonly actions?: Finding['actions'];
}

function finding(input: FindingInput): Finding {
  return {
    id: stableFindingId(input.ruleId, input.key),
    ruleId: input.ruleId,
    severity: input.severity,
    category: input.category,
    title: input.title,
    evidence: input.evidence,
    suggestion: input.suggestion,
    impact: input.impact,
    actions: input.actions ?? [],
  };
}

function originOf(url: string): string | undefined {
  const scheme = url.indexOf('://');
  if (scheme === -1) {
    return undefined;
  }
  const start = scheme + 3;
  const slash = url.indexOf('/', start);
  return slash === -1 ? url.slice(start) : url.slice(start, slash);
}

function metricFinding(
  ruleId: string,
  name: 'LCP' | 'CLS' | 'INP',
  metric: MetricLike,
  thresholds: Thresholds,
): Finding | undefined {
  const limit = thresholds[name.toLowerCase() as 'lcp' | 'cls' | 'inp'];
  const rating: Severity | undefined =
    metric.value > limit.poor
      ? 'critical'
      : metric.value > limit.needsImprovement
        ? 'warning'
        : undefined;
  if (rating === undefined) {
    return undefined;
  }
  const attribution = 'element' in metric ? metric.element : undefined;
  const target = 'interactionTarget' in metric ? metric.interactionTarget : undefined;
  const evidence = [`${name}: ${String(metric.value)} (${rating})`];
  if (typeof attribution === 'string') {
    evidence.push(`element: ${attribution}`);
  }
  if (typeof target === 'string') {
    evidence.push(`target: ${target}`);
  }
  return finding({
    ruleId,
    category: 'performance',
    severity: rating,
    key: name,
    title: `${name} is ${rating}`,
    evidence,
    suggestion: `Improve ${name}.`,
    impact: rating === 'critical' ? 95 : 55,
  });
}

type MetricLike = Extract<VitalMetric, { name: 'LCP' | 'CLS' | 'INP' }>;

const R01: InsightRule = {
  id: 'R01',
  category: 'network',
  evaluate(input) {
    const findings: Finding[] = [];
    for (const entry of input.network) {
      const serverError = entry.status === null || entry.status >= 500;
      const clientError = entry.status !== null && entry.status >= 400 && entry.status < 500;
      if (!serverError && !clientError) {
        continue;
      }
      findings.push(
        finding({
          ruleId: 'R01',
          category: 'network',
          severity: serverError ? 'critical' : 'warning',
          key: entry.url,
          title: serverError
            ? `Request failed (${String(entry.status ?? 'network error')})`
            : `Request rejected (${String(entry.status)})`,
          evidence: [`${entry.method} ${entry.url}`],
          suggestion: 'Fix the failing request.',
          impact: serverError ? 90 : 50,
          actions: [{ type: 'hardReload' }],
        }),
      );
    }
    return findings;
  },
};

const R02: InsightRule = {
  id: 'R02',
  category: 'network',
  evaluate(input, thresholds) {
    const findings: Finding[] = [];
    for (const entry of input.network) {
      if (
        Number(entry.timing.total) > Number(thresholds.slowRequestTotal) ||
        Number(entry.timing.ttfb) > Number(thresholds.slowRequestTtfb)
      ) {
        findings.push(
          finding({
            ruleId: 'R02',
            category: 'network',
            severity: 'warning',
            key: entry.url,
            title: 'Slow request',
            evidence: [
              `total ${String(Number(entry.timing.total))}ms`,
              `ttfb ${String(Number(entry.timing.ttfb))}ms`,
            ],
            suggestion: 'Reduce server response time or cache the resource.',
            impact: 60,
          }),
        );
      }
    }
    return findings;
  },
};

const R03: InsightRule = {
  id: 'R03',
  category: 'network',
  evaluate(input, thresholds) {
    const findings: Finding[] = [];
    for (const entry of input.network) {
      const isImage = entry.resourceType.includes('image');
      const limit = isImage ? thresholds.largeImage : thresholds.largePayload;
      if (entry.transferSize > limit) {
        findings.push(
          finding({
            ruleId: 'R03',
            category: 'network',
            severity: 'warning',
            key: entry.url,
            title: isImage ? 'Large image' : 'Large payload',
            evidence: [`${String(entry.transferSize)} bytes`],
            suggestion: 'Compress or lazy-load the resource.',
            impact: 45,
          }),
        );
      }
    }
    return findings;
  },
};

const R06: InsightRule = {
  id: 'R06',
  category: 'network',
  evaluate(input, thresholds) {
    const groups = new Map<string, NetworkEntry[]>();
    for (const entry of input.network) {
      const key = `${entry.method} ${entry.url}`;
      const list = groups.get(key) ?? [];
      list.push(entry);
      groups.set(key, list);
    }
    const findings: Finding[] = [];
    for (const [key, entries] of groups) {
      if (entries.length < 2) {
        continue;
      }
      const window = Number(thresholds.duplicateRequestWindow);
      if (window <= 0) {
        continue;
      }
      findings.push(
        finding({
          ruleId: 'R06',
          category: 'network',
          severity: 'warning',
          key,
          title: 'Duplicate request',
          evidence: [`${String(entries.length)}× ${key}`],
          suggestion: 'Deduplicate or cache the request.',
          impact: 30,
        }),
      );
    }
    return findings;
  },
};

const R07: InsightRule = {
  id: 'R07',
  category: 'network',
  evaluate(input, thresholds) {
    const findings: Finding[] = [];
    if (input.network.length > thresholds.maxRequests) {
      findings.push(
        finding({
          ruleId: 'R07',
          category: 'network',
          severity: 'warning',
          key: 'count',
          title: 'Too many requests',
          evidence: [`${String(input.network.length)} requests`],
          suggestion: 'Reduce the number of requests.',
          impact: 35,
        }),
      );
    }
    const origins = new Set<string>();
    for (const entry of input.network) {
      const origin = originOf(entry.url);
      if (origin !== undefined) {
        origins.add(origin);
      }
    }
    if (origins.size > thresholds.maxDistinctOrigins) {
      findings.push(
        finding({
          ruleId: 'R07',
          category: 'network',
          severity: 'warning',
          key: 'origins',
          title: 'Too many origins',
          evidence: [`${String(origins.size)} origins`],
          suggestion: 'Consolidate third-party origins.',
          impact: 35,
        }),
      );
    }
    return findings;
  },
};

function vitalRule(id: string, name: 'LCP' | 'CLS' | 'INP'): InsightRule {
  return {
    id,
    category: 'performance',
    evaluate(input, thresholds) {
      const metric = input.vitals.find(
        (candidate): candidate is MetricLike => candidate.name === name,
      );
      if (metric === undefined) {
        return [];
      }
      const result = metricFinding(id, name, metric, thresholds);
      return result === undefined ? [] : [result];
    },
  };
}

const R12: InsightRule = {
  id: 'R12',
  category: 'performance',
  evaluate(input, thresholds) {
    const tbt = Number(estimateTotalBlockingTime(input.longTasks));
    const limit = thresholds.totalBlockingTime;
    if (tbt <= Number(limit.warning)) {
      return [];
    }
    const severity: Severity = tbt > Number(limit.critical) ? 'critical' : 'warning';
    return [
      finding({
        ruleId: 'R12',
        category: 'performance',
        severity,
        key: 'tbt',
        title: `High total blocking time (${String(tbt)}ms)`,
        evidence: [`${String(input.longTasks.length)} long tasks`],
        suggestion: 'Break up long tasks.',
        impact: severity === 'critical' ? 80 : 45,
      }),
    ];
  },
};

function isErrorEntry(entry: ConsoleEntry): boolean {
  return entry.kind === 'uncaught' || entry.kind === 'rejection' || entry.level === 'error';
}

const R13: InsightRule = {
  id: 'R13',
  category: 'console',
  evaluate(input) {
    const findings: Finding[] = [];
    for (const entry of input.console) {
      if (!isErrorEntry(entry)) {
        continue;
      }
      const severe = entry.kind === 'uncaught' || entry.kind === 'rejection';
      findings.push(
        finding({
          ruleId: 'R13',
          category: 'console',
          severity: severe ? 'critical' : 'warning',
          key: entry.id,
          title: severe ? `Uncaught ${entry.kind}` : 'Console error',
          evidence: [entry.kind, entry.count > 1 ? `${String(entry.count)}×` : 'once'],
          suggestion: 'Fix the reported error.',
          impact: severe ? 70 : 40,
        }),
      );
    }
    return findings;
  },
};

const R17: InsightRule = {
  id: 'R17',
  category: 'storage',
  evaluate(input, thresholds) {
    const findings: Finding[] = [];
    for (const area of input.storage.areas) {
      const limit =
        area.area === 'cookies'
          ? thresholds.storage.cookies
          : area.area === 'indexedDB'
            ? thresholds.storage.indexedDB
            : area.area === 'localStorage'
              ? thresholds.storage.localStorage
              : undefined;
      if (limit !== undefined && area.approximateSize > limit) {
        findings.push(
          finding({
            ruleId: 'R17',
            category: 'storage',
            severity: 'warning',
            key: area.area,
            title: `Storage bloat: ${area.area}`,
            evidence: [`${String(area.approximateSize)} bytes`],
            suggestion: 'Clear unused storage.',
            impact: 40,
            actions: [{ type: 'clearStorage', preset: 'fresh-visitor' }],
          }),
        );
      }
    }
    return findings;
  },
};

/** Every built-in insight rule (PRD section 10 subset implemented so far). */
export const ALL_INSIGHT_RULES: readonly InsightRule[] = [
  R01,
  R02,
  R03,
  R06,
  R07,
  vitalRule('R09', 'LCP'),
  vitalRule('R10', 'CLS'),
  vitalRule('R11', 'INP'),
  R12,
  R13,
  R17,
];
