import { expect, registerExtensionScripts, test } from '../fixtures/extension';

/**
 * The harness smoke test. It proves the E2E plumbing works end to end: the
 * unpacked MV3 build loads, the service worker starts, the runtime content
 * script injects and mounts the widget root, and the worker answers.
 *
 * It deliberately does NOT assert the in-page `pong` status. The
 * `command.ping` round trip cannot complete with the current wiring: the
 * main-world bridge ack never reaches the content script (G7) and, even when a
 * bridge is present, the worker's reply envelope is rejected by `parseResult`
 * (G8). Both are recorded in docs/INTEGRATION-GAPS.md; assert the status here
 * once they are fixed.
 */
test.describe('extension smoke', () => {
  test('loads the unpacked build, starts the worker and injects the widget root', async ({
    context,
    extensionId,
    serviceWorker,
  }) => {
    expect(extensionId).toMatch(/^[a-p]{32}$/);

    const manifestName = await serviceWorker.evaluate(
      () =>
        (
          globalThis as unknown as { chrome: { runtime: { getManifest(): { name: string } } } }
        ).chrome.runtime.getManifest().name,
    );
    expect(manifestName).toBe('devToolWidget');

    await registerExtensionScripts(serviceWorker);

    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('devtoolwidget-root')).toBeAttached();
    await expect(page.locator('devtoolwidget-root [data-devtoolwidget="status"]')).toBeAttached();
  });
});
