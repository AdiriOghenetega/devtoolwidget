import { expect, registerExtensionScripts, test } from '../fixtures/extension';

/**
 * The harness smoke test. It proves the whole bootstrap works in a real browser:
 * the unpacked MV3 build loads, the service worker starts, the runtime content
 * and agent scripts inject, the secure bridge handshake completes and a
 * `command.ping` round trip returns `pong` in the page.
 */
test.describe('extension smoke', () => {
  test('loads the build, starts the worker, completes the bridge and pings', async ({
    context,
    extensionId,
    serviceWorker,
  }) => {
    expect(extensionId).toMatch(/^[a-p]{32}$/);

    const manifestName = await serviceWorker.evaluate(
      () =>
        (
          globalThis as unknown as {
            chrome: { runtime: { getManifest(): { name: string } } };
          }
        ).chrome.runtime.getManifest().name,
    );
    expect(manifestName).toBe('devToolWidget');

    await registerExtensionScripts(serviceWorker);

    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('devtoolwidget-root')).toBeAttached();
    await expect(page.locator('devtoolwidget-root [data-devtoolwidget="status"]')).toHaveText(
      'pong',
    );
  });
});
