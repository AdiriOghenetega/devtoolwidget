# 12. Per-tab session state: chrome.storage.session over IndexedDB

- Status: Accepted
- Date: 2026-10-09

## Context

The MV3 service worker is ephemeral (PRD section 7): it is torn down when idle and
restarted on demand, and the extension is reloaded on install/update. The per-tab
capture session (pipeline batches, last URL, sequence, dropped count) must survive
those restarts, be readable only by the extension, and be cheap to write at up to
one batch per 100 ms per tab. Two browser stores are available:
`chrome.storage.session` and IndexedDB.

## Decision

Store per-tab session state in **`chrome.storage.session`** through the existing
`StoragePort` (`TabSessionStore` in `src/capture/pipeline`).

Rationale:

- `storage.session` is in-memory and lives with the browser session: it is cleared
  on browser restart (which matches "session" semantics) but **survives service
  worker restarts and extension reloads**, exactly the lifecycle the session needs.
- It is not exposed to content scripts by default, keeping captured session data
  out of the page context.
- Writes are small (a bounded event list per tab), so its quota is ample; the store
  also caps retained events (`maxEvents`, default 500) to stay well within it.
- It reuses the schema-versioned `StoragePort` (Zod-validated, `Result`-based)
  rather than introducing a second persistence mechanism, so validation and error
  handling are already covered by tests and the shared contract.

IndexedDB is **deferred** to larger, longer-lived data (saved snapshots, HAR/report
bundles) where `storage.session`'s in-memory, session-scoped nature is wrong.

## Consequences

- On browser restart the session is empty; the widget starts a fresh session, which
  is the intended behaviour for ephemeral capture data.
- Cleanup on tab close calls `TabSessionStore.clear(tabId)` from the background
  (`tabs.onRemoved`), so state does not accumulate for closed tabs.
- If a future feature needs persistence across browser restarts, it must use
  IndexedDB (or `storage.local`) and get its own ADR; it must not overload
  `storage.session`.
