import { expect, waitForSiteScripts, storedChannelNames, test } from '../fixtures/extension';

/**
 * FR-2 Overview screen (PRD section 6). Once the panel opens, the store has been
 * fed by the snapshot-then-deltas stream, so the Overview shows the health
 * score, live counters and the ranked findings derived from the captured data.
 * Unblocked by Slice B.
 */
test.describe('FR-2 overview screen', () => {
  test('shows the health score, counters and findings from captured data', async ({
    context,
    serviceWorker,
  }) => {
    await waitForSiteScripts(serviceWorker);

    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('devtoolwidget-root [data-devtoolwidget="status"]')).toHaveText(
      'pong',
    );

    // Produce a failing request so the session (and therefore the Overview) has
    // real data and at least one finding.
    await page.evaluate(() => fetch('/status/500').then((response) => response.text()));
    await expect
      .poll(async () => storedChannelNames(serviceWorker), { timeout: 15_000 })
      .toContain('network');

    await page.locator('.dwt-launcher').click();

    await expect(page.locator('.dwt-overview__score')).toBeVisible();
    await expect(page.locator('.dwt-overview__counters')).toBeVisible();
    await expect(page.locator('.dwt-overview__findings .dwt-finding').first()).toBeVisible();
  });
});
