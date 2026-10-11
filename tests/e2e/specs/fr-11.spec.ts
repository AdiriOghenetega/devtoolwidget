import { expect, waitForSiteScripts, test } from '../fixtures/extension';

// FR-11 Settings and profiles (PRD section 6).
// BLOCKED: G3 — the settings service and options page exist, but per-origin
// profiles are never applied to the running capture pipeline.
// See docs/INTEGRATION-GAPS.md#g3.
test.fixme('FR-11 applies per-origin profiles and imports/exports settings', async ({
  context,
  serviceWorker,
}) => {
  await waitForSiteScripts(serviceWorker);
  const page = await context.newPage();
  await page.goto('/');

  // Intended: a profile matching 127.0.0.1 changes the capture level and insight
  // thresholds for this page, and settings round-trip through export/import.
  await expect(page.locator('devtoolwidget-root')).toBeAttached();
});
