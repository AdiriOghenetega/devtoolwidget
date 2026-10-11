import { expect, registerExtensionScripts, test } from '../fixtures/extension';

// FR-5 Performance capture (PRD section 6).
// The agent's performance collector is wired into the pipeline and streams
// typed `performance` events (long tasks, and vitals when a vitals client is
// present). This spec asserts the PANEL, which still needs Slice B (G2/G3).
// Vitals need a `web-vitals` client, which is not wired yet.
// See docs/E2E-TRACEABILITY.md.
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
