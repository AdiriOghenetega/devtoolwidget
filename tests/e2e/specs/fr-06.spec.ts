import { expect, registerExtensionScripts, test } from '../fixtures/extension';

// FR-6 Storage and cache actions (PRD section 6).
// BLOCKED: G5 — the clear orchestration exists but its executors are not
// invoked from the panel, and G4 — the "clear site data" route is not wired.
// See docs/INTEGRATION-GAPS.md#g5.
test.fixme('FR-6 inspects and clears cookies, storage, caches and service workers', async ({
  context,
  serviceWorker,
}) => {
  await registerExtensionScripts(serviceWorker);
  const page = await context.newPage();
  await page.goto('/');

  // Intended: counts and approximate sizes are shown per store; clearing the
  // current origin (with confirmation) removes /app.js from the HTTP cache, as
  // proven by a subsequent no-cache request.
  await expect(page.locator('devtoolwidget-root')).toBeAttached();
});
