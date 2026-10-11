# Performance budgets and measurements

Budgets and checks for the injected agent, the benchmark, and memory under load.
Measurements are taken on the machine recorded below; the numbers are honest,
including where they miss the PRD target.

## Machine

- **OS:** Windows (`win32`), Node **v24.16.0**
- **CPU:** Intel Core i7-8565U @ 1.80 GHz (8 logical cores)
- **RAM:** 16.9 GB
- **Browser:** Playwright-bundled Chromium (`channel: 'chromium'`, new headless)

The machine is a laptop, not a CI runner, so absolute timings are indicative; the
method and the relative comparison are what matter.

## Bundles (enforced, gated in CI)

`pnpm size` (`.size-limit.mjs`) hard-gates three bundles, gzipped:

| bundle                                                 | budget                    | measured     |
| ------------------------------------------------------ | ------------------------- | ------------ |
| `agent.js` (main world)                                | 15 kB                     | **14.34 kB** |
| `background.js` (MV3)                                  | 50 kB                     | 44.5 kB      |
| `content-scripts/content.js` (bootstrap + deferred UI) | 62 kB (temporary ratchet) | 60.03 kB     |

The `content` cap is a **temporary no-regression ratchet** set to the measured size
plus a small margin (was a 120 kB placeholder). WXT inlines content-script dynamic
imports (IIFE lib mode), so the UI is deferred in **execution** but is **not yet
split into a separate chunk**: the whole UI is still in this one file. The PRD §4
"content bootstrap ≤ 10 kB **and** lazy UI chunks ≤ 120 kB" budgets are **open**
pending the follow-up gaps G14 (real ESM lazy chunk) and G15 (Zod-free
`document_start` path) in `docs/INTEGRATION-GAPS.md`; ADR 0019 records the amended,
measured reality.

### Agent size trend (per merge)

Headroom is **0.66 kB** to the 15 kB budget, so every merge that touches the
agent must re-measure. Record the `agent (main world)` line of `pnpm size` here on
each merge:

| merge                                         | agent (kB gz) | note                   |
| --------------------------------------------- | ------------- | ---------------------- |
| Slice A (typed capture, Zod in bridge)        | 39.43         | over budget (G11)      |
| + hand-written bridge guards, Zod-free core   | 12.88         | under budget           |
| + default redaction at capture (PRD 7)        | 13.60         | privacy fix            |
| + `agent.config` (G13)                        | 14.23         | guarded config message |
| + table-driven guards (G13 review)            | 14.34         | current `main` + G13   |
| + lazy-mount content deferral (lazy-mount PR) | **14.34**     | agent unchanged        |

## Benchmark: added main-thread time during load

- **Spec:** `tests/e2e/specs/benchmark.spec.ts`.
- **Method:** the **same extension-enabled context** is used for both series. Each
  iteration opens a page, enables CDP `Performance`, reads the cumulative
  `TaskDuration` metric, navigates to the fixture (`/`), waits for `load`, and reads
  `TaskDuration` again; the per-load cost is the delta (CDP durations are seconds).
  Series **inactive** runs with the site scripts **not registered** (access not
  granted); series **active** runs after `registerExtensionScripts` (access granted).
  **N = 30** iterations each, one warm-up each; medians and interquartile ranges are
  reported. The measured quantity is main-thread task time, not navigation duration.
- **Command:** `pnpm exec playwright test --config tests/e2e/playwright.config.ts benchmark`.

**Result (platform `win32`, laptop i7-8565U, n=30, metric `TaskDuration`).** The
lazy-mount PR was measured before/after on this machine in one session, same spec.

| series                           | before (eager UI) | after run A  | after run B | after run C |
| -------------------------------- | ----------------- | ------------ | ----------- | ----------- |
| inactive (no site scripts)       | 102.1 ms          | 102.7 ms     | 114.8 ms    | 116.1 ms    |
| active (site scripts registered) | 195.4 ms          | 207.1 ms     | 201.2 ms    | 211.2 ms    |
| **overhead (median)**            | **93.3 ms**       | **104.5 ms** | **86.4 ms** | **95.1 ms** |

**Honest verdict:** deferring the UI mount did **not** change the added main-thread
task time: it is ~85–105 ms before and after, still **misses the PRD target of
50 ms**, and the run-to-run spread (~±10 ms here, IQRs 4–12 ms) is larger than any
effect. The previously recorded pre-PR figure in this doc (inactive 113.4 ms,
active 208.0 ms, overhead 94.6 ms) sits inside the same band.

### Gating policy

- **Hard-gated in CI (deterministic):** `pnpm size` (above) and the memory check
  (below).
- **Benchmark: relative threshold, report-only spirit.** The spec asserts
  `activeMedian <= inactiveMedian * 3 + 50 ms` — a generous guard that fails only on
  a catastrophic regression. Runtime timings on shared runners are noisy, so a tight
  absolute gate would be flaky; the numbers are logged (`[bench] …`) and should be
  trended, not hard-gated.

## Ablation: which component carries the overhead

Second test in the same spec: series **none**, **agent-only**, **content-only**
(the shipped content bundle) and **all**, N=20 each, same CDP `TaskDuration` method.
After the lazy-mount PR, "content-only" loads the whole content bundle but does **not**
run the UI: the Preact render is deferred to the first interaction. The bundle is not
split (WXT inlines content-script dynamic imports), so the deferred code is still
parsed/compiled; only its execution is skipped.

**Result (platform `win32`, n=20, metric `TaskDuration`, delta against the same run's
`none`):**

