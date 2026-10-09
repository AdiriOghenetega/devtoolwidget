# 5. Target Manifest V3 on both Chromium and Firefox

- Status: Accepted
- Date: 2026-10-08

## Context

WXT defaults the Firefox build to Manifest V2 when `manifestVersion` is unset, so the
scaffold's `build:firefox` script produced a `firefox-mv2` artifact while the project is
documented as MV3 (PRD §7, §11; ADR 0002). MDN's `background` manifest reference
(verified 2026-10-08) states that Firefox does **not** support
`background.service_worker`; a Firefox MV3 background runs as an event page via
`background.scripts`, whereas Chrome MV3 runs a service worker. Cross-browser MV3
extensions declare both and let each browser pick.

## Decision

- Pin `manifestVersion: 3` in `wxt.config.ts` so both targets build MV3
  (`chrome-mv3`, `firefox-mv3`).
- Treat the background as an **event page on Firefox and a service worker on Chrome**.
  Platform code must not assume service-worker APIs: no reliance on SW-only globals,
  event shapes, or lifetime guarantees. Any background-lifecycle assumption is isolated
  behind a platform port.

## Consequences

- A green `build:firefox` now produces `firefox-mv3`; this must be checked when the
  background gains real behavior.
- Features that require a service worker specifically (for example, some Deep-mode /
  `chrome.debugger` flows, which are Chromium-only per PRD §7) must be feature-detected
  or gated to Chromium rather than assumed present.
