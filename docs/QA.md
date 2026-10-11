# Manual QA

Steps that cannot be automated and must be checked by hand before a release.
Everything else is covered by `pnpm test` and `pnpm e2e` (see
[E2E-TRACEABILITY.md](./E2E-TRACEABILITY.md)).

## Site access: the permission prompt (G12, FR-15)

Chrome requires `chrome.permissions.request` to run inside a **user gesture** in
an **extension page**, and Playwright cannot click the native browser prompt. The
automated suite therefore runs against a test-only copy of the build with the
fixture host pre-granted (`prepareE2EExtension` in
`tests/e2e/fixtures/extension.ts`) and asserts that copy is never shipped
(`specs/fr-15.spec.ts`). The real prompt is verified here, by hand.

1. Build and load the extension: `pnpm build` then load `.output/chrome-mv3`
   unpacked at `chrome://extensions` (Developer mode).
2. Confirm the default: open any website. There is **no** in-page launcher. Open
   the options page (Details → Extension options, or
   `chrome-extension://<id>/options.html`); it lists **no** allowed sites.
3. With a website tab focused, open the options page and click
   **Allow on &lt;site&gt;**. Chrome shows its native warning prompt naming the
   site; accept it.
4. Confirm the grant covers the whole host on any port: the site's origin appears
   in the list **without a port** (for example `http://localhost`, not
   `http://localhost:3000`). Reload the site and on any other port of the same
   host — the launcher appears on both.
5. Confirm revoke: click **Remove** for the site. Chrome drops the host access
   (the site disappears from the list) and, after a reload, the launcher no
   longer appears.
6. Confirm revocation from the browser's own UI: `chrome://extensions` → the
   extension → **Site access** → remove the site. Reload the page; the launcher
   is gone (the worker listens for `chrome.permissions.onRemoved`).
7. Confirm a denial is harmless: click **Allow** and **Cancel** the prompt. The
   list stays empty, the launcher does not appear, and no error is shown beyond a
   plain "Access was not granted."
8. Confirm restart persistence: grant a site, fully quit and reopen the browser.
   The site is still listed and the launcher still injects (the worker reconciles
   registrations on startup).

## Privacy and redaction

- Confirm the options page's data controls still export a report whose sensitive
  values are redacted per [PRIVACY-REDACTION.md](./PRIVACY-REDACTION.md).
- Confirm the extension makes no network requests: DevTools → Network on the
  extension's own pages shows no external calls while browsing (only the site's
  own traffic).
