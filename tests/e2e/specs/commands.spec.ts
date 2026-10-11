import type { Page, Worker } from '@playwright/test';
import { expect, registerExtensionScripts, storedChannelNames, test } from '../fixtures/extension';

/** Reads the number of session-scoped declarativeNetRequest rules in the worker. */
function sessionRuleCount(serviceWorker: Worker): Promise<number> {
  return serviceWorker.evaluate(async () => {
    const api = (
      globalThis as unknown as {
        chrome: {
          declarativeNetRequest: { getSessionRules(): Promise<readonly unknown[]> };
        };
      }
    ).chrome;
    return (await api.declarativeNetRequest.getSessionRules()).length;
  });
}

/**
 * Opens the panel from the launcher and waits for it to be visible. It first
 * captures a request so the Overview has data and renders its quick actions
 * (an empty Overview shows the empty state instead).
 */
async function openPanel(page: Page, serviceWorker: Worker): Promise<void> {
  await expect(page.locator('devtoolwidget-root [data-devtoolwidget="status"]')).toHaveText('pong');
  await page.evaluate(() => fetch('/ok').then((response) => response.text()));
  await expect
    .poll(async () => storedChannelNames(serviceWorker), { timeout: 15_000 })
    .toContain('network');
  await page.locator('.dwt-launcher').click();
  await expect(page.locator('.dwt-panel')).toBeVisible();
  await expect(page.locator('.dwt-overview__quick-actions')).toBeVisible();
}

/**
 * Command router end to end (FR-6, FR-7; gap G4). The panel dispatches a typed
 * command over its port, the worker's router executes it through a platform port,
 * and the effect is observable: a hard reload navigates the page, and disabling
 * the cache installs a tab-scoped session rule.
 */
test.describe('command router', () => {
  test('hard reload navigates the page', async ({ context, serviceWorker }) => {
    await registerExtensionScripts(serviceWorker);
    const page = await context.newPage();
    await page.goto('/');
    await openPanel(page, serviceWorker);

    const navigated = page.waitForEvent('framenavigated');
    await page.getByRole('button', { name: 'Hard reload' }).click();
    await navigated;
  });

  // BLOCKED (G9): the router wires `toggleDisableCache` to `TabNetworkController`,
  // but the DNR rule it installs is a bare `modifyHeaders` with no header
  // modification, which Chrome rejects, and `NetworkRuleAction` cannot express
  // one. Until the rule shape/port is extended the rule is never installed, so
  // this stays fixme. The router->controller wiring is covered by
  // src/capture/session/command-router.test.ts with the fake rules port.
  test.fixme('disabling the cache installs a tab-scoped session rule', async ({
    context,
    serviceWorker,
  }) => {
    await registerExtensionScripts(serviceWorker);
    const page = await context.newPage();
    await page.goto('/');
    await openPanel(page, serviceWorker);

    await expect.poll(async () => sessionRuleCount(serviceWorker)).toBe(0);
    await page.getByRole('switch', { name: 'Disable cache' }).click();

    await expect
      .poll(async () => sessionRuleCount(serviceWorker), { timeout: 10_000 })
      .toBeGreaterThan(0);
  });
});
