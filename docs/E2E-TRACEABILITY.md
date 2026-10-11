# E2E traceability

Maps every functional requirement (PRD section 6) to its Playwright spec, the
fixture surface it exercises and its current status. The suite lives in
`tests/e2e`; the target site is the `bad-site` fixture in
`tests/fixtures/bad-site`.

## Status legend

- **smoke** — runs and must pass in CI.
- **fixme** — written and type-checked, but marked `test.fixme` because the
  extension is not wired end to end yet. `test.fixme` is skipped, so it never
  fails the build. The blocker is named in the spec and in
  [`INTEGRATION-GAPS.md`](./INTEGRATION-GAPS.md) (`G1`…`G6`).

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

| FR    | Requirement               | Spec                  | Fixture routes                                   | Status | Blocker                                                                             |
| ----- | ------------------------- | --------------------- | ------------------------------------------------ | ------ | ----------------------------------------------------------------------------------- |
| —     | Harness / extension loads | `specs/smoke.spec.ts` | `/ok`, `/`                                       | smoke  | —                                                                                   |
| FR-1  | Widget shell              | `specs/fr-01.spec.ts` | `/`                                              | fixme  | G2, G6                                                                              |
| FR-2  | Overview screen           | `specs/fr-02.spec.ts` | `/`, `/slow`, `/status/500`                      | fixme  | G1, G3                                                                              |
| FR-3  | Console capture           | `specs/fr-03.spec.ts` | `/` (Trigger error), `/app.js`                   | fixme  | G1                                                                                  |
| FR-4  | Network capture           | `specs/fr-04.spec.ts` | `/slow`, `/status/404`, `/status/500`, `/big`    | fixme  | G1                                                                                  |
| FR-5  | Performance capture       | `specs/fr-05.spec.ts` | `/huge.png`, `/blocking.js`                      | fixme  | G1                                                                                  |
| FR-6  | Storage and cache         | `specs/fr-06.spec.ts` | `/app.js`, `/sw.js`                              | fixme  | G4, G5                                                                              |
| FR-7  | Network conditions        | `specs/fr-07.spec.ts` | `/app.js`, `/nocache.js`                         | fixme  | G4                                                                                  |
| FR-8  | Insights engine           | `specs/fr-08.spec.ts` | `/duplicate`, `/nocache.js`, `/big`, `/huge.png` | fixme  | G1, G3                                                                              |
| FR-9  | Snapshots and comparison  | `specs/fr-09.spec.ts` | `/`, `/slow`                                     | fixme  | G5                                                                                  |
| FR-10 | Export and share          | `specs/fr-10.spec.ts` | `/`                                              | fixme  | G5                                                                                  |
| FR-11 | Settings and profiles     | `specs/fr-11.spec.ts` | `/`                                              | fixme  | G3                                                                                  |
| FR-12 | Deep mode                 | `specs/fr-12.spec.ts` | `/`                                              | fixme  | G4                                                                                  |
| FR-13 | Keyboard/accessibility    | `specs/fr-13.spec.ts` | `/`                                              | fixme  | G6                                                                                  |
| FR-14 | Onboarding                | `specs/fr-14.spec.ts` | `/`                                              | fixme  | G3, G6                                                                              |
| FR-15 | Browser support           | —                     | —                                                | n/a    | Out of scope: the suite is Chromium-only; Firefox coverage needs a separate runner. |

> Every in-page FR (FR-1 … FR-13) is additionally blocked by **G6** (the runtime
> scripts are not registered, so the harness must do it) and by **G7/G8** (the
> bridge ack and the command reply never reach the content script). The
> per-FR blockers above name the _specific_ missing wiring that each spec will
> assert once that FR is implemented.

## The smoke test

`specs/smoke.spec.ts` proves the harness end to end: the unpacked build loads
(valid extension id), the MV3 service worker starts and answers
(`chrome.runtime.getManifest()`), the runtime content scripts inject, and the
widget root plus its status node mount in the page.

It does **not** assert the in-page `pong` status, because the `command.ping`
round trip cannot complete with the current wiring. That is a real finding, not a
test limitation:

- **G7** — the main-world agent adopts the handshake and posts the ack, but the
  ack never reaches the content script (`agent unavailable`).
- **G8** — with a bridge present, the worker's reply is a `Result` envelope that
  the content script's `parseResult` rejects (`ping failed`).

Both are recorded in [`INTEGRATION-GAPS.md`](./INTEGRATION-GAPS.md). Assert the
status in this smoke test once they are fixed.

Because the extension does not register its own runtime scripts yet (G6), the
harness registers both bundles from the worker across all pages
(`registerExtensionScripts`) before navigating. This mirrors what
`SiteAccessService` will do once wired and is the only test-side accommodation in
the suite.

## Promoting a fixme to a real test

When a gap is closed:

1. Wire the missing entrypoint/path (see `INTEGRATION-GAPS.md`).
2. Replace `test.fixme(...)` with `test(...)` in the FR spec and make the body
   assert the real behavior.
3. Update the status in this matrix.
4. Keep the suite green: no `test.fixme` may be deleted without a passing
   replacement.
