# 15. Command handlers, clear executors and export delivery

- Status: Accepted
- Date: 2026-10-11

## Context

Slices A and B made capture and the panel work, but the command router handled
only `command.ping` (gap G4): the panel could dispatch actions and get
`unsupported`, and the clear/snapshot/export modules were built and unit-tested
but unreachable (G5). Slice C wires the handlers end to end.

Three sub-problems needed decisions:

1. **Clear steps run in two runtimes.** `planClear` splits a request into `page`
   and `background` steps. `ClearOrchestrator` takes one executor per runtime, and
   the concrete executors did not exist.
2. **Export has no delivery channel.** The extension has no `downloads`
   permission and the `result.exportReport` payload carried only a filename, so
   the report content could not reach the panel.
3. **The page executor cannot use module helpers.** `scripting.executeScript`
   serializes only the function, so any helper it references is lost.

## Decision

- **Handlers.** `createCommandRouter` now takes injected capabilities
  (`registry`, `network`, `snapshot`, `clear`, `exportReport`, `resolveThrottle`,
  `tabUrl`) and implements all six commands. A tab-scoped command without a tab
  context returns `invalid-argument`. `network` is a real `TabNetworkController`
  (Slice A/C entrypoint wiring), so `hardReload` and `toggleDisableCache` go
  through the platform ports.
- **Clear executors.** `capture/storage/step-executors.ts` provides
  `createPageClearExecutor(scripting, tabId)` — it injects one self-contained
  `async` function via `scripting.executeScript({ world: 'MAIN' })` which clears
  localStorage/sessionStorage/cookies/cacheStorage/IndexedDB/service workers and
  returns the bytes freed — and `createBackgroundClearExecutor(browsingData)`,
  which maps a step to a `browsingData` removal scoped to the origin. The
  orchestrator plans the ordered steps and aggregates the report. The page
  function is deliberately standalone because only the function is serialized.
- **Export delivery.** `result.exportReport` now carries `content`, so the worker
  builds the redacted report (`buildSessionExport` → `redactExportInput` →
  `buildReport`) and returns it; the panel owns the download. This avoids adding a
  `downloads` permission or a new port.
- **Protocol.** The wire schemas use `z.array(...).readonly()` so their inferred
  types match the core readonly types (the previous mismatch made writing a
  `result.getSnapshot` from a core `PageSnapshot` impossible without a cast).

## Consequences

- `tests/e2e/specs/commands.spec.ts` proves hard reload end to end (the panel
  dispatches, the worker reloads the tab). The router handlers are covered by
  `command-router.test.ts` with fakes, and the executors and report builder have
  their own tests.
- Remaining, recorded as gaps: **G9** (Chrome rejects the bare `modifyHeaders`
  disable-cache rule, and `NetworkRuleAction` cannot express the needed header
  operation) and **G10** (`setThrottle` resolves the profile and echoes it but does
  not apply a soft delay to the agent — the SW→content→agent relay is still open).

## Residual risks

1. The page clear function approximates bytes freed (localStorage/sessionStorage
   only); other steps report 0.
2. `presetToClearRequest` maps presets to type lists; a future preset must be added
   there and chosen deliberately (it is unit-tested).
3. Export content crosses the port as a string; very large sessions could make the
   message big, bounded by the session ring-buffer cap.
