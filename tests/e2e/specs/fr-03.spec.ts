import { expect, registerExtensionScripts, test } from '../fixtures/extension';

// FR-3 Console capture (PRD section 6).
// Capture is now wired end to end (gap G1 closed by Slice A): the agent's
// console collector streams typed events through the bridge into the per-tab
// session store. This spec asserts the PANEL, which still needs Slice B
// (gaps G2/G3): the widget shell and screens are not mounted yet. The capture
// half is covered by tests/e2e/specs/capture.spec.ts.
// See docs/E2E-TRACEABILITY.md.
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
