import type { Worker } from '@playwright/test';
import { expect, registerExtensionScripts, test } from '../fixtures/extension';

/** Reads the `channel` of every capture event persisted in `storage.session`. */
function storedChannels(serviceWorker: Worker): Promise<string[]> {
  return serviceWorker.evaluate(async () => {
    const api = (
      globalThis as unknown as {
        chrome: {
          storage: { session: { get(keys: null): Promise<Record<string, unknown>> } };
        };
      }
    ).chrome;
    const stored = await api.storage.session.get(null);
    const channels: string[] = [];
    for (const entry of Object.values(stored)) {
      const session = (entry as { value?: { events?: readonly { channel?: unknown }[] } }).value;
      for (const event of session?.events ?? []) {
        if (typeof event.channel === 'string') {
          channels.push(event.channel);
        }
      }
    }
    return channels;
  });
}

/**
 * Capture wiring end to end (FR-3, FR-4; integration gap G1). The main-world
 * agent patches the page's `fetch`, batches a typed `network` event over the
 * secure bridge, the content script forwards it and the service worker stores it
 * in the per-tab session.
 */
test.describe('capture wiring', () => {
  test('streams a captured network event into the per-tab session store', async ({
    context,
    serviceWorker,
  }) => {
    await registerExtensionScripts(serviceWorker);

    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('devtoolwidget-root [data-devtoolwidget="status"]')).toHaveText(
      'pong',
    );

    // A real page fetch, intercepted by the agent's patched `fetch`.
    await page.evaluate(() => fetch('/ok').then((response) => response.text()));

    await expect
      .poll(async () => storedChannels(serviceWorker), { timeout: 15_000 })
      .toContain('network');
  });
});
