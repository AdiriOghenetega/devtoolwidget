import { expect, waitForSiteScripts, test } from '../fixtures/extension';

// FR-10 Export and share (PRD section 6).
// BLOCKED: G5 — the export handler and the redaction pass are not wired to the
// background router.
// See docs/INTEGRATION-GAPS.md#g5.
test.fixme('FR-10 exports a redacted bug report as markdown, JSON and HAR', async ({
  context,
  serviceWorker,
}) => {
  await waitForSiteScripts(serviceWorker);
  const page = await context.newPage();
  await page.goto('/');

  // Intended: one click produces a bundle that contains no unredacted secrets
  // (the fixture's console output includes a token that must be masked) and is
  // offered for clipboard copy or download.
  await expect(page.locator('devtoolwidget-root')).toBeAttached();
});
