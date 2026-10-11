import { expect, registerExtensionScripts, test } from '../fixtures/extension';

// FR-4 Network capture (PRD section 6).
// BLOCKED: G1 — the network collector and the fetch/XHR/WebSocket wrappers are
// not wired to the content bridge.
// See docs/INTEGRATION-GAPS.md#g1.
test.fixme('FR-4 records request metadata, timing phases and failure reasons', async ({
  context,
  serviceWorker,
}) => {
  await registerExtensionScripts(serviceWorker);
  const page = await context.newPage();
  await page.goto('/');

  // Intended: the fixture's /slow, /status/404, /status/500 and /big requests
  // appear with method, status, sizes, cache hit and DNS/TLS/TTFB/download
  // timings, and can be copied as cURL or exported as a HAR subset.
  await expect(page.locator('devtoolwidget-root')).toBeAttached();
});
