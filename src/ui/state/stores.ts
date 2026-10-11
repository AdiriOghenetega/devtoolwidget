import { computed, signal, type Signal } from '@preact/signals';
import {
  ALL_INSIGHT_RULES,
  computeHealthScore,
  runInsights,
  toMillis,
  toTabId,
  type CaptureEvent,
  type ConsoleEntry,
  type Finding,
  type HealthScore,
  type LongTask,
  type NetworkEntry,
  type PageSnapshot,
  type StorageSummary,
  type VitalMetric,
} from '../../core';
import type { PanelMessage } from '../../protocol';

/** The widget's connection to the page/capture backend. */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/** Bound on retained console entries. */
export const CONSOLE_CAP = 500;
/** Bound on retained network entries. */
export const NETWORK_CAP = 1_000;

/** The read model the screen renders from. */
export interface OverviewStore {
  readonly connection: Signal<ConnectionStatus>;
  readonly findings: Signal<readonly Finding[]>;
  readonly topFindings: Signal<readonly Finding[]>;
  readonly health: Signal<HealthScore>;
  readonly consoleErrors: Signal<number>;
  readonly networkCount: Signal<number>;
  readonly isEmpty: Signal<boolean>;
  readonly console: Signal<readonly ConsoleEntry[]>;
  readonly network: Signal<readonly NetworkEntry[]>;
  readonly vitals: Signal<readonly VitalMetric[]>;
  readonly longTasks: Signal<readonly LongTask[]>;
  readonly storage: Signal<StorageSummary>;
  applySnapshot(snapshot: PageSnapshot): void;
  applyEvent(event: CaptureEvent): void;
  applyPanelMessage(message: PanelMessage): void;
  setConnection(status: ConnectionStatus): void;
}

function isErrorEntry(entry: ConsoleEntry): boolean {
  return entry.kind === 'uncaught' || entry.kind === 'rejection' || entry.level === 'error';
}

function insertBounded<T extends { readonly id: string }>(
  map: Map<string, T>,
  entry: T,
  cap: number,
): Map<string, T> {
  const next = new Map(map);
  next.delete(entry.id);
  next.set(entry.id, entry);
  while (next.size > cap) {
    const oldest = next.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    next.delete(oldest);
  }
  return next;
}

/**
 * Signal stores per domain, fed from protocol messages, with derived selectors
 * (counts, findings, health). The console and network stores are keyed by id so
 * re-delivered events (e.g. after a reconnect) do not duplicate.
 */
export function createOverviewStore(): OverviewStore {
  const consoleMap = signal<Map<string, ConsoleEntry>>(new Map());
  const networkMap = signal<Map<string, NetworkEntry>>(new Map());
  const vitals = signal<readonly VitalMetric[]>([]);
  const longTasks = signal<readonly LongTask[]>([]);
  const storage = signal<StorageSummary>({ areas: [] });
  const snapshotAt = signal(0);
  const connection = signal<ConnectionStatus>('connecting');

  const snapshot = (): PageSnapshot => ({
    tabId: toTabId(0),
    url: '',
    capturedAt: toMillis(snapshotAt.value),
    console: [...consoleMap.value.values()],
    network: [...networkMap.value.values()],
    vitals: vitals.value,
    longTasks: longTasks.value,
    storage: storage.value,
  });

  const findings = computed<readonly Finding[]>(
    () => runInsights(snapshot(), { rules: ALL_INSIGHT_RULES }).findings,
  );
  const health = computed(() => computeHealthScore(findings.value));
  const topFindings = computed(() => findings.value.slice(0, 3));
  const consoleErrors = computed(
    () => [...consoleMap.value.values()].filter((entry) => isErrorEntry(entry)).length,
  );
  const networkCount = computed(() => networkMap.value.size);
  const isEmpty = computed(
    () => consoleMap.value.size === 0 && networkMap.value.size === 0 && vitals.value.length === 0,
  );
  const consoleEntries = computed<readonly ConsoleEntry[]>(() => [...consoleMap.value.values()]);
  const networkEntries = computed<readonly NetworkEntry[]>(() => [...networkMap.value.values()]);

  const applySnapshot = (incoming: PageSnapshot): void => {
    snapshotAt.value = Number(incoming.capturedAt);
    consoleMap.value = new Map(incoming.console.map((entry) => [entry.id, entry]));
    networkMap.value = new Map(incoming.network.map((entry) => [entry.id, entry]));
    vitals.value = incoming.vitals;
    longTasks.value = incoming.longTasks;
    storage.value = incoming.storage;
  };

  const applyEvent = (event: CaptureEvent): void => {
    switch (event.channel) {
      case 'console': {
        if (Number(event.entry.timestamp) < snapshotAt.value) {
          return; // Older than the snapshot we already applied.
        }
        consoleMap.value = insertBounded(consoleMap.value, event.entry, CONSOLE_CAP);
        return;
      }
      case 'network':
        networkMap.value = insertBounded(networkMap.value, event.entry, NETWORK_CAP);
        return;
      case 'performance': {
        const merged = new Map(vitals.value.map((metric) => [metric.name, metric]));
        for (const metric of event.vitals) {
          merged.set(metric.name, metric);
        }
        vitals.value = [...merged.values()];
        longTasks.value = [...longTasks.value, ...event.longTasks];
        return;
      }
      case 'storage':
        storage.value = event.summary;
        return;
    }
  };

  return {
    connection,
    findings,
    topFindings,
    health,
    consoleErrors,
    networkCount,
    isEmpty,
    console: consoleEntries,
    network: networkEntries,
    vitals,
    longTasks,
    storage,
    applySnapshot,
    applyEvent,
    applyPanelMessage(message: PanelMessage) {
      if (message.type === 'panel.snapshot') {
        applySnapshot(message.payload);
        return;
      }
      applyEvent(message.payload);
    },
    setConnection(status) {
      connection.value = status;
    },
  };
}
