import { expect, registerExtensionScripts, test } from '../fixtures/extension';

// FR-7 Network conditions (PRD section 6).
// BLOCKED: G4 — the background router only handles `command.ping`; the
// `toggleDisableCache` and `setThrottle` commands return `unsupported`.
// See docs/INTEGRATION-GAPS.md#g4.
test.fixme('FR-7 toggles disable-cache for the tab and simulates latency', async ({
  context,
  serviceWorker,
}) => {
  await registerExtensionScripts(serviceWorker);
  const page = await context.newPage();
  await page.goto('/');

  // Intended: enabling disable-cache adds a session declarativeNetRequest rule
  // scoped to the tab, so a reload re-fetches /app.js from the network.
  await expect(page.locator('devtoolwidget-root')).toBeAttached();
});
