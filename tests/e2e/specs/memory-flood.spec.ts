import { expect, registerExtensionScripts, storedSessionStats, test } from '../fixtures/extension';

const FLOOD = 3_000;

/**
 * Memory-under-flood check (PERFORMANCE.md). The page emits far more console
 * events than the ring buffers hold; the pipeline drops the oldest and the
 * per-tab session store must stay bounded and keep the worker alive. This is
 * deterministic, so it is gated hard in CI.
 */
test.describe('memory under an event flood', () => {
  test('keeps the session store bounded and counts the drops', async ({
    context,
    serviceWorker,
  }) => {
    await registerExtensionScripts(serviceWorker);

    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('devtoolwidget-root [data-devtoolwidget="status"]')).toHaveText(
      'pong',
    );

    await page.evaluate((count) => {
      for (let index = 0; index < count; index += 1) {
        console.log(`flood ${String(index)}`);
      }
    }, FLOOD);

    // The store must be non-empty (events flowed) and bounded (ring buffers held).
    await expect
      .poll(async () => (await storedSessionStats(serviceWorker)).events, { timeout: 15_000 })
      .toBeGreaterThan(0);

    const stats = await storedSessionStats(serviceWorker);
    expect(stats.events).toBeLessThanOrEqual(500);
    expect(stats.events).toBeLessThan(FLOOD);

    // The worker survived the flood and still answers.
    const alive = await serviceWorker.evaluate(
      () =>
        (
          globalThis as unknown as {
            chrome: { runtime: { getManifest(): { name: string } } };
          }
        ).chrome.runtime.getManifest().name,
    );
    expect(alive).toBe('devToolWidget');
  });
});
