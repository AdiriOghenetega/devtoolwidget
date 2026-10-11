import type { Millis, TabId } from '../domain/brands';
import type { CaptureEvent } from '../domain/capture-event';
import type { ConsoleEntry } from '../domain/console';
import type { NetworkEntry } from '../domain/network';
import type { LongTask, VitalMetric } from '../domain/performance';
import type { PageSnapshot } from '../domain/snapshot';
import type { StorageSummary } from '../domain/storage';

/** Inputs for {@link foldCaptureEvents}. */
export interface FoldInput {
  readonly tabId: TabId;
  readonly capturedAt: Millis;
  readonly url?: string;
  readonly events: readonly CaptureEvent[];
}

/**
 * Folds a flat list of typed capture events into a {@link PageSnapshot}. Console
 * and network entries are concatenated in order, vitals are deduplicated by name
 * (last wins), long tasks are concatenated and the storage summary is last-wins.
 * Pure, so the service worker can rebuild the current page state from the
 * per-tab session on demand.
 */
export function foldCaptureEvents(input: FoldInput): PageSnapshot {
  const console: ConsoleEntry[] = [];
  const network: NetworkEntry[] = [];
  const vitals = new Map<VitalMetric['name'], VitalMetric>();
  const longTasks: LongTask[] = [];
  let storage: StorageSummary = { areas: [] };

  for (const event of input.events) {
    switch (event.channel) {
      case 'console':
        console.push(event.entry);
        break;
      case 'network':
        network.push(event.entry);
        break;
      case 'performance':
        for (const metric of event.vitals) {
          vitals.set(metric.name, metric);
        }
        longTasks.push(...event.longTasks);
        break;
      case 'storage':
        storage = event.summary;
        break;
    }
  }

  return {
    tabId: input.tabId,
    url: input.url ?? '',
    capturedAt: input.capturedAt,
    console,
    network,
    vitals: [...vitals.values()],
    longTasks,
    storage,
  };
}
