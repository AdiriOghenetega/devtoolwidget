import type { BrowserContext, CDPSession, Page, Worker } from '@playwright/test';
import { expect, registerExtensionScripts, test } from '../fixtures/extension';

const ITERATIONS = 30;
const FIXTURE_PATH = '/';

/** Reads the cumulative `TaskDuration` (seconds) from the CDP performance metrics. */
async function taskDurationSeconds(cdp: CDPSession): Promise<number> {
  const result = (await cdp.send('Performance.getMetrics')) as {
    metrics: readonly { name: string; value: number }[];
  };
  return result.metrics.find((metric) => metric.name === 'TaskDuration')?.value ?? 0;
}

/**
 * Loads the fixture once in the **same extension-enabled context** and returns the
 * main-thread task time the load cost, in milliseconds, via CDP
 * `Performance.getMetrics` (`TaskDuration` delta across the navigation).
 */
async function measureTaskMs(context: BrowserContext): Promise<number> {
  const page: Page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const before = await taskDurationSeconds(cdp);
  await page.goto(FIXTURE_PATH);
  await page.waitForLoadState('load');
  const after = await taskDurationSeconds(cdp);
  await page.close();
  return (after - before) * 1_000; // CDP durations are seconds.
}

/** Linear-interpolation percentile of a sorted ascending array. */
function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const rank = fraction * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  const lowValue = sorted[low] ?? 0;
  const highValue = sorted[high] ?? lowValue;
  return lowValue + (highValue - lowValue) * (rank - low);
}

function summarize(values: readonly number[]): {
  readonly median: number;
  readonly q1: number;
  readonly q3: number;
  readonly iqr: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  const median = percentile(sorted, 0.5);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  return { median, q1, q3, iqr: q3 - q1 };
}

async function unregisterAllSiteScripts(serviceWorker: Worker): Promise<void> {
  await serviceWorker.evaluate(async () => {
    const api = (
      globalThis as unknown as {
        chrome: {
          scripting: {
            getRegisteredContentScripts(): Promise<readonly { id: string }[]>;
            unregisterContentScripts(filter: { ids: readonly string[] }): Promise<void>;
          };
        };
      }
    ).chrome;
    const registered = await api.scripting.getRegisteredContentScripts();
    if (registered.length > 0) {
      await api.scripting.unregisterContentScripts({ ids: registered.map((script) => script.id) });
    }
  });
}

/**
 * Main-thread load cost benchmark (see `docs/PERFORMANCE.md`). It uses the **same
 * extension-enabled context** and compares the fixture load **with the site
 * scripts registered** (access granted/active) against **not registered** (access
 * not granted), N=30 each, measuring the main-thread `TaskDuration` delta via CDP
 * rather than navigation duration. Medians and interquartile ranges are reported.
 *
 * The runtime threshold is deliberately generous: on shared runners timings are
 * noisy, so this is report-only in spirit. Deterministic checks (size, memory) are
 * gated hard elsewhere.
 */
test.describe('performance benchmark', () => {
  test('measures main-thread task cost with and without site access', async ({
    context,
    serviceWorker,
  }) => {
    await unregisterAllSiteScripts(serviceWorker);
    const inactive: number[] = [];
    await measureTaskMs(context); // warm-up
    for (let index = 0; index < ITERATIONS; index += 1) {
      inactive.push(await measureTaskMs(context));
    }

    await registerExtensionScripts(serviceWorker);
    const active: number[] = [];
    await measureTaskMs(context); // warm-up
    for (let index = 0; index < ITERATIONS; index += 1) {
      active.push(await measureTaskMs(context));
    }

    const base = summarize(inactive);
    const withScripts = summarize(active);
    const overhead = withScripts.median - base.median;
    console.log(
      `[bench] platform=${process.platform} n=${String(ITERATIONS)} metric=TaskDuration ` +
        `inactive median=${base.median.toFixed(1)}ms iqr=${base.iqr.toFixed(1)}ms ` +
        `active median=${withScripts.median.toFixed(1)}ms iqr=${withScripts.iqr.toFixed(1)}ms ` +
        `overhead=${overhead.toFixed(1)}ms`,
    );

    expect(base.median).toBeGreaterThan(0);
    expect(withScripts.median).toBeGreaterThan(0);
    // Generous relative guard: only a catastrophic regression fails.
    expect(withScripts.median).toBeLessThanOrEqual(base.median * 3 + 50);
  });
});
