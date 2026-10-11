import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type BrowserContext } from '@playwright/test';
import { FIXTURE_ORIGIN } from '../constants';
import { expect, registerExtensionScripts, test } from '../fixtures/extension';

const ITERATIONS = 7;

/** Loads the fixture once and returns the navigation duration in milliseconds. */
async function measure(context: BrowserContext): Promise<number> {
  const page = await context.newPage();
  await page.goto('/');
  const duration = await page.evaluate(() => {
    const entry = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    return entry === undefined ? -1 : entry.duration;
  });
  await page.close();
  return duration;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

/**
 * Main-thread load benchmark (PERFORMANCE.md). It measures the fixture page's
 * navigation duration with and without the extension and reports the medians, so
 * the injected scripts' added main-thread time is visible.
 *
 * The runtime threshold is deliberately generous (report-only in CI): on shared
 * runners timings are noisy, so a hard gate would be flaky. It fails only on a
 * catastrophic regression. The deterministic checks (size, memory) are gated hard
 * elsewhere.
 */
test.describe('performance benchmark', () => {
  test('measures load time with and without the extension', async ({ context, serviceWorker }) => {
    await registerExtensionScripts(serviceWorker);

    const plainDir = mkdtempSync(join(tmpdir(), 'dtw-bench-'));
    const plain = await chromium.launchPersistentContext(plainDir, {
      channel: 'chromium',
      headless: true,
      viewport: { width: 1280, height: 800 },
    });

    try {
      const baseline: number[] = [];
      const extended: number[] = [];
      // One warm-up each, then the measured iterations.
      await measure(plain);
      await measure(context);
      for (let index = 0; index < ITERATIONS; index += 1) {
        baseline.push(await measure(plain));
        extended.push(await measure(context));
      }

      const baselineMedian = median(baseline);
      const extendedMedian = median(extended);
      const overhead = extendedMedian - baselineMedian;
      console.log(
        `[bench] fixture=${FIXTURE_ORIGIN} n=${String(ITERATIONS)} ` +
          `without median=${baselineMedian.toFixed(1)}ms spread=${(Math.max(...baseline) - Math.min(...baseline)).toFixed(1)}ms ` +
          `with median=${extendedMedian.toFixed(1)}ms spread=${(Math.max(...extended) - Math.min(...extended)).toFixed(1)}ms ` +
          `overhead=${overhead.toFixed(1)}ms`,
      );

      expect(baselineMedian).toBeGreaterThan(0);
      expect(extendedMedian).toBeGreaterThan(0);
      // Generous relative guard: 3x + 50ms catches only catastrophic regressions.
      expect(extendedMedian).toBeLessThanOrEqual(baselineMedian * 3 + 50);
    } finally {
      await plain.close();
      rmSync(plainDir, { recursive: true, force: true });
    }
  });
});
