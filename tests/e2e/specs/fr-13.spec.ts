import { expect, registerExtensionScripts, test } from '../fixtures/extension';

// FR-13 Keyboard and accessibility (PRD section 6).
// BLOCKED: G6 — the commands are declared in the manifest and the
// shortcut dispatcher exists, but it is never bound inside the mounted panel.
// See docs/INTEGRATION-GAPS.md#g6.
test.fixme('FR-13 toggles the panel by shortcut and is keyboard-navigable', async ({
  context,
  serviceWorker,
}) => {
  await registerExtensionScripts(serviceWorker);
  const page = await context.newPage();
  await page.goto('/');

  // Intended: Ctrl+Shift+E toggles the panel; every control is reachable by
  // keyboard with visible focus and correct ARIA names; the axe-core scan is
  // clean at WCAG 2.2 AA; shortcuts do not fire while focus is in a text field.
  await expect(page.locator('devtoolwidget-root')).toBeAttached();
});
