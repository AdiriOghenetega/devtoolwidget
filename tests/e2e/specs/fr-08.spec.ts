import { expect, registerExtensionScripts, test } from '../fixtures/extension';

// FR-8 Insights engine (PRD sections 6 and 10).
// BLOCKED: G1 — rules run only over collector output, and no collector output
// reaches the pipeline; G3 — findings are not surfaced in the panel.
// See docs/INTEGRATION-GAPS.md#g1.
test.fixme('FR-8 ranks findings from the live page and links each to an action', async ({
  context,
  serviceWorker,
}) => {
  await registerExtensionScripts(serviceWorker);
  const page = await context.newPage();
  await page.goto('/');

  // Intended: the R01-R17 rules fire against the fixture (404/500 responses,
  // slow request, oversized image, duplicate content, missing cache headers,
  // long task) and the results are ordered best-first with plain-language fixes.
  await expect(page.locator('devtoolwidget-root')).toBeAttached();
});
