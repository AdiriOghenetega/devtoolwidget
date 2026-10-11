import { toBytes, toMillis, toTabId } from '../domain/brands';
import type { ConsoleEntry, ConsoleKind, ConsoleLevel } from '../domain/console';
import type { NetworkEntry } from '../domain/network';
import type { LongTask, MemorySample, VitalMetric } from '../domain/performance';
import type { PageSnapshot } from '../domain/snapshot';
import type { StorageAreaUsage, StorageSummary } from '../domain/storage';
import type { ImageSample, ResourceSample } from '../performance/derive';

/** Options accepted by {@link PageSnapshotBuilder.network}. */
export interface NetworkEntryOptions {
  readonly url: string;
  readonly method?: string;
  readonly status?: number | null;
  readonly resourceType?: string;
  readonly transferSize?: number;
  readonly decodedSize?: number;
  readonly fromCache?: boolean;
  readonly total?: number;
  readonly ttfb?: number;
  readonly startedAt?: number;
  readonly failure?: string;
  readonly headers?: Readonly<Record<string, string | readonly string[]>>;
}

/** Options accepted by {@link PageSnapshotBuilder.console}. */
export interface ConsoleEntryOptions {
  readonly id: string;
  readonly kind?: ConsoleKind;
  readonly level?: ConsoleLevel;
  readonly count?: number;
}

/**
 * A fluent builder for {@link PageSnapshot} test fixtures so each rule test stays
 * short. Only used by tests; pure and side-effect free.
 */
export class PageSnapshotBuilder {
  readonly #network: NetworkEntry[] = [];
  readonly #console: ConsoleEntry[] = [];
  readonly #vitals: VitalMetric[] = [];
  readonly #longTasks: LongTask[] = [];
  readonly #resources: ResourceSample[] = [];
  readonly #images: ImageSample[] = [];
  readonly #memory: MemorySample[] = [];
  #withData = false;
  #storage: StorageSummary = { areas: [] };
  #tabId = toTabId(1);
  #url = 'https://page.test/';
  #capturedAt = toMillis(0);

  tab(tabId: number): this {
    this.#tabId = toTabId(tabId);
    return this;
  }

  url(url: string): this {
    this.#url = url;
    return this;
  }

  capturedAt(millis: number): this {
    this.#capturedAt = toMillis(millis);
    return this;
  }

  network(options: NetworkEntryOptions): this {
    const zero = toMillis(0);
    this.#network.push({
      id: `n${String(this.#network.length + 1)}`,
      method: options.method ?? 'GET',
      url: options.url,
      status: options.status === undefined ? 200 : options.status,
      resourceType: options.resourceType ?? 'fetch',
      transferSize: toBytes(options.transferSize ?? 0),
      decodedSize: toBytes(options.decodedSize ?? 0),
      fromCache: options.fromCache ?? false,
      timing: {
        dns: zero,
        connect: zero,
        tls: zero,
        ttfb: toMillis(options.ttfb ?? 0),
        download: zero,
        total: toMillis(options.total ?? 0),
      },
      ...(options.failure === undefined ? {} : { failure: options.failure }),
      ...(options.startedAt === undefined ? {} : { startedAt: toMillis(options.startedAt) }),
      ...(options.headers === undefined ? {} : { headers: options.headers }),
    });
    return this;
  }

  console(options: ConsoleEntryOptions): this {
    this.#console.push({
      id: options.id,
      kind: options.kind ?? 'console',
      level: options.level ?? 'log',
      timestamp: toMillis(0),
      args: [],
      count: options.count ?? 1,
    });
    return this;
  }

  vital(metric: VitalMetric): this {
    this.#vitals.push(metric);
    return this;
  }

  longTask(task: LongTask): this {
    this.#longTasks.push(task);
    return this;
  }

  storage(areas: readonly StorageAreaUsage[]): this {
    this.#storage = { areas };
    return this;
  }

  /** Adds render-blocking / resource samples (enables R08). */
  resources(entries: readonly ResourceSample[]): this {
    this.#withData = true;
    this.#resources.push(...entries);
    return this;
  }

  /** Adds image samples (enables R15). */
  images(entries: readonly ImageSample[]): this {
    this.#withData = true;
    this.#images.push(...entries);
    return this;
  }

  /** Adds memory samples (enables R16). */
  memory(samples: readonly MemorySample[]): this {
    this.#withData = true;
    this.#memory.push(...samples);
    return this;
  }

  build(): PageSnapshot {
    return {
      tabId: this.#tabId,
      url: this.#url,
      capturedAt: this.#capturedAt,
      console: [...this.#console],
      network: [...this.#network],
      vitals: [...this.#vitals],
      longTasks: [...this.#longTasks],
      storage: this.#storage,
      ...(this.#withData ? { resources: [...this.#resources], images: [...this.#images] } : {}),
      ...(this.#withData ? { memory: [...this.#memory] } : {}),
    };
  }
}

/** Starts building a {@link PageSnapshot} fixture. */
export function aSnapshot(): PageSnapshotBuilder {
  return new PageSnapshotBuilder();
}
