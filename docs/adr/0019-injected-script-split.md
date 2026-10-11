# 19. Split the injected scripts: critical document_start, deferred performance and lazy UI

- Status: Accepted
- Date: 2026-10-11

## Context

PRD §4 set two bundle budgets: the injected main-world agent **< 15 kB gz** and the
lazy-loaded UI **< 120 kB gz**. Measurement (`docs/PERFORMANCE.md`) shows those two
numbers hide three different concerns:

- The **content script** carries almost all of the load overhead: the ablation gave
  `none` 110.2 ms, `agent-only` 117.6 ms (+7.4), `content-only` 187.5 ms (+77.3),
  `all` 200.5 ms (+90.3) of main-thread `TaskDuration` (n=20, win32). The agent is
  cheap; the content script is not.
- The content script mounts the **Preact shell eagerly at `document_start`**
  (`src/entrypoints/content/index.ts` renders `Widget` unconditionally), so the UI
  is loaded and executed before it is needed — only the panel module is lazy. This
  contradicts the PRD's lazy-load intent.
- Wiring the `PerformanceCollector` (web-vitals, long tasks, observers) into the
  agent would add roughly **~6 kB gz**, pushing it over 15 kB — yet it does **not**
  need to run at `document_start`.

## Decision

Split the injected code into independently budgeted pieces, and change PRD §4
accordingly:

| piece                                                           | when              | budget                |
| --------------------------------------------------------------- | ----------------- | --------------------- |
| critical agent (console/network patch, bridge, batching)        | `document_start`  | **≤ 15 kB gz**        |
| deferred performance script (web-vitals, long tasks, observers) | `document_idle`   | **≤ 25 kB gz**        |
| content bootstrap (bridge, handshake, routing, tiny launcher)   | `document_start`  | **≤ 10 kB gz**        |
| lazy UI chunks (Preact shell + panel)                           | first interaction | **≤ 120 kB gz total** |

### (a) Deferred performance script

web-vitals and the long-task/resource observers are registered at `document_idle`
with `{ buffered: true }`, which replays entries recorded before the observer
attached. **Metrics that deferral may miss or degrade — documented explicitly:**

- **Early long tasks.** `longtask` entries are buffered but the performance entry
  buffer is finite and can be evicted; a long task that ran before `document_idle`
  and was evicted from the buffer is lost. Short, task-heavy pages are the worst
  case. Mitigation if it proves material: register the long-task observer in the
  critical script (it is small) and keep only the heavier web-vitals work deferred.
- **Attribution data.** LCP element, INP interaction target and CLS sources are
  read at report time; a deferred subscription can lose **early layout shifts** and
  **early interactions** that are no longer attributable, even though the metric
  value may still be recoverable from buffered entries. Report attribution as
  best-effort when deferred.
- **Session truncation.** A page that performs an early navigation or is closed
  before `document_idle` may never attach the deferred script, losing the whole
  performance session for that page.
- **Unaffected:** console and network capture, the handshake, and batching stay in
  the critical script, so logging and request data are never deferred.

### (b) Content script: defer the UI mount

At `document_start` the content script does **only** the bridge, handshake and
routing. A tiny **vanilla-DOM launcher** (no Preact) is mounted into the Shadow DOM
at `DOMContentLoaded`/idle; the Preact shell and panel are dynamically imported on
first interaction (launcher click, shortcut or command). The `document_start` entry
must have **no static import** of Preact or any `ui` module, enforced by a
dependency rule/test, and a size-limit entry gates the content bootstrap at 10 kB.

## Consequences

- `.size-limit.mjs` gains entries for the content bootstrap (10 kB) and the
  deferred performance script (25 kB); the agent stays ≤ 15 kB and the UI chunks
  ≤ 120 kB total.
- A dependency-cruiser/ESLint rule forbids static Preact/`ui` imports from the
  `document_start` content entrypoint, and an E2E assertion checks that no UI chunk
  is requested before first interaction.
- The deferred script is a separate WXT entrypoint injected at `document_idle`
  (not a dynamic import from the background, which WXT inlines — ADR 0016).
- PRD §4 is updated to the four budgets above.

## Residual risks

1. Deferred long-task/attribution loss as above; re-measure under real pages before
   relying on deferred long-task data.
2. Two scripts must coordinate over the same bridge and pipeline.
3. `document_idle` timing varies by page; the launcher must still appear promptly
   for the user.
