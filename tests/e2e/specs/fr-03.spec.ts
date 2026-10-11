import { expect, registerExtensionScripts, test } from '../fixtures/extension';

// FR-3 Console capture (PRD section 6).
// BLOCKED: G1 — the console collector exists but is not wired to the content
// bridge or the event pipeline, so nothing reaches the panel.
// See docs/INTEGRATION-GAPS.md#g1.
test.fixme('FR-3 captures console output, uncaught errors and CSP violations', async ({
  context,
  serviceWorker,
}) => {
  await registerExtensionScripts(serviceWorker);
  const page = await context.newPage();
  await page.goto('/');

  // Intended: clicking "Trigger error" on the fixture surfaces an error finding
  // with a stack; duplicate collapsing, filtering and the 1000-entry ring buffer
  // behave as specified.
  await expect(page.locator('devtoolwidget-root')).toBeAttached();
});
