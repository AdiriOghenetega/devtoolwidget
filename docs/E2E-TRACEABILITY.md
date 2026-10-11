# E2E traceability

Maps every functional requirement (PRD section 6) to its Playwright spec, the
fixture surface it exercises and its current status. The suite lives in
`tests/e2e`; the target site is the `bad-site` fixture in
`tests/fixtures/bad-site`.

## Status legend

- **passing** — runs and must pass in CI.
- **fixme** — written and type-checked, but marked `test.fixme` because the
  extension is not wired end to end yet. `test.fixme` is skipped, so it never
  fails the build. The blocker is named in the spec and in
  [`INTEGRATION-GAPS.md`](./INTEGRATION-GAPS.md) (`G1`…`G15`).

## How to run

```bash
pnpm e2e:install   # one-time: downloads Chromium for Playwright
pnpm e2e           # builds the chromium-mv3 bundle, starts the fixture, runs specs
pnpm e2e:headed    # same, with a visible browser window
```

`pnpm e2e` builds the extension first (`pnpm build`); the Playwright config
starts the bad-site server itself via `webServer`.

## The bad-site fixture

`tests/fixtures/bad-site/server.ts` serves one deterministic defect per route.
Its routing is pure and unit-tested in `server.test.ts` (runs under `pnpm test`).

| Route          | Response                                             | Defect it provokes         |
| -------------- | ---------------------------------------------------- | -------------------------- |
| `/`            | HTML page with blocking scripts and an unsized image | render-blocking, CLS       |
| `/app.js`      | JS, `cache-control: public, max-age=3600`            | baseline                   |
| `/duplicate`   | identical bytes to `/app.js`, no cache headers       | duplicate content, caching |
| `/nocache.js`  | JS with **no** cache headers                         | missing cache headers      |
| `/blocking.js` | JS that busy-waits 60 ms                             | long task / TBT            |
| `/sw.js`       | service worker                                       | stale SW / cache storage   |
| `/slow`        | JSON after 1500 ms                                   | slow request               |
| `/big`         | 1 MiB, no `content-encoding`                         | large uncompressed payload |
| `/huge.png`    | ~256 KiB PNG                                         | oversized image            |
| `/status/404`  | 404                                                  | failed request             |
| `/status/500`  | 500                                                  | server error               |
| `/ok`          | `{"ok":true}`                                        | server readiness probe     |
| `/favicon.ico` | 204                                                  | quiet baseline             |

## Matrix

| FR    | Requirement               | Spec                            | Fixture routes                                   | Status  | Blocker                                                                                                                              |
| ----- | ------------------------- | ------------------------------- | ------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| —     | Harness / extension loads | `specs/smoke.spec.ts`           | `/ok`, `/`                                       | passing | —                                                                                                                                    |
| —     | Capture wiring (G1)       | `specs/capture.spec.ts`         | `/ok`                                            | passing | —                                                                                                                                    |
| —     | Bridge hardening (G7)     | `specs/bridge-security.spec.ts` | `/spy`                                           | passing | —                                                                                                                                    |
| —     | Command router (G4)       | `specs/commands.spec.ts`        | `/`, `/ok`                                       | passing | hard reload only; disable-cache is `fixme` (G9)                                                                                      |
| —     | Agent config (G13)        | `specs/agent-config.spec.ts`    | `/`, `/ok`                                       | passing | a settings change reaches the agent without a reload                                                                                 |
| FR-1  | Widget shell              | `specs/fr-01.spec.ts`           | `/`                                              | passing | —                                                                                                                                    |
| FR-2  | Overview screen           | `specs/fr-02.spec.ts`           | `/`, `/slow`, `/status/500`                      | passing | —                                                                                                                                    |
| FR-3  | Console capture           | `specs/fr-03.spec.ts`           | `/` (Trigger error), `/app.js`                   | fixme   | storage/snapshots tabs (Slice C); capture done (Slice A)                                                                             |
| FR-4  | Network capture           | `specs/fr-04.spec.ts`           | `/slow`, `/status/404`, `/status/500`, `/big`    | fixme   | capture done (Slice A); richer detail (Slice C)                                                                                      |
| FR-5  | Performance capture       | `specs/fr-05.spec.ts`           | `/huge.png`, `/blocking.js`                      | fixme   | vitals client                                                                                                                        |
| FR-6  | Storage and cache         | `specs/fr-06.spec.ts`           | `/app.js`, `/sw.js`                              | fixme   | storage tab (Slice D); clearStorage handler wired (Slice C)                                                                          |
| FR-7  | Network conditions        | `specs/fr-07.spec.ts`           | `/app.js`, `/nocache.js`                         | fixme   | G9 (DNR rule shape), G10 (throttle application)                                                                                      |
| FR-8  | Insights engine           | `specs/fr-08.spec.ts`           | `/duplicate`, `/nocache.js`, `/big`, `/huge.png` | fixme   | G3 (rules run; panel surfacing partial)                                                                                              |
| FR-9  | Snapshots and comparison  | `specs/fr-09.spec.ts`           | `/`, `/slow`                                     | fixme   | G5                                                                                                                                   |
| FR-10 | Export and share          | `specs/fr-10.spec.ts`           | `/`                                              | fixme   | G5                                                                                                                                   |
| FR-11 | Settings and profiles     | `specs/fr-11.spec.ts`           | `/`                                              | fixme   | G3                                                                                                                                   |
| FR-12 | Deep mode                 | `specs/fr-12.spec.ts`           | `/`                                              | fixme   | G4                                                                                                                                   |
| FR-13 | Keyboard/accessibility    | `specs/fr-13.spec.ts`           | `/`                                              | fixme   | G6, shortcut binding                                                                                                                 |
| FR-14 | Onboarding                | `specs/fr-14.spec.ts`           | `/`                                              | fixme   | G3, G6                                                                                                                               |
| FR-15 | Browser support           | `specs/fr-15.spec.ts`           | `/`                                              | passing | Chromium-only suite. Per-origin access: no required host access, injects only on a granted origin, options page lists/revokes (G12). |

