import { expect, registerExtensionScripts, test } from '../fixtures/extension';

/**
 * FR-1 Widget shell (PRD section 6). The content script mounts the shell in the
 * shadow root: a draggable launcher and a health badge in the top frame, and the
 * panel is loaded on first open. Per ADR 0019 the shell is not run until the first
 * interaction, so before the click there is only the tiny vanilla launcher and no
 * health badge.
 */
test.describe('FR-1 widget shell', () => {
  test('shows the launcher, opens the panel on click, then shows the badge', async ({
    context,
    serviceWorker,
  }) => {
    await registerExtensionScripts(serviceWorker);

    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('devtoolwidget-root [data-devtoolwidget="status"]')).toHaveText(
      'pong',
    );

    // The document_start vanilla launcher is visible; the shell (and its health
    // badge) has not been rendered yet.
    await expect(page.locator('.dwt-launcher')).toBeVisible();
    await expect(page.locator('.dwt-health-badge')).toHaveCount(0);

    await page.locator('.dwt-launcher').click();

    // The shell runs on first interaction and the dockable panel appears.
    await expect(page.locator('.dwt-panel')).toBeVisible();
    await expect(page.locator('.dwt-panel [role="tablist"]')).toBeVisible();

    // Closing the panel reveals the shell's minimized launcher and health badge.
    await page.locator('.dwt-panel__close').click();
    await expect(page.locator('.dwt-health-badge')).toBeVisible();
  });
});
