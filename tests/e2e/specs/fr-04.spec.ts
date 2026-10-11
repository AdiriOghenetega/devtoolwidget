import { expect, waitForSiteScripts, test } from '../fixtures/extension';

// FR-4 Network capture (PRD section 6).
// Capture is now wired end to end (gap G1 closed by Slice A): the agent's
// network collector patches `fetch` and streams typed events into the per-tab
// session store. This spec asserts the PANEL, which still needs Slice B (G2/G3).
// The capture half is covered by tests/e2e/specs/capture.spec.ts.
// See docs/E2E-TRACEABILITY.md.
test.fixme('FR-4 records request metadata, timing phases and failure reasons', async ({
  context,
  serviceWorker,
}) => {
  await waitForSiteScripts(serviceWorker);
  const page = await context.newPage();
  await page.goto('/');

  // Intended: the fixture's /slow, /status/404, /status/500 and /big requests
  // appear with method, status, sizes, cache hit and DNS/TLS/TTFB/download
  // timings, and can be copied as cURL or exported as a HAR subset.
  await expect(page.locator('devtoolwidget-root')).toBeAttached();
});
