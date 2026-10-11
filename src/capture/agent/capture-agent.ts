import { toMillis, type CaptureBatch, type CaptureEvent } from '../../core';
import type { ClockPort } from '../../platform/ports';
import {
  ConsoleCollector,
  type ConsoleMethod,
  type EventTargetLike,
} from '../console/console-collector';
import {
  NetworkCollector,
  type CaptureOptions,
  type FetchLike,
  type ObserverFactory,
  type ObserverLike,
  type ResourceEntryLike,
} from '../network/network-collector';
import { EventPipeline, type Scheduler } from '../pipeline/event-pipeline';
import {
  installNavigationWatcher,
  type HistoryLike,
  type NavigationTarget,
} from '../pipeline/navigation';
import {
  PerformanceCollector,
  type CapabilityGlobals,
  type PerformanceLimits,
  type VitalsClient,
} from '../performance/performance-collector';
import type { RedactedHeaders } from '../../core';

/** The navigation surface the agent watches for SPA route changes. */
export interface CaptureAgentNavigation {
  readonly target: NavigationTarget;
  readonly history: HistoryLike;
  readonly getUrl: () => string;
}

/**
 * The page surface the agent patches. It must be the object whose `fetch` and
 * event methods are actually invoked by page code (i.e. `window` itself, or an
 * adapter that writes through to it), otherwise patching would not intercept
 * anything. `fetch` is mutated by the network collector; `PerformanceObserver`
 * is the observer factory the collectors use.
 */
export interface CaptureTarget extends EventTargetLike {
  fetch?: FetchLike;
  PerformanceObserver?: ObserverFactory;
}

/** Options for {@link CaptureAgent}. */
export interface CaptureAgentOptions {
  readonly clock: ClockPort;
  readonly console: object;
  readonly target: CaptureTarget;
  readonly globals?: CapabilityGlobals;
  readonly vitals?: VitalsClient;
  readonly navigation?: CaptureAgentNavigation;
  /** Receives every flushed batch; the agent entrypoint posts it over the bridge. */
  readonly emit: (batch: CaptureBatch) => void;
  readonly capture?: Partial<CaptureOptions>;
  readonly redactHeaders?: (headers: Readonly<Record<string, string>>) => RedactedHeaders;
  readonly redactString?: (value: string) => string;
  readonly limits?: PerformanceLimits;
  readonly schedule?: Scheduler;
  readonly intervalMs?: number;
  readonly maxBuffered?: number;
  readonly createId?: () => string;
  readonly methods?: readonly ConsoleMethod[];
}

function toLongTask(entry: ResourceEntryLike): {
  readonly startTime: ReturnType<typeof toMillis>;
  readonly duration: ReturnType<typeof toMillis>;
  readonly name?: string;
} {
  return {
    startTime: toMillis(entry.startTime),
    duration: toMillis(entry.duration),
    ...(entry.name === '' ? {} : { name: entry.name }),
  };
}

/**
 * The main-world capture agent (PRD 8.1, 8.4): it boots the console, network and
 * performance collectors, funnels every typed event into one {@link EventPipeline}
 * (100 ms batching, `MAX_BATCH_EVENTS` backpressure) and hands flushed batches to
 * `emit` so the entrypoint can post them over the secure bridge. All browser
 * surfaces are injected, so the whole wiring is testable with in-memory fakes.
 */
export class CaptureAgent {
  readonly #pipeline: EventPipeline;
  readonly #console: ConsoleCollector;
  readonly #network: NetworkCollector;
  readonly #performance: PerformanceCollector;
  readonly #performanceObserver: ObserverFactory | undefined;
  readonly #navigation: CaptureAgentNavigation | undefined;
  #longTaskObserver: ObserverLike | undefined;
  #uninstallNavigation: (() => void) | undefined;
  #started = false;

  constructor(options: CaptureAgentOptions) {
    const now = (): ReturnType<ClockPort['now']> => options.clock.now();
    const push = (event: CaptureEvent): void => {
      this.#pipeline.push(event);
    };

    this.#pipeline = new EventPipeline({
      clock: options.clock,
      emit: options.emit,
      ...(options.schedule === undefined ? {} : { schedule: options.schedule }),
      ...(options.intervalMs === undefined ? {} : { intervalMs: options.intervalMs }),
      ...(options.maxBuffered === undefined ? {} : { maxBuffered: options.maxBuffered }),
    });
    this.#performanceObserver = options.target.PerformanceObserver;
    this.#navigation = options.navigation;

    this.#console = new ConsoleCollector({
      console: options.console,
      target: options.target,
      clock: options.clock,
      emit: (entry) => {
        push({ at: now(), channel: 'console', entry });
      },
      ...(options.methods === undefined ? {} : { methods: options.methods }),
      ...(options.createId === undefined ? {} : { createId: options.createId }),
    });

    this.#network = new NetworkCollector({
      target: options.target,
      clock: options.clock,
      emit: (entry) => {
        push({ at: now(), channel: 'network', entry });
      },
      ...(options.capture === undefined ? {} : { capture: options.capture }),
      ...(options.redactHeaders === undefined ? {} : { redactHeaders: options.redactHeaders }),
      ...(options.redactString === undefined ? {} : { redactString: options.redactString }),
      ...(options.createId === undefined ? {} : { createId: options.createId }),
    });

    this.#performance = new PerformanceCollector({
      globals: options.globals ?? {},
      clock: options.clock,
      emit: {
        vital: (metric) => {
          push({ at: now(), channel: 'performance', vitals: [metric], longTasks: [] });
        },
        longTask: (task) => {
          push({ at: now(), channel: 'performance', vitals: [], longTasks: [task] });
        },
        totalBlockingTime: () => undefined,
        resources: () => undefined,
        oversizedImages: () => undefined,
        capability: () => undefined,
      },
      ...(options.vitals === undefined ? {} : { vitals: options.vitals }),
      ...(options.limits === undefined ? {} : { limits: options.limits }),
    });
  }

  /** Detects capabilities, starts vitals, observes long tasks and navigations. */
  start(): void {
    if (this.#started) {
      return;
    }
    this.#started = true;
    this.#performance.start();
    this.#observeLongTasks();
    this.#installNavigation();
  }

  /** Restores every patched surface and flushes the final batch. */
  dispose(): void {
    this.#uninstallNavigation?.();
    this.#uninstallNavigation = undefined;
    this.#longTaskObserver?.disconnect();
    this.#longTaskObserver = undefined;
    this.#console.dispose();
    this.#network.dispose();
    this.#performance.dispose();
    this.#pipeline.dispose();
  }

  #observeLongTasks(): void {
    const factory = this.#performanceObserver;
    if (factory === undefined) {
      return;
    }
    const observer = factory((entries) => {
      this.#performance.addLongTasks(entries.map(toLongTask));
    });
    try {
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      // Long-task observation is best-effort.
    }
    this.#longTaskObserver = observer;
  }

  #installNavigation(): void {
    const navigation = this.#navigation;
    if (navigation === undefined) {
      return;
    }
    this.#uninstallNavigation = installNavigationWatcher({
      target: navigation.target,
      history: navigation.history,
      getUrl: navigation.getUrl,
      onChange: () => {
        this.#pipeline.navigate();
      },
    });
  }
}
