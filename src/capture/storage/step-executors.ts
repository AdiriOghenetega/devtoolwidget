import type { ClearStep, ClearStepResult, Result, TabId } from '../../core';
import type {
  BrowsingDataType,
  BrowsingDataPort,
  PlatformError,
  ScriptingPort,
} from '../../platform/ports';
import type { StepExecutor } from './clear-orchestrator';

/** Maps a widget clear type to the `browsingData` type that clears it. */
const BROWSING_DATA_TYPES: Partial<Record<string, BrowsingDataType>> = {
  cookies: 'cookies',
  httpCache: 'cache',
  localStorage: 'localStorage',
  indexedDB: 'indexedDB',
  cacheStorage: 'cacheStorage',
  serviceWorkers: 'serviceWorkers',
};

/** The shape the injected page function returns (mirrors {@link ClearStepResult}). */
interface PageStepOutcome {
  readonly stepId: string;
  readonly ok: boolean;
  readonly skipped: boolean;
  readonly bytesFreed: number;
  readonly reason?: string;
}

/**
 * Runs **in the page**, injected by `scripting.executeScript`, which serializes
 * only this function — so it must be entirely self-contained (no module helpers)
 * and takes `unknown` because the injected argument arrives untyped. It is
 * `async`, which Chrome awaits, so cache, IndexedDB and service-worker steps work
 * too. Unsupported APIs are reported as skipped, never thrown.
 */
export async function clearPageStepInPage(input: unknown): Promise<PageStepOutcome> {
  const record: Record<string, unknown> =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const stepId = typeof record.id === 'string' ? record.id : 'unknown';
  const type = typeof record.type === 'string' ? record.type : '';
  const keep = Array.isArray(record.keep)
    ? record.keep.filter((value): value is string => typeof value === 'string')
    : [];

  const done = (bytesFreed: number): PageStepOutcome => ({
    stepId,
    ok: true,
    skipped: false,
    bytesFreed,
  });
  const skipped = (reason: string): PageStepOutcome => ({
    stepId,
    ok: false,
    skipped: true,
    bytesFreed: 0,
    reason,
  });

  const clearStorage = (storage: Storage): number => {
    let freed = 0;
    const preserved = new Set(keep);
    for (const key of Object.keys(storage)) {
      if (preserved.has(key)) {
        continue;
      }
      freed += key.length + (storage.getItem(key)?.length ?? 0);
      storage.removeItem(key);
    }
    return freed;
  };

  try {
    switch (type) {
      case 'localStorage':
        return done(clearStorage(window.localStorage));
      case 'sessionStorage':
        return done(clearStorage(window.sessionStorage));
      case 'cookies': {
        const names = document.cookie
          .split(';')
          .map((part) => part.split('=')[0]?.trim() ?? '')
          .filter((name) => name !== '');
        for (const name of names) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        }
        return done(0);
      }
      case 'cacheStorage': {
        for (const name of await caches.keys()) {
          await caches.delete(name);
        }
        return done(0);
      }
      case 'indexedDB': {
        for (const database of await indexedDB.databases()) {
          if (database.name !== undefined) {
            indexedDB.deleteDatabase(database.name);
          }
        }
        return done(0);
      }
      case 'serviceWorkers': {
        if (!('serviceWorker' in navigator)) {
          return skipped('Service workers are not available');
        }
        for (const registration of await navigator.serviceWorker.getRegistrations()) {
          await registration.unregister();
        }
        return done(0);
      }
      default:
        return skipped(`"${type}" is not a page-context step`);
    }
  } catch (error: unknown) {
    return {
      stepId,
      ok: false,
      skipped: false,
      bytesFreed: 0,
      reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
}

/** The service-worker clear executor (PRD FR-6), backed by `browsingData`. */
export function createBackgroundClearExecutor(browsingData: BrowsingDataPort): StepExecutor {
  return {
    async execute(step: ClearStep): Promise<ClearStepResult> {
      const type = BROWSING_DATA_TYPES[step.type];
      if (type === undefined) {
        return {
          stepId: step.id,
          ok: false,
          skipped: true,
          bytesFreed: 0,
          reason: `"${step.type}" has no browsingData mapping`,
        };
      }
      const removed: Result<void, PlatformError> = await browsingData.remove({
        dataToRemove: [type],
        ...(step.origin === undefined ? {} : { origins: [step.origin] }),
      });
      return removed.ok
        ? { stepId: step.id, ok: true, skipped: false, bytesFreed: 0 }
        : {
            stepId: step.id,
            ok: false,
            skipped: false,
            bytesFreed: 0,
            reason: removed.error.message,
          };
    },
  };
}

/** The page clear executor (PRD FR-6), backed by `scripting.executeScript`. */
export function createPageClearExecutor(scripting: ScriptingPort, tabId: TabId): StepExecutor {
  return {
    async execute(step: ClearStep): Promise<ClearStepResult> {
      if (step.executor !== 'page') {
        return {
          stepId: step.id,
          ok: false,
          skipped: true,
          bytesFreed: 0,
          reason: `"${step.type}" runs in the background`,
        };
      }
      const injected = await scripting.executeScript({
        target: { tabId },
        func: clearPageStepInPage,
        args: [{ id: step.id, type: step.type, keep: step.keep }],
        world: 'MAIN',
      });
      if (!injected.ok) {
        return {
          stepId: step.id,
          ok: false,
          skipped: false,
          bytesFreed: 0,
          reason: injected.error.message,
        };
      }
      const outcome = injected.value[0];
      if (!isPageStepOutcome(outcome)) {
        return {
          stepId: step.id,
          ok: false,
          skipped: false,
          bytesFreed: 0,
          reason: 'the page clear step returned no result',
        };
      }
      return {
        stepId: outcome.stepId,
        ok: outcome.ok,
        skipped: outcome.skipped,
        bytesFreed: outcome.bytesFreed,
        ...(outcome.reason === undefined ? {} : { reason: outcome.reason }),
      };
    },
  };
}

function isPageStepOutcome(value: unknown): value is PageStepOutcome {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.stepId === 'string' &&
    typeof record.ok === 'boolean' &&
    typeof record.skipped === 'boolean' &&
    typeof record.bytesFreed === 'number'
  );
}
