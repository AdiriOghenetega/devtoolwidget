import { createIdFactory } from '../../core';
import { PROTOCOL_VERSION } from '../../protocol/version';
import { createClockPort } from '../../platform/chrome/clock';
import { CaptureAgent, type CaptureTarget } from '../../capture/agent/capture-agent';
import type { FetchLike, ObserverFactory } from '../../capture/network/network-collector';
import { installAgentBridge } from '../../capture/bridge/agent-bridge';
import type { CapabilityGlobals } from '../../capture/performance/performance-collector';

/** Structural view of the page `window` used for feature detection only. */
type WindowRecord = Record<string, unknown>;

/** Reads the capability flags the performance collector feature-detects. */
function capabilityGlobals(target: WindowRecord): CapabilityGlobals {
  const perf = target.performance;
  const memory =
    typeof perf === 'object' && perf !== null ? (perf as WindowRecord).memory : undefined;
  return {
    ...(typeof target.PerformanceObserver === 'function'
      ? { PerformanceObserver: target.PerformanceObserver }
      : {}),
    ...(target.PerformanceLongAnimationFrameTiming === undefined
      ? {}
      : { PerformanceLongAnimationFrameTiming: target.PerformanceLongAnimationFrameTiming }),
    ...(typeof target.requestIdleCallback === 'function'
      ? { requestIdleCallback: target.requestIdleCallback }
      : {}),
    ...(memory === undefined ? {} : { memory }),
  };
}

/** Wraps the page `PerformanceObserver` as the collector's observer factory. */
function observerFactory(): ObserverFactory | undefined {
  if (typeof PerformanceObserver !== 'function') {
    return undefined;
  }
  return (callback) => {
    const observer = new PerformanceObserver((list) => {
      callback(list.getEntries());
    });
    return {
      observe: (options) => {
        observer.observe({ entryTypes: [...options.entryTypes] });
      },
      disconnect: () => {
        observer.disconnect();
      },
    };
  };
}

/**
 * Builds the patchable page surface. It writes `fetch` changes through to
 * `window` so the network collector intercepts real page requests while the
 * event methods and the observer factory stay local to the agent.
 */
function captureTarget(): CaptureTarget {
  const target: CaptureTarget = {
    addEventListener: (type, listener, options) => {
      window.addEventListener(type, listener, options);
    },
    removeEventListener: (type, listener, options) => {
      window.removeEventListener(type, listener, options);
    },
  };
  if (typeof window.fetch === 'function') {
    const original = window.fetch.bind(window);
    Object.defineProperty(target, 'fetch', {
      configurable: true,
      enumerable: true,
      get: () => original,
      set: (value: FetchLike | undefined) => {
        if (value !== undefined) {
          window.fetch = value as typeof window.fetch;
        }
      },
    });
  }
  const observer = observerFactory();
  if (observer !== undefined) {
    target.PerformanceObserver = observer;
  }
  return target;
}

/**
 * Main-world agent (PRD 8.1, 8.4): it installs the secure bridge and, once the
 * content script commits to the port, boots {@link CaptureAgent} so the console,
 * network and performance collectors stream typed batches to the service worker
 * over the bridge. All browser surfaces are wired here; the capture logic lives
 * in `capture`.
 */
export default defineContentScript({
  registration: 'runtime',
  // No `matches`: registered per granted origin at runtime (ADR 0017/G12).
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    const bridge = installAgentBridge({ target: window });
    const createId = createIdFactory({ now: () => Date.now(), random: () => Math.random() });
    const clock = createClockPort();
    const target = captureTarget();
    const globals = capabilityGlobals(window as unknown as WindowRecord);
    let agent: CaptureAgent | undefined;

    bridge.onConnect(() => {
      if (agent !== undefined) {
        return;
      }
      agent = new CaptureAgent({
        clock,
        console: window.console,
        target,
        globals,
        navigation: {
          target: window,
          history: window.history,
          getUrl: () => window.location.href,
        },
        emit: (batch) => {
          bridge.send({
            type: 'event.batch',
            version: PROTOCOL_VERSION,
            correlationId: createId(),
            payload: { sequence: batch.sequence, dropped: batch.dropped, events: batch.events },
          });
        },
      });
      agent.start();
    });

    // Validated runtime configuration (G13): applied over the committed port,
    // never from the window. A rejected message applies nothing.
    bridge.onConfig((message) => {
      agent?.applyConfig(message.config);
    });

    // MAIN-world content scripts have no `ctx`; tear the agent down on unload.
    window.addEventListener(
      'pagehide',
      () => {
        agent?.dispose();
        bridge.dispose();
      },
      { once: true },
    );
  },
});
