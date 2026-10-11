# 13. Typed capture batch, bridge commit and the command response envelope

- Status: Accepted
- Date: 2026-10-11

## Context

PRD 8.4 describes the capture data flow, but three defects blocked it from
working end to end (recorded as G1, G7 and G8 in `docs/INTEGRATION-GAPS.md`):

1. **No wiring (G1).** The collectors, `EventPipeline` and `TabSessionStore` were
   built and unit-tested but no entrypoint connected them.
2. **The bridge never connected (G7).** In a real Chromium MV3 context the agent
   adopted the handshake and posted the ack, but the content script never received
   it, so the paired halves desynchronized and every page showed `agent unavailable`.
3. **The command reply was the wrong envelope (G8).** The worker answered with a
   `Result<ResultMessage, PlatformError>` (`{ok, value}` / `{ok, error}`) while the
   content script parsed a bare `ResultMessage`, so a completed round trip still
   reported `ping failed`.

The wire shape was also a problem: the pipeline batched a generic
`PipelineEvent { kind, at }`, which carries no payload, so the Overview and detail
screens could not render console, network or vitals data from the store.

### Root cause of G7 (measured, not guessed)

Instrumenting the built bundles in Chromium showed the agent **adopts the
handshake and posts the ack** (`adopt: 1`, `ackSent: 1`, no errors), yet the
content script's `waitForAck` never fires. Measuring the round trip gave
**~98 ms** for the first attempt, while `connectAgentBridge` abandons each
attempt after **50 ms** (`retryMs`). At `document_start` the main thread is busy
(the agent and content bundles parse, and page scripts run), so the first ack
misses the window.

That alone would be recoverable: the content script retries with a fresh channel.
But the agent latched permanently onto the **first** handshake it saw
(`if (connected) return`), so it ignored every later attempt — and the content
script ignored the late ack on the abandoned channel. The two policies deadlock.
(The same measurement with a test-only main-world script that acks like the agent
succeeded, which ruled out the nonce, the transferable port and the realm.)

## Decision

### Typed batch on the wire (G1)

- `core` owns a discriminated `CaptureEvent` union (`channel: 'console' | 'network' |
'performance' | 'storage'`, each wrapping the existing core domain payload) and a
  transport-neutral `CaptureBatch` (`{ sequence, dropped, events }`). There is no
  second copy of the payload shapes.
- `protocol` mirrors it with `captureEventSchema` / `captureBatchSchema` and one
  versioned `event.batch` message. The schemas use `z.exactOptional()` so their
  inferred type matches the core types under `exactOptionalPropertyTypes`
  (verified by `protocol.test-d.ts`), and the event array is capped at
  `MAX_BATCH_EVENTS` at the trust boundary.
- The main-world agent owns one `EventPipeline` per document and batches every
  100 ms with oldest-drop backpressure. The content script forwards each batch. The
  **service worker stamps the tab id** (the agent cannot know it), applies the
  ring-buffer cap and records the pipeline's cumulative dropped count in
  `TabSessionStore`. Stale or duplicate sequence numbers are ignored.

### Tentative adoption plus commit (G7)

The agent no longer commits on the first handshake. It registers its capturing
listener first, calls `stopImmediatePropagation` for each accepted handshake,
answers the ack, and re-adopts a later handshake until the content script sends a
`commit` on the port. Because the content script only waits on the attempt it
posted, staying tentative lets the agent adopt the attempt the content script is
actually waiting on, so a late first ack can no longer deadlock the pairing. The
nonce, the capturing-listener ordering, the suppression and the one-time
`MessageChannel` port transfer are unchanged; a page listener registered after the
agent still observes nothing (kept as the permanent `bridge-security` E2E test).

### One command response envelope (G8)

`protocol` defines `commandResponseSchema = result | error` and
`parseCommandResponse`. The service worker sends exactly that via `toCommandResponse`
(mapping a platform failure onto a schema-valid protocol error, preserving shared
codes and wrapping the rest as `internal` with the original code in `details`), and
the content script parses it with `parseCommandResponse`. No parser was loosened;
the two ends now share one envelope. A contract test exercises every command's
request and reply through the real schemas.

### Patchable target

`CaptureAgent` patches the `target` it is given, so the entrypoint passes a
`window` write-through adapter (its `fetch` setter writes back to `window.fetch`)
rather than a throwaway object; otherwise capture would not intercept page
requests.

## Consequences

- The capture path works end to end in a real browser: `smoke` asserts `pong`,
  `capture` asserts a network event reaches `storage.session`, and `bridge-security`
  asserts a hostile page listener sees nothing.
- The UI `OverviewStore.applyEvent` takes a `CaptureEvent` and `attachDeltas` fans
  an `event.batch` out to it; the panel still needs mounting (Slice B).
- Remaining gaps: G2 (shell not mounted), G3 (screens/stores not connected),
  G4 (router handles `ping` only), G5 (clear/snapshot/export handlers), G6
  (site-access registration).

## Residual risks

1. The commit adds one message to the handshake; a page that wins the handshake
   race can still present a `commit` (same residual risk as ADR 0011, item 3).
2. Retries still transfer a fresh port per attempt; the agent commits to exactly
   one, but a browser that stalls the main thread for longer than the whole retry
   budget would still fail to pair.
3. Vitals are streamed only when a `web-vitals` client is injected; today the
   collector degrades to unsupported and long tasks only.
