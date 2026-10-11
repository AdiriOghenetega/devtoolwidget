import { expect, waitForSiteScripts, storedNetworkBodyPreviews, test } from '../fixtures/extension';

const ORIGIN = 'http://127.0.0.1:4178';

/**
 * G13: a settings change must reach the page-world agent **without a page reload**,
 * over the real worker → content-script → agent path. Unit tests are not enough
 * here — the bridge has passed unit tests while failing in a real browser — so this
 * asserts the effect on captured data in the page.
 */
test.describe('agent runtime configuration (G13)', () => {
  test('enabling body capture for the origin reaches the agent without a reload', async ({
    context,
    serviceWorker,
  }) => {
    await waitForSiteScripts(serviceWorker);

    // Change the setting *before* the page loads, so the worker pushes it on the
    // panel-port connect and the content script forwards it to the agent.
    await serviceWorker.evaluate(async (origin) => {
      const api = (
        globalThis as unknown as {
          chrome: {
            storage: { local: { set(items: Record<string, unknown>): Promise<void> } };
          };
        }
      ).chrome;
      await api.storage.local.set({
        settings: {
          version: 1,
          value: {
            schemaVersion: 1,
            captureLevel: 'standard',
            perOriginProfiles: {
              [origin]: { captureLevel: 'standard', bodyCapture: true },
            },
            thresholds: {},
            redactionRules: [],
            retention: { maxSnapshots: 20, maxAgeDays: 30 },
            theme: 'system',
            shortcuts: {},
            onboardingCompleted: true,
          },
        },
      });
    }, ORIGIN);

    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('devtoolwidget-root [data-devtoolwidget="status"]')).toHaveText(
      'pong',
    );

    // Body capture is OFF by default; it is only on if the config reached the agent.
    await page.evaluate(() => fetch('/ok').then((response) => response.text()));

    await expect
      .poll(async () => storedNetworkBodyPreviews(serviceWorker), { timeout: 15_000 })
      .toContain('{"ok":true}');
  });
});
