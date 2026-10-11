import type { BrowserContext, CDPSession, Page, Worker } from '@playwright/test';
import { CONTENT_SCRIPTS, expect, registerExtensionScripts, test } from '../fixtures/extension';

const ITERATIONS = 30;
const ABLATION_ITERATIONS = 20;
const FIXTURE_PATH = '/';

/** Registers only the named site scripts (unregistering everything first). */
async function registerSubset(serviceWorker: Worker, ids: readonly string[]): Promise<void> {
  await serviceWorker.evaluate(
    async (args) => {
      const api = (
        globalThis as unknown as {
          chrome: {
            scripting: {
              getRegisteredContentScripts(): Promise<readonly { id: string }[]>;
              unregisterContentScripts(filter: { ids: readonly string[] }): Promise<void>;
              registerContentScripts(scripts: readonly unknown[]): Promise<void>;
            };
          };
        }
      ).chrome;
      const registered = await api.scripting.getRegisteredContentScripts();
      if (registered.length > 0) {
        await api.scripting.unregisterContentScripts({
          ids: registered.map((script) => script.id),
        });
      }
      const chosen = args.scripts.filter((script) => args.ids.includes(script.id));
      if (chosen.length > 0) {
        await api.scripting.registerContentScripts(chosen);
      }
    },
    { ids, scripts: CONTENT_SCRIPTS },
  );
}

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

  /**
   * Ablation: attribute the overhead to the agent, to our content script, and to
   * the fixed cost of injecting *any* content script. Series `none`, `agent-only`,
   * `content-only`, `all` run in the extension context; `bare` (no extension) and
   * `noop-content` (a minimal no-op `document_start` content script in its own
   * extension) are matched baselines. `content-only` is the production bundle, so
   * it includes the bridge and the (not-yet-executed) UI — see PERFORMANCE.md.
   */
  test('ablates the overhead across agent, content and baseline series', async ({
    context,
    serviceWorker,
    noopContext,
    bareContext,
  }) => {
    const agentOnly = ['devtoolwidget-agent'];
    const contentOnly = ['devtoolwidget-content'];
    const all = CONTENT_SCRIPTS.map((script) => script.id);

    const seriesNames = ['none', 'agent-only', 'content-only', 'all'] as const;
    const seriesIds: Record<(typeof seriesNames)[number], readonly string[]> = {
      none: [],
      'agent-only': agentOnly,
      'content-only': contentOnly,
      all,
    };
    const results: Record<string, { readonly median: number; readonly iqr: number }> = {};

    for (const name of seriesNames) {
      await registerSubset(serviceWorker, seriesIds[name]);
      const values: number[] = [];
      await measureTaskMs(context); // warm-up
      for (let index = 0; index < ABLATION_ITERATIONS; index += 1) {
        values.push(await measureTaskMs(context));
      }
      results[name] = summarize(values);
    }

    // Matched baselines: a browser with no extension at all, and one with only a
    // no-op document_start content script. Their gap is the fixed injection cost.
    for (const [name, measureContext] of [
      ['bare', bareContext],
      ['noop-content', noopContext],
    ] as const) {
      const values: number[] = [];
      await measureTaskMs(measureContext); // warm-up
      for (let index = 0; index < ABLATION_ITERATIONS; index += 1) {
        values.push(await measureTaskMs(measureContext));
      }
      results[name] = summarize(values);
    }

    const names = [...seriesNames, 'bare', 'noop-content'] as const;
    const line = (name: string): string => {
      const result = results[name] ?? { median: 0, iqr: 0 };
      return `${name}=${result.median.toFixed(1)}ms(iqr ${result.iqr.toFixed(1)})`;
    };
    console.log(
      `[ablation] platform=${process.platform} n=${String(ABLATION_ITERATIONS)} metric=TaskDuration ` +
        names.map((name) => line(name)).join(' '),
    );

    const delta = (name: string, base: string): number =>
      (results[name]?.median ?? 0) - (results[base]?.median ?? 0);
    console.log(
      `[ablation] fixed-injection=${delta('noop-content', 'bare').toFixed(1)}ms ` +
        `our-content-over-fixed=${delta('content-only', 'noop-content').toFixed(1)}ms ` +
        `agent=${delta('agent-only', 'none').toFixed(1)}ms`,
    );

    for (const name of names) {
      expect(results[name]?.median).toBeGreaterThan(0);
    }
  });
});
