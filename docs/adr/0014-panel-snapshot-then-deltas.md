# 14. Panel snapshot-then-deltas over a long-lived port

- Status: Accepted
- Date: 2026-10-11

## Context

Slice A streamed capture events into the worker's per-tab session, but nothing
rendered them: the `Shell`, `Panel`, screens and stores existed and were unit
tested, yet no entrypoint mounted them and no live data reached a screen (gap G2,
G3). PRD 8.4 says the widget UI reads the session store "via a long-lived port"
with snapshot-then-deltas, and PRD 8.5 requires every cross-context message to be
stated, versioned and validated.

Two mechanisms already existed and overlapped: `PanelBroadcaster` (worker side,
snapshot then deltas) and `sync.ts` (panel side, subscribe to deltas then request
`command.getSnapshot`). `sync.ts` needs the `command.getSnapshot` handler, which
is Slice C work, so Slice B must not depend on it.

## Decision

- The panel connects with `browser.runtime.connect({ name: PANEL_PORT_NAME })`.
  `PANEL_PORT_NAME` lives next to `PanelBroadcaster` so both entrypoints share it.
- The push is a first-class protocol message: `panel.snapshot` (a `PageSnapshot`)
  and `panel.delta` (a `CaptureEvent`), defined in `protocol` and validated on
  receipt with `parsePanelMessage`. This keeps the UI layer able to consume it
  (`ui` may import `core`/`protocol` only) and satisfies the validation rule.
- `PanelBroadcaster` writes the messages from **core** values (`PageSnapshot`,
  `CaptureEvent`) rather than the schema's inferred (mutable) payloads; the wire
  form is validated on the reading side. Its `open()` is async because the worker
  builds the snapshot by folding the stored session.
- The worker keeps a `Map<tabId, Set<PanelBroadcaster>>`: on connect it sends the
  snapshot, on each applied `event.batch` it pushes the batch's events to that
  tab's broadcasters, and on disconnect it clears them. The panel also sends
  commands over the same port (routed, answered with the single response envelope
  from ADR 0013).
- Core gains `foldCaptureEvents`: pure, folds a flat event list into a
  `PageSnapshot` (console/network concatenated, vitals deduped by name, long tasks
  concatenated, storage last-wins), used by the worker for the snapshot.
- The content script mounts `Widget` (the `Shell` bound to the store's live score
  and error count) into the existing shadow root and lazy-loads the panel content
  (`PanelContent`) on first open. Shell persistence (launcher placement, site
  disabled) goes through the storage port with versioned schemas.

## Consequences

- `tests/e2e/specs/fr-01.spec.ts` (launcher + lazy panel) and `fr-02.spec.ts`
  (Overview shows a captured failing request as a finding) pass.
- The storage and snapshots tabs are deferred to Slice C with their command
  handlers, so `PanelContent` renders Overview, Console, Network and Performance.
- `sync.ts` (the request/response snapshot path) remains for the detail/snapshot
  flows that need `command.getSnapshot` (Slice C); the panel push does not use it.

## Residual risks

1. The snapshot is built from the whole stored session on every panel connection,
   so a very long session does some work per open; the store's ring-buffer cap
   bounds it.
2. Deltas that arrive between `open()` starting and the snapshot being sent are
   buffered and replayed after it; a panel that opens and closes rapidly may drop
   buffered deltas on `close()` (by design).
