# Integration gaps

The layers are implemented and unit-tested, but the extension is **not wired
end to end**: the entrypoints that would connect them are still stubs. This file
records exactly what is missing, with evidence, so the E2E specs can name the
blocker instead of failing. Each gap has a stable id (`G1`…`G6`) used by the
`test.fixme` comments in `tests/e2e/specs/` and by
[`E2E-TRACEABILITY.md`](./E2E-TRACEABILITY.md).

Everything below is a wiring task; no new domain logic is implied.

## G1 — Collectors are not wired to the bridge or pipeline

The console, network and performance collectors and the event pipeline exist and
have tests, but no entrypoint imports them. `src/entrypoints/content/index.ts`
connects the main-world bridge and pings the worker; it never forwards captured
events, and `src/entrypoints/background/index.ts` builds only the session
registry and store.

Evidence:

- `src/entrypoints/content/index.ts:22` — connects the bridge, then stops.
- No non-test file outside `src/capture/**` imports
  `event-pipeline`, `console-collector`, `network-collector` or
  `performance-collector` (verified with a repo-wide import search).
- `src/capture/pipeline/event-pipeline.ts` is exported by
  `src/capture/pipeline/index.ts` but consumed nowhere in `src/entrypoints`.

Blocks: FR-3, FR-4, FR-5, FR-8.

## G2 — The widget shell is not mounted in the content script

`hostWidgetRoot()` mounts a shadow root containing a single status `<output>`.
The real Shell (launcher, health badge, draggable panel) is implemented in
`src/ui/shell/Shell.tsx` but is never imported by an entrypoint.

Evidence:

- `src/entrypoints/content/index.ts:18` — `const root = hostWidgetRoot();`
- `src/ui/widget-root.ts:13` — creates only `[data-devtoolwidget="status"]`.
- No import of `ui/shell` exists anywhere in `src` outside `src/ui/**`.

Blocks: FR-1, FR-2 (visually).

## G3 — Screens and state stores are not connected to the panel

The Overview/Console/Network/Performance/Storage/Snapshots screens and the
signal-based stores in `src/ui/state/**` are implemented and tested, but nothing
feeds them live data, and the options page / per-origin profiles are not applied
to a running session.

Evidence:

- No import of `ui/state` or `ui/screens` exists in `src/entrypoints/**`.
- `SettingsService` (`src/capture/settings/settings-service.ts`) is constructed
  in `src/entrypoints/background/index.ts:34` but its per-origin profiles are
  never read by the capture path.

Blocks: FR-2, FR-11, FR-14.

## G4 — The background router handles only `command.ping`

`createCommandRouter` has a single `case 'command.ping'` and returns
`unsupported` for everything else, so the action commands (`hardReload`,
`setThrottle`, `toggleDisableCache`, `clearSiteData`) are unreachable from the
page even though their controllers exist.

Evidence:

- `src/capture/session/command-router.ts:32` — the `switch` has one real case.
- `src/capture/session/command-router.ts:47` — `default` returns `unsupported`.

Blocks: FR-6, FR-7, FR-12.

## G5 — Clear, snapshot and export handlers are not routed

`ClearOrchestrator`, `SnapshotStore` and the export/redaction path are
implemented and unit-tested, but no message handler reaches them, so the panel
cannot clear, snapshot or export anything.

Evidence:

- No import of `clear-orchestrator` or `snapshot-store` outside their own
  barrels/tests.
- `src/entrypoints/background/index.ts:44` registers a single `onMessage`
  listener that only routes through the (ping-only) command router.

Blocks: FR-6, FR-9, FR-10.

## G6 — Runtime scripts are never registered, so the widget never injects

Both `content` and `agent` use `registration: 'runtime'`, so WXT does not add
them to the manifest. The built `manifest.json` has **no** `content_scripts`
entry, and nothing calls `chrome.scripting.registerContentScripts` at runtime —
`SiteAccessService.sync()` (`src/entrypoints/background/index.ts:60`) only
registers for already-granted origins, of which there are none by default.

Evidence:

- Built `.output/chrome-mv3/manifest.json` contains no `content_scripts` key.
- `src/entrypoints/content/index.ts:14` and `src/entrypoints/agent/index.ts:9` —
  `registration: 'runtime'`.
- `src/entrypoints/background/index.ts:35` constructs `SiteAccessService` but no
  code path grants or registers an origin.

Consequence for tests: the E2E harness registers both bundles itself from the
service worker before navigating (`registerExtensionScripts` in
`tests/e2e/fixtures/extension.ts`). This is a test-only stand-in for the missing
production wiring.

Blocks: FR-1, FR-2, FR-13 (and, transitively, every FR that needs the in-page
widget).

## G7 — The main-world bridge ack never reaches the content script

Surfaced by the E2E harness (`tests/e2e/specs/smoke.spec.ts`). In a real Chrome
MV3 context the agent installs, **adopts the handshake and posts the ack**
(instrumenting the built `agent.js` showed `adopt: 1`, `ackSent: 1`, no errors),
yet `connectAgentBridge` exhausts its attempts and the in-page status stays
`agent unavailable`.

A test-only main-world script that performs the identical ack **does** complete
the handshake (the content script then advances past `agent unavailable`), which
rules out the message shape, the transferable port and the realm: the message
crosses from the isolated world to the main world and the port is received. The
divergence is therefore inside the built agent/bridge, not the protocol.

Evidence:

- `src/entrypoints/agent/index.ts` — installs the bridge in the main world.
- `src/capture/bridge/agent-bridge.ts:56` — adopts and posts the ack.
- `src/capture/bridge/content-bridge.ts:127` — `connectAgentBridge` returns
  `err('timeout', 'Agent bridge did not acknowledge the handshake')`.

Blocks: FR-1, FR-2, FR-3, FR-4, FR-5, FR-8, FR-13 (any in-page feature) and the
`pong` assertion in the smoke test.

## G8 — The worker's ping reply is rejected by the content script

Even with a working bridge, the round trip fails with the status `ping failed`.
The command router returns `Result<ResultMessage, PlatformError>`
(`src/capture/session/command-router.ts:12`) and the worker forwards that whole
`Result` value via `sendResponse(outcome)`
(`src/entrypoints/background/index.ts:52`), so the content script receives
`{ ok: true, value: { type: 'result.ping', … } }`. But the content script parses
the response with `parseResult` (`src/entrypoints/content/index.ts:43`), which
validates a bare **`ResultMessage`** envelope (`{ type, version, correlationId,
payload }`, `src/protocol/parse.ts`). The two shapes do not match, so parsing
fails and the status becomes `ping failed`.

Either the worker should send `outcome.value` (or `outcome.error`) on success and
failure, or the content script should unwrap the `Result` before parsing — the
two sides must agree on one envelope.

Evidence:

- `src/capture/session/command-router.ts:40` — returns `ok({ type: 'result.ping', … })`.
- `src/entrypoints/background/index.ts:53` — `sendResponse(outcome)`.
- `src/entrypoints/content/index.ts:43` — `parseResult(response)`.
- `src/protocol/parse.ts` — `parseResult` validates `resultMessageSchema`.

Blocks: the `pong` assertion in the smoke test; FR-1 and every FR that reads a
command reply.