| series       | before: median | before Δ | after run A | after Δ A | after run B | after Δ B | after run C | after Δ C |
| ------------ | -------------- | -------- | ----------- | --------- | ----------- | --------- | ----------- | --------- |
| none         | 110.2 ms       | —        | 113.7 ms    | —         | 111.4 ms    | —         | 115.7 ms    | —         |
| agent-only   | 117.6 ms       | +7.4 ms  | 117.0 ms    | +3.3 ms   | 115.6 ms    | +4.2 ms   | 120.3 ms    | +4.6 ms   |
| content-only | 187.5 ms       | +77.3 ms | 195.6 ms    | +81.9 ms  | 191.7 ms    | +80.3 ms  | 204.0 ms    | +88.3 ms  |
| all          | 200.5 ms       | +90.3 ms | 206.3 ms    | +92.6 ms  | 218.7 ms    | +107.3 ms | 213.3 ms    | +97.6 ms  |

**How much of the ~77 ms was recovered by deferring execution alone: essentially
none.** "content-only" overhead is +77 ms before and +80–88 ms after (three runs) —
unchanged to slightly **worse**, within the run-to-run spread, because the bundle grew
~2 kB gz and the deferred code is still parsed. The main-world agent stays cheap
(~4–7 ms).

**What remains, and where it comes from.** The content-script cost is **not** the UI
render. It is loading, parsing and executing the one content bundle plus the mandatory
`document_start` work: the bridge handshake, the `command.ping` round trip, the panel
port connect, and the **Zod** validation of every cross-context message. Deferring the
Preact render removed almost nothing, and the bundle even grew slightly
(57.8 → 60.03 kB gz) from the bootstrap/launcher/feed additions, so the deferred UI
code is still parsed although it is never run. Two changes can move this number, both
logged in `docs/INTEGRATION-GAPS.md` and both **out of scope here**: **G14** – a real
ESM lazy chunk (WXT manual split); **G15** – removing Zod from the `document_start`
path so the content script relays batches with cheap size/shape checks and the service
worker stays the validating boundary.

**Correction to the earlier finding.** The previous version of this section said the
entrypoint "mounts the UI eagerly" and implied the UI mount caused the ~77 ms. The
measurement shows the mount was not the cost: "content-only" conflated the bridge
(and Zod routing) with the UI. Deferring the UI confirms the bridge/routing dominates.

## Memory under an event flood

- **Spec:** `tests/e2e/specs/memory-flood.spec.ts`.
- **Method:** the page emits **3,000** console events in one tick; then assert the
  per-tab session store is non-empty and **bounded (≤ 500 events**, the
  `TabSessionStore` ring-buffer cap), that fewer than the flood were kept, and that
  the worker still answers `runtime.getManifest()`.
- **Result:** passes — stored events stay at the 500 cap while 3,000 are produced,
  so the pipeline's oldest-drop backpressure and the store's cap hold and the
  worker survives. Deterministic, so it is **gated hard**.

## Profiling

Inspected hot-path candidates and the outcome:

- **Serialization** (`serializeValue` per console arg + `redactSerialized`) — the
  console path runs once per captured `console.*` call; under the 3,000-event flood
  the store stayed bounded and the page was not blocked, so no change was made.
- **URL/string redaction** (`redactUrl` parsing the URL, `redactString` regexes) —
  runs once per network event under the new default redaction. The obvious
  micro-optimization is a fast path in `redactUrl` (`if (!url.includes('?') &&
!url.includes('@')) return url;`) to skip `new URL(...)` for the common
  query-less asset URL. **Not applied yet:** the effect is below this machine's
  benchmark noise, so it could not be shown as a win here — it is the first
  candidate to measure with a focused micro-benchmark on a quiet runner.
- **Observer callbacks** (`PerformanceObserver` for resource/long tasks) — push
  into a small buffer, reconciled per request; not a per-event cost.

**No before/after is claimed**: the profiling pass identified candidates but did
not demonstrate a change large enough to report against the ~95 ms aggregate, so
none was merged. The baseline is now the CDP `TaskDuration` measurement above; the
plan below measures each change against it.

## Plan to close the ~45 ms gap (95 ms → ≤ 50 ms)

The baseline is now measured with the CDP method above; optimisation starts from
this number. Ordered, cheapest first, each measured before/after (medians and IQRs,
n=30) with the same spec:

1. **`redactUrl` fast path** (skip `new URL` when there is no query/userinfo) and a
   `redactString` fast path (skip the two regexes when the string has no `e`/`B`).
2. **Defer the performance work** (see `docs/DESIGN-agent-perf-split.md`): move
   web-vitals/long-task observers to a `document_idle` script so the
   `document_start` critical path only patches console/network and the bridge.
3. **Defer the UI mount — attempted in the lazy-mount PR, no measurable win.** The
   Preact render, design tokens and signals-backed store are now deferred to the first
   interaction (ADR 0019), but the `content-only` overhead was unchanged (~+77 ms
   before, ~+81 ms after, within noise): the cost is the bundle load plus the
   bridge/routing and Zod validation, not the render. The real levers are therefore
   **G14** (a real ESM lazy chunk, so the deferred UI code is not even parsed at
   `document_start`) and **G15** (a Zod-free `document_start` path), both logged in
   `docs/INTEGRATION-GAPS.md`.
4. **Re-measure on CI hardware** and, if the overhead is still over 50 ms, record
   the residual with the contributing breakdown rather than adjusting the target.
