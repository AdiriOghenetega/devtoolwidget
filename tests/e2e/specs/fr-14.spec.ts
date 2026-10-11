import { expect, registerExtensionScripts, test } from '../fixtures/extension';

// FR-14 Onboarding (PRD section 6).
// BLOCKED: G3/G6 — the first-run flow records state in the worker but never
// opens the options page or mounts the in-panel tour.
// See docs/INTEGRATION-GAPS.md#g3.
test.fixme('FR-14 shows the first-run tour and a data-handling statement', async ({
  context,
  serviceWorker,
}) => {
  await registerExtensionScripts(serviceWorker);
  const page = await context.newPage();
  await page.goto('/');

  // Intended: on a fresh profile the options page opens with the tour, a
  // plain-language explanation of each permission and a visible data-handling
  // statement; completing the tour stops it from showing again.
  await expect(page.locator('devtoolwidget-root')).toBeAttached();
});
