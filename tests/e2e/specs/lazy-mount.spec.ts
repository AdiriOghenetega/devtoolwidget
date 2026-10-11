import { expect, registerExtensionScripts, test } from '../fixtures/extension';

/**
 * Lazy mount (ADR 0019). At `document_start` the content script does only the
 * bridge, handshake and routing, and mounts a tiny vanilla launcher. The Preact
 * shell is not run before the first interaction, so there is no shell/panel DOM
 * and no health badge; clicking the launcher hands off to the shell and opens the
 * panel.
 *
 * Note: WXT inlines content-script dynamic imports (IIFE), so this asserts
 * **deferred execution** (no Preact render before interaction), not a deferred
 * chunk download. The chunk split is tracked as a follow-up gap
 * (`docs/INTEGRATION-GAPS.md`).
 */
test.describe('lazy mount (ADR 0019)', () => {
  test('renders no shell before the first interaction and opens the panel on click', async ({
    context,
    serviceWorker,
  }) => {
    await registerExtensionScripts(serviceWorker);
    const page = await context.newPage();
    await page.goto('/');

    // Routing works at document_start: the bridge handshake completed.
    await expect(page.locator('devtoolwidget-root [data-devtoolwidget="status"]')).toHaveText(
      'pong',
    );

    // Only the vanilla launcher is present; the shell has not rendered.
    await expect(page.locator('.dwt-launcher')).toBeVisible();
    await expect(page.locator('.dwt-shell')).toHaveCount(0);
    await expect(page.locator('.dwt-panel')).toHaveCount(0);
    await expect(page.locator('.dwt-health-badge')).toHaveCount(0);

    // The first interaction hands off to the shell and opens the panel.
    await page.locator('.dwt-launcher').click();
    await expect(page.locator('.dwt-panel')).toBeVisible();

    // Exactly one launcher ever: the vanilla one was removed on handoff, and after
    // closing the panel the shell's own launcher (with the health badge) is shown.
    await page.locator('.dwt-panel__close').click();
    await expect(page.locator('.dwt-health-badge')).toBeVisible();
    await expect(page.locator('.dwt-launcher')).toHaveCount(1);
  });
});