> Slice A closed **G1**, **G7** and **G8**; Slice B closed **G2** and wired the
> Overview + console/network/performance screens (G3), so `fr-01` and `fr-02` now
> pass. The remaining in-page FRs are additionally blocked by **G6** (the runtime
> scripts are not registered, so the harness does it until Slice D) and by the
> Slice C command handlers where they need actions. The per-FR blockers above name
> the _specific_ missing wiring each spec will assert once that FR is implemented.

## The passing specs

`specs/smoke.spec.ts` proves the bootstrap end to end: the unpacked build loads
(valid extension id), the MV3 service worker starts and answers
(`chrome.runtime.getManifest()`), the runtime content scripts inject, the secure
bridge connects and a `command.ping` round trip sets the in-page status to `pong`.

`specs/capture.spec.ts` proves the capture wiring (G1 closed): after the bridge
connects, a real page `fetch` is intercepted by the agent's patched `fetch`,
batched as a typed `network` event, forwarded by the content script and stored in
the worker's per-tab `storage.session` session.

`specs/bridge-security.spec.ts` proves the bridge is still hardened (G7 fix did
not weaken it): the `/spy` fixture registers a **capturing** `message` listener
after the agent — the strongest position a page script can reach — and it must
observe zero bridge messages, zero transferred ports and zero capture batches,
while the bridge still reports `pong`.

`specs/fr-15.spec.ts` proves per-origin access (G12): the shipped manifest
requires no host access, the extension injects only on a granted host (and not on
an ungranted one), and the options page lists the granted host and revokes it.

Because the extension now registers its own runtime scripts for granted origins
(G12), the harness registers nothing itself: it waits for the extension's
registration (`waitForSiteScripts`) after the test build pre-grants the fixture
host. Playwright cannot click the native permission prompt and Chromium offers no
supported way to grant an optional host to an unpacked extension from outside it,
so the suite loads a test-only copy of the build whose manifest has the fixture
host as a required `host_permissions` grant (`prepareE2EExtension`).
`specs/fr-15.spec.ts` asserts that pre-grant is never in the shipped manifest, and
the real prompt flow is a manual step in [`QA.md`](./QA.md).

## Promoting a fixme to a real test

When a gap is closed:

1. Wire the missing entrypoint/path (see `INTEGRATION-GAPS.md`).
2. Replace `test.fixme(...)` with `test(...)` in the FR spec and make the body
   assert the real behavior.
3. Update the status in this matrix.
4. Keep the suite green: no `test.fixme` may be deleted without a passing
   replacement.
