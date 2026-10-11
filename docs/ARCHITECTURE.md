# Architecture review — backend checkpoint (`v0.1.0-backend`)

Scope: does the implementation match PRD section 8 (architecture) now that the
data and action backend is complete and before the UI is built? Reviewed at tag
`v0.1.0-backend` on `main`.

## 8.1 Runtime contexts

| Context                                                                                                                | Status                       | Notes                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service worker (background) — orchestration, per-tab session registry, browsingData, DNR, debugger, commands, settings | Implemented (wiring partial) | `src/entrypoints/background` wires `createChromePorts`, `TabSessionRegistry`, `SettingsService`, `SiteAccessService`, `createCommandRouter`, pipeline session cleanup. Router handles `command.ping` only; `hardReload`/`setThrottle`/`toggleDisableCache` handlers remain to be wired to `TabNetworkController`. |
| Content script (isolated, `document_start`) — secure bridge, widget root, injects agent                                | Implemented                  | `src/entrypoints/content`, `capture/bridge`, `ui/widget-root`.                                                                                                                                                                                                                                                    |
| Main-world agent (`world: MAIN`, before page scripts)                                                                  | Implemented                  | `src/entrypoints/agent` + `capture/bridge/agent-bridge` (capture-phase handshake, `stopImmediatePropagation`, `MessageChannel`).                                                                                                                                                                                  |
| Widget UI (Preact in Shadow DOM)                                                                                       | Not built                    | Out of scope for this checkpoint; `hostWidgetRoot` provides the isolated root only.                                                                                                                                                                                                                               |
| Options / side panel                                                                                                   | Not built                    | Side panel port exists; screens are UI work.                                                                                                                                                                                                                                                                      |

## 8.2 Layered design and the dependency rule

- `core`, `protocol`, `platform`, `capture`, `ui`, `entrypoints` exist.
- Rule enforced by `.dependency-cruiser.cjs` and proven by
  `tests/architecture/dependency-rule.test.ts` (core→other forbidden;
  protocol→platform/capture/ui/entrypoints forbidden; capture→platform adapters/fakes
  forbidden; core→protocol forbidden). `pnpm deps:check` is clean (118 modules).
- Deviations, each with an ADR: **protocol may import core** (ADR 0009);
  **capture may import platform ports interfaces only** (ADR 0003); **WXT browser
  wrapper** (ADR 0010).
- Pure logic sits in `core` (domain, settings/migrations, clear planner, throttle
  profiles, disable-cache rule planning, performance maths); adapters and fakes in
  `platform`; collectors/executors/pipeline in `capture`.

## 8.3 Folder structure

Matches PRD 8.3: `src/core/{domain,settings,clear,network,performance,buffers,redaction,serialization,format,ids}`,
`src/protocol`, `src/platform/{ports,chrome,fakes}`, `src/capture/{console,network,performance,storage,pipeline,bridge,settings,site-access,session,onboarding,agent?}`,
`src/ui`, `src/entrypoints/{background,content,agent}`, `tests/{architecture,integration,platform}`,
`docs/adr/`. ADRs 0001–0012 record the notable decisions.

## 8.4 Data flow

Implemented as specified: page events → main-world agent (console/network/performance
collectors, wired by `capture/agent`) → batched over the secure `MessageChannel` port as
one typed `event.batch` message (`EventPipeline`, 100 ms; sequence + cumulative dropped +
typed entries) → content script forwards it → service worker stamps the tab id and stores
the typed entries (`TabSessionStore` in `storage.session`, ADR 0012) → panel via
snapshot-then-deltas (`PanelBroadcaster`). The wire shape and the bridge/response fixes
are recorded in ADR 0013. Actions flow in reverse through typed protocol commands and a
single result-or-error response envelope. **Gap:** the UI→SW→content→agent relay hop for
actions is wired for `ping` only; the remaining action commands need the router handlers
and the tab-port forwarding.

## 8.5 Messaging and state

- Every message carries type, version, correlation ID and a Zod schema
  (`src/protocol`), with `parse*` helpers returning `Result` and never throwing.
- Commands return typed `Result` values; expected failures never throw
  (`core/result.ts`, platform `Result`-based adapters).
- Settings persisted through the storage port with a schema version and explicit
  migrations (`core/settings/migrations.ts`, `SettingsService`).

## Deviations from the PRD (recorded)

- protocol→core (ADR 0009); capture→platform **ports** only (ADR 0003); WXT `browser`
  wrapper (ADR 0010); manifest V3 on Chromium and Firefox with a Firefox event-page
  background (ADR 0005); size budgets are placeholders (ADR 0006); per-tab session in
  `storage.session` (ADR 0012).

## Gaps to close before / during UI

1. Router + background wiring for `hardReload`, `setThrottle`, `toggleDisableCache`
   (controller exists; also feed soft-mode `softDelayMs` into the network collector's
   `artificialDelayMs`). Slice C wired the handlers; the soft delay application and
   the real disable-cache rule still need the port extensions in gaps G9/G10.
2. Concrete page/background `StepExecutor`s for `ClearOrchestrator` (scripting +
   browsingData ports) and a `StorageSummary` command handler. Slice C added the
   executors (`capture/storage/step-executors.ts`); a `StorageSummary` command
   remains open (Slice D/E).
3. Wire `TabNetworkController.cleanup`/`sync` to `tabs.onRemoved`/`onStartup`.
4. ~~Agent-side capture wiring (console/network/performance collectors emit over the
   bridge)~~ Done in Slice A (`capture/agent`, ADR 0013). The remaining action relay
   (UI→SW→content→agent) is still open (Slice C).
5. UI package (Preact stores/screens), options and side-panel screens. Slice B
   mounted the shell in the content script and wired the panel to the worker's
   snapshot-then-deltas port (ADR 0014); the storage/snapshots tabs, options and
   side-panel screens remain.

## Verdict

The backend matches PRD section 8's architecture and dependency rule; the remaining
items are integration wiring and the UI itself, none of which require reworking the
layering.
