import { expect, registerExtensionScripts, test } from '../fixtures/extension';

/**
 * FR-1 Widget shell (PRD section 6). The content script mounts the shell in the
 * shadow root: a draggable launcher and a health badge in the top frame, and the
 * panel is lazy-loaded on first open. Unblocked by Slice B.
 */
test.describe('FR-1 widget shell', () => {
  test('shows the launcher and health badge and opens the panel on click', async ({
    context,
    serviceWorker,
  }) => {
    await registerExtensionScripts(serviceWorker);

    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('devtoolwidget-root [data-devtoolwidget="status"]')).toHaveText(
      'pong',
    );

    await expect(page.locator('.dwt-launcher')).toBeVisible();
    await expect(page.locator('.dwt-health-badge')).toBeVisible();

    await page.locator('.dwt-launcher').click();

    // The panel module is lazy-loaded, then the dockable panel appears.
    await expect(page.locator('.dwt-panel')).toBeVisible();
    await expect(page.locator('.dwt-panel [role="tablist"]')).toBeVisible();
  });
});
