import { expect, registerExtensionScripts, test } from '../fixtures/extension';

// FR-1 Widget shell (PRD section 6).
// BLOCKED: G2 — the content script calls `hostWidgetRoot()` and sets a status
// label only; the Shell (launcher, health badge, draggable panel) is never
// mounted, and G6 — the runtime scripts are not registered by the extension.
// See docs/INTEGRATION-GAPS.md#g2 and docs/E2E-TRACEABILITY.md.
test.fixme('FR-1 shows a draggable, snapping launcher and opens a Shadow-DOM panel', async ({
  context,
  serviceWorker,
}) => {
  await registerExtensionScripts(serviceWorker);
  const page = await context.newPage();
  await page.goto('/');

  // Intended: the launcher is visible; dragging it snaps to an edge and the
  // position survives a reload (per-site persistence); the panel is isolated in
  // a shadow root and does not block page interaction outside its bounds.
  await expect(page.locator('devtoolwidget-root')).toBeVisible();
});
