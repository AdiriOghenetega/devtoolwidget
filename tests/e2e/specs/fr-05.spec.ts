import { expect, registerExtensionScripts, test } from '../fixtures/extension';

// FR-5 Performance capture (PRD section 6).
// BLOCKED: G1 — the performance collector is not wired to the content bridge,
// so no metrics reach the panel.
// See docs/INTEGRATION-GAPS.md#g1.
test.fixme('FR-5 reports Core Web Vitals with attribution and long tasks', async ({
  context,
  serviceWorker,
}) => {
  await registerExtensionScripts(serviceWorker);
  const page = await context.newPage();
  await page.goto('/');

  // Intended: LCP/CLS/INP/FCP/TTFB are reported with element/interaction
  // attribution; the fixture's unsized /huge.png drives a CLS finding and
  // /blocking.js produces a long task and a total-blocking-time estimate.
  await expect(page.locator('devtoolwidget-root')).toBeAttached();
});
