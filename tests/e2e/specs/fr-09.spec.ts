import { expect, registerExtensionScripts, test } from '../fixtures/extension';

// FR-9 Snapshots and comparison (PRD section 6).
// BLOCKED: G5 — the snapshot store and the `getSnapshot` handler are not wired
// to the background router, so the panel cannot read or write snapshots.
// See docs/INTEGRATION-GAPS.md#g5.
test.fixme('FR-9 captures labelled snapshots and diffs two of them', async ({
  context,
  serviceWorker,
}) => {
  await registerExtensionScripts(serviceWorker);
  const page = await context.newPage();
  await page.goto('/');

  // Intended: capture a snapshot, change the page, capture another, then compare
  // to see metric deltas plus new and resolved findings; the 20-snapshot cap is
  // enforced and snapshots persist locally.
  await expect(page.locator('devtoolwidget-root')).toBeAttached();
});
