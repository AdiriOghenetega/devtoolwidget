import { expect, waitForSiteScripts, test } from '../fixtures/extension';

// FR-12 Deep mode (PRD section 6). Chromium only (FR-15).
// BLOCKED: G4 — the deep controller and `setThrottle`/debugger routes are not
// wired to the background router or the panel.
// See docs/INTEGRATION-GAPS.md#g4.
test.fixme('FR-12 attaches the debugger for accurate data and true throttling', async ({
  context,
  serviceWorker,
}) => {
  await waitForSiteScripts(serviceWorker);
  const page = await context.newPage();
  await page.goto('/');

  // Intended: enabling Deep mode requests the optional debugger permission,
  // shows the browser's debugging banner, applies Slow 3G and CPU throttling,
  // warns when real DevTools is open and detaches cleanly afterwards.
  await expect(page.locator('devtoolwidget-root')).toBeAttached();
});
