import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXTENSION_PATH, FIXTURE_HOST_PATTERN, FIXTURE_PORT } from '../constants';
import { expect, registeredScriptIds, test, waitForSiteScripts } from '../fixtures/extension';

// FR-15 Browser support / per-origin access (PRD section 6, G12).
//
// The grant is per origin and opt-in: a new install runs on no sites. Chrome
// requires `chrome.permissions.request` to run inside a user gesture in an
// extension page, so the grant button lives in the options page; the prompt
// itself is a manual QA step (docs/QA.md) because Playwright cannot click native
// browser UI. The suite therefore runs against a test-only copy of the build with
// the fixture host pre-granted (`prepareE2EExtension`), and asserts the shipped
// manifest has no such pre-grant.

const PRODUCTION_MANIFEST = join(EXTENSION_PATH, 'manifest.json');
const GRANTED_HOST = 'http://127.0.0.1';
const UNGRANTED_HOST = 'http://127.0.0.2';

test.describe('FR-15 per-origin access (G12)', () => {
  test('the production manifest requires no host access and ships no pre-grant hook', () => {
    const manifest = JSON.parse(readFileSync(PRODUCTION_MANIFEST, 'utf8')) as {
      host_permissions?: readonly string[];
      optional_host_permissions?: readonly string[];
    };

    // No required host permissions, so a new install can reach no site.
    expect(manifest.host_permissions ?? []).toEqual([]);
    // Host access is optional, discovered at runtime.
    expect(manifest.optional_host_permissions).toEqual(['http://*/*', 'https://*/*']);
    // The pre-grant the E2E relies on exists only in the test copy, never here.
    expect(manifest.host_permissions ?? []).not.toContain(FIXTURE_HOST_PATTERN);
  });

  test('injects only on a granted origin', async ({ context, serviceWorker }) => {
    await waitForSiteScripts(serviceWorker);

    // The pre-granted host gets the widget.
    const granted = await context.newPage();
    await granted.goto('/');
    await expect(granted.locator('devtoolwidget-root')).toBeAttached();

    // A different, ungranted host origin gets nothing. Served locally so the
    // origin is reachable without a second binding.
    await context.route(`${UNGRANTED_HOST}:${String(FIXTURE_PORT)}/`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>other</title>' }),
    );
    const other = await context.newPage();
    await other.goto(`${UNGRANTED_HOST}:${String(FIXTURE_PORT)}/`);
    await expect(other.locator('devtoolwidget-root')).toHaveCount(0);
  });

  test('lists the granted site, and revoking it unregisters access', async ({
    context,
    extensionId,
    serviceWorker,
  }) => {
    await waitForSiteScripts(serviceWorker);

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);

    // The granted host is listed by its port-less host origin.
    await expect(options.getByText(GRANTED_HOST)).toBeVisible();

    await options.getByRole('button', { name: `Remove ${GRANTED_HOST}` }).click();

    // Revoking unregisters the per-origin scripts. (The test build grants the
    // host as a *required* permission, which Chrome refuses to remove, so the
    // list entry itself persists here; permission removal is covered by the
    // manual prompt flow in docs/QA.md.)
    await expect.poll(async () => (await registeredScriptIds(serviceWorker)).length).toBe(0);

    // With the scripts unregistered the widget no longer injects on that host.
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('devtoolwidget-root')).toHaveCount(0);
  });
});
