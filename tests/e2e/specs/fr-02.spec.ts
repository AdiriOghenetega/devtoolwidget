import { expect, registerExtensionScripts, test } from '../fixtures/extension';

// FR-2 Overview screen (PRD section 6).
// BLOCKED: G3 — the Overview screen is not mounted or connected to the ui-state
// stores, and G1 — no live capture feeds the scores and counters.
// See docs/INTEGRATION-GAPS.md#g3.
test.fixme('FR-2 shows a health score, top three findings and live counters', async ({
  context,
  serviceWorker,
}) => {
  await registerExtensionScripts(serviceWorker);
  const page = await context.newPage();
  await page.goto('/');

  // Intended: a 0-100 score with per-category breakdown, the top three ranked
  // findings with evidence/actions, and counters for console errors, failed and
  // slow requests and total transfer size.
  await expect(page.locator('[data-devtoolwidget="status"]')).toHaveText('pong');
});
