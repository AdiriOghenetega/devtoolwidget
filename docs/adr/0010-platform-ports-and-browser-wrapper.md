# 10. Platform ports, adapters and the browser wrapper

- Status: Accepted
- Date: 2026-10-09

## Context

`src/platform` must expose ports for browser capabilities, real adapters and
in-memory fakes, without leaking browser globals into `core` or `capture` (PRD 8.2,
8.3). The widget also needs to choose how it reaches the extension APIs: WXT's
unified `browser` wrapper or the `webextension-polyfill` package.

## Decision

### Browser wrapper: WXT's `browser`

Use `browser` from `wxt/browser`, not `webextension-polyfill`. WXT's wrapper is a
one-line export of the browser's native `browser`/`chrome` global
(`globalThis.browser?.runtime?.id ? browser : chrome`), so it gives the promise-style
API across MV2/MV3 and all browsers (WXT Extension APIs docs, checked 2026-10). It
ships with the framework, so there is no extra runtime dependency; WXT additionally
offers `@wxt-dev/webextension-polyfill` if a polyfill is ever needed. Chrome 148+
also exposes the standardised `browser.*` namespace natively.

### Injected browser API, not a global

Adapters never import a global. They accept a narrow structural `BrowserApi`
(`src/platform/chrome/browser-api.ts`) that only describes the methods used. The
entrypoint wiring passes WXT's `browser`; tests pass a mock. This keeps the adapters
unit-testable and honest about which API surface they touch.

### Result-based errors

Every adapter method returns `core`'s `Result<T, PlatformError>`. Thrown browser
errors are mapped by `toPlatformError` to a `PlatformErrorCode` (`quota-exceeded`,
`not-found`, `permission-denied`, `unsupported`, ...). Nothing throws across the port
boundary.

### Fakes with fidelity

`src/platform/fakes` provides in-memory ports, including a quota-aware fake storage
that fails with `quota-exceeded`. A shared contract suite
(`tests/platform/contract.ts`) runs the same behaviour tests against the fakes and
against the Chrome adapters over a mocked browser (`tests/platform/mock-browser.ts`).

## Differences from the PRD (checked against developer.chrome.com, 2026-09)

- **Network throttling (PRD FR-7).** There is no extension API to set DevTools network
  throttling. `setThrottle` must be implemented through the Debugger port with the CDP
  `Network.emulateNetworkConditions` command, which is **Chromium-only**. The
  `setThrottle` profile enum stays as a domain concept; the adapter path is CDP.
- **Disable cache (PRD FR-7).** There is no standalone toggle. The closest primitives
  are `tabs.reload({ bypassCache: true })` and CDP `Network.setCacheDisabled`; a DNR
  session rule can approximate header caching but cannot disable the HTTP cache.
- **Side panel (PRD FR-1/FR-2).** `chrome.sidePanel` is **Chrome 114+, MV3 only**, needs
  the `sidePanel` permission, and `sidePanel.open()` (Chrome 116+) must run from a user
  gesture. Firefox has no `sidePanel` API (it uses `sidebar_action`), so the port is
  feature-detected and Chromium-only in practice.
- **Declarative Net Request session rules (PRD FR-7).** Require the
  `declarativeNetRequest` or `declarativeNetRequestWithHostAccess` permission; session
  rules are **cleared on browser shutdown and on extension update**, and are capped at
  **5000 session rules**. Matches the PRD's "session rules" intent.
- **Debugger (PRD FR-8).** `chrome.debugger` is Chromium-only; this already matches the
  PRD's "Deep mode is Chromium-only".
- **Storage (PRD FR-1).** `storage.local` has a ~10 MB quota and `storage.session` a
  separate smaller quota; both fail with `QUOTA_BYTES`, mapped to `quota-exceeded`.
  `storage.session` is not exposed to content scripts by default, so the main-world
  bridge must go through the background.
- **Browsing data (PRD FR-6).** `browsingData.remove` needs the `browsingData`
  permission and clears by data type; the `origins` filter (per-origin clears) is
  Chrome 96+. There is no "fresh visitor" preset API; the presets compose
  `browsingData.remove` with `tabs.reload`.
- **Scripting (PRD 7).** `scripting.executeScript` needs the `scripting` permission plus
  host permissions or `activeTab`; the `MAIN` world is Chrome 102+ and support in
  Firefox is narrower, so the main-world bridge needs feature detection.
- **Tabs (PRD FR-7/FR-9).** `tabs.reload({ bypassCache })` is a Chrome flag; Firefox
  ignores it. Tab reads need `tabs`/`activeTab` and host permissions.
- **Commands (PRD FR-1).** Requires the manifest `commands` key; `_execute_action` is
  reserved.

## Consequences

- `setThrottle` and Deep-mode features are gated to Chromium and verified through the
  Debugger port; the PRD's cross-browser promise does not extend to them.
- New platform behaviour must be added to the port, both implementations (adapter and
  fake) and the shared contract, or the contract test fails.
- The ports are the only place browser APIs are named, so `core`/`capture` stay pure.
