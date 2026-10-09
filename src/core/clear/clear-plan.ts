import { toBytes, type Bytes } from '../domain/brands';
import type { StorageArea, StorageSummary } from '../domain/storage';

/** The kinds of site data the widget can clear (PRD FR-6). */
export type ClearType =
  | 'localStorage'
  | 'sessionStorage'
  | 'indexedDB'
  | 'cacheStorage'
  | 'serviceWorkers'
  | 'cookies'
  | 'httpCache';

/** Whether a request targets one origin or everything. */
export type ClearScope = 'origin' | 'all';

/** Which runtime executes a step. */
export type ClearExecutor = 'page' | 'background';

/** Data types `browsingData` can scope to specific origins (Chrome docs, 2026-09). */
export type OriginScopedBrowsingDataType =
  | 'cache'
  | 'cacheStorage'
  | 'cookies'
  | 'fileSystems'
  | 'indexedDB'
  | 'localStorage'
  | 'serviceWorkers'
  | 'webSQL';

/**
 * Typed capabilities derived from the current `chrome.browsingData` docs
 * (checked 2026-09): `origins`/`excludeOrigins` apply to cookies, cache and
 * storage only, and cookies clear the whole **registrable domain**.
 */
export interface ClearCapabilities {
  readonly originScopedBrowsingData: readonly OriginScopedBrowsingDataType[];
  readonly cookieScope: 'registrable-domain';
}

export const CLEAR_CAPABILITIES: ClearCapabilities = {
  originScopedBrowsingData: [
    'cache',
    'cacheStorage',
    'cookies',
    'fileSystems',
    'indexedDB',
    'localStorage',
    'serviceWorkers',
    'webSQL',
  ],
  cookieScope: 'registrable-domain',
};

/** Types the page-context executor handles (never HttpOnly cookies). */
export const PAGE_CLEAR_TYPES: readonly ClearType[] = [
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'cacheStorage',
  'serviceWorkers',
  'cookies',
];

/** Types the background (`browsingData`) executor handles. */
export const BACKGROUND_CLEAR_TYPES: readonly ClearType[] = ['cookies', 'httpCache'];

/** A request to clear site data. */
export interface ClearRequest {
  readonly types: readonly ClearType[];
  /** Names to preserve (localStorage keys / cookie names). */
  readonly keep?: readonly string[];
  readonly scope: ClearScope;
  readonly origin?: string;
}

/** One ordered step produced by the planner. */
export interface ClearStep {
  readonly id: string;
  readonly type: ClearType;
  readonly executor: ClearExecutor;
  /** `page` steps keep only named keys; `background` cookie steps are HttpOnly. */
  readonly keep: readonly string[];
  readonly httpOnly: boolean;
  readonly origin?: string;
}

/** The plan: ordered steps plus surfaced limitations. */
export interface ClearPlan {
  readonly steps: readonly ClearStep[];
  readonly warnings: readonly string[];
}

function appliesKeep(type: ClearType): boolean {
  return type === 'localStorage' || type === 'cookies';
}

/**
 * Turns a clear request into ordered steps: page-context steps first (origin
 * precise, synchronous), then background `browsingData` steps. Cookies always
 * produce two steps (non-HttpOnly in the page, HttpOnly plus registrable-domain
 * in the background). Pure.
 */
export function planClear(request: ClearRequest): ClearPlan {
  const types = [...new Set(request.types)];
  const keep = request.keep ?? [];
  const origin = request.scope === 'origin' ? request.origin : undefined;
  const steps: ClearStep[] = [];
  const warnings: string[] = [];

  const pageStep = (type: ClearType, id: string, httpOnly = false): void => {
    steps.push({
      id,
      type,
      executor: 'page',
      keep: appliesKeep(type) ? keep : [],
      httpOnly,
      ...(origin === undefined ? {} : { origin }),
    });
  };
  const backgroundStep = (type: ClearType, id: string, httpOnly = false): void => {
    steps.push({
      id,
      type,
      executor: 'background',
      keep: appliesKeep(type) ? keep : [],
      httpOnly,
      ...(origin === undefined ? {} : { origin }),
    });
  };

  for (const type of types) {
    switch (type) {
      case 'localStorage':
      case 'sessionStorage':
      case 'indexedDB':
      case 'cacheStorage':
      case 'serviceWorkers':
        pageStep(type, `page:${type}`);
        break;
      case 'cookies':
        pageStep('cookies', 'page:cookies:non-http-only');
        backgroundStep('cookies', 'background:cookies:http-only', true);
        warnings.push(
          'Clearing cookies affects the whole registrable domain, not just the origin.',
        );
        break;
      case 'httpCache':
        backgroundStep('httpCache', 'background:http-cache');
        break;
    }
  }

  if (request.scope === 'all' && types.some((type) => PAGE_CLEAR_TYPES.includes(type))) {
    warnings.push(
      'Page-context steps only affect the current origin; other origins need the background executor.',
    );
  }

  return { steps, warnings };
}

/** A single step's outcome. */
export interface ClearStepResult {
  readonly stepId: string;
  readonly ok: boolean;
  readonly skipped: boolean;
  readonly bytesFreed: number;
  readonly reason?: string;
}

/** The aggregated report for a clear request (PRD FR-6). */
export interface ClearReport {
  readonly ok: boolean;
  readonly bytesFreed: number;
  readonly results: readonly ClearStepResult[];
  readonly failures: readonly ClearStepResult[];
  readonly warnings: readonly string[];
}

/** Aggregates step results into a report; partial failures keep `ok` false. */
export function aggregateClearReport(
  results: readonly ClearStepResult[],
  warnings: readonly string[] = [],
): ClearReport {
  const failures = results.filter((result) => !result.ok && !result.skipped);
  let bytesFreed = 0;
  for (const result of results) {
    if (result.ok) {
      bytesFreed += result.bytesFreed;
    }
  }
  return { ok: failures.length === 0, bytesFreed, results, failures, warnings };
}

/** A per-area usage sample for the summary. */
export interface StorageAreaSample {
  readonly area: StorageArea;
  readonly count: number;
  readonly approximateSize: number;
}

/** Aggregates per-area samples into a {@link StorageSummary}. */
export function summarizeStorage(areas: readonly StorageAreaSample[]): StorageSummary {
  return {
    areas: areas.map((area) => ({
      area: area.area,
      count: area.count,
      approximateSize: toBytes(area.approximateSize),
    })),
  };
}

/** Total approximate bytes across a summary. */
export function totalStorageBytes(summary: StorageSummary): Bytes {
  let total = 0;
  for (const area of summary.areas) {
    total += Number(area.approximateSize);
  }
  return toBytes(total);
}
