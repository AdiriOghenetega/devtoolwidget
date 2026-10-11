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

Second test in the same spec. Series **none**, **agent-only**, **content-only** and
**all** run in the extension context (N=20 each, same CDP `TaskDuration` method).
`content-only` loads the whole production content bundle but does **not** run the UI
(deferred to first interaction, ADR 0019); WXT inlines the dynamic import, so the
deferred code is still parsed. This PR adds two matched baselines: **bare** (a
persistent Chromium with no extension) and **noop-content** (a minimal no-op
`document_start` content script in its own extension,
`tests/benchmarks/noop-extension`). `noop-content − bare` is the **fixed cost of
injecting any content script**; `content-only − noop-content` is the share
attributable to **our** bundle.

**Result (platform `win32`, n=20, metric `TaskDuration`):**

| series       | run 1    | run 2    | run 3    |
| ------------ | -------- | -------- | -------- |
| none         | 127.5 ms | 129.3 ms | 124.8 ms |
| agent-only   | 120.2 ms | 128.4 ms | 125.0 ms |
| content-only | 200.8 ms | 222.0 ms | 219.7 ms |
| all          | 212.9 ms | 225.8 ms | 243.8 ms |
| bare         | 120.8 ms | 121.0 ms | 124.5 ms |
| noop-content | 122.2 ms | 123.8 ms | 124.5 ms |

| derived                           | run 1        | run 2        | run 3        |
| --------------------------------- | ------------ | ------------ | ------------ |
| **fixed injection** (`noop−bare`) | **+1.4 ms**  | **+2.8 ms**  | **+0.0 ms**  |
| **our bundle** (`content−noop`)   | **+78.6 ms** | **+98.2 ms** | **+95.2 ms** |
| agent (`agent-only−none`)         | −7.3 ms      | −1.0 ms      | +0.2 ms      |

**Finding: the fixed injection cost is ~0–3 ms; essentially all of the content-script
overhead is our bundle (~79–98 ms).** Injecting a content script at `document_start`
is nearly free, so the ~78 ms is the cost of loading/parsing/executing _our_ 60 kB gz
bundle and its `document_start` work, not the injection mechanism. The main-world
agent is within noise (~0–7 ms).

**Deferring the UI (lazy-mount PR) recovered essentially none of it.** Historical
before/after (n=20): `content-only` Δ vs `none` was **+77.3 ms before** and
**+80.3 / +81.9 / +88.3 ms after** three runs — unchanged to slightly worse, because
the deferred UI code is still parsed. The bundle even grew 57.8 → 60.03 kB gz from the
bootstrap/launcher/feed additions. So the cost is **the bundle itself plus the
mandatory `document_start` work** (bridge handshake, `command.ping`, port connect,
Zod validation), not the Preact render.

**Correction to a still-earlier finding.** An earlier version of this section claimed
the entrypoint "mounts the UI eagerly" and implied the UI mount caused the ~77 ms.
The measurements show the mount was not the cost.

## Diagnosis: fixed injection cost, bundle composition and CPU profile (2026-10-11)

Diagnosis only (docs, benchmark and tooling — no production change). Three
measurements narrow where the ~78 ms content-script overhead lives.

### (a) Fixed injection cost vs our bundle

From the ablation above: injecting _any_ `document_start` content script costs
**~0–3 ms** (`noop-content − bare`, three runs), so the injection mechanism is not the
problem. Our content bundle adds **~79–98 ms** (`content-only − noop-content`). The
work is in _our_ bundle: its size (parse/compile) and its `document_start` execution.

### (b) Bundle composition of `content-scripts/content.js`

`node tests/benchmarks/bundle-composition.mjs` (builds with `ANALYZE=1`; the
`moduleSizeReport` Vite plugin in `tools/vite-module-sizes.mjs` reports exact
post-tree-shake rendered sizes per module, whereas the treemap analyzer reports
pre-tree-shake sizes and overstates the bundle). Bundle: **193,826 B raw / 60,103 B
gzipped**; rendered module total (sums to the chunk): 367,656 B.

| family    | rendered B | share | est. gz B |
| --------- | ---------- | ----- | --------- |
| zod       | 177,666    | 48.3% | ~29,000   |
| ui        | 53,724     | 14.6% | ~8,800    |
| core      | 41,274     | 11.2% | ~6,700    |
| preact    | 32,244     | 8.8%  | ~5,300    |
| other     | 25,856     | 7.0%  | ~4,200    |
| protocol  | 14,837     | 4.0%  | ~2,400    |
| bootstrap | 12,123     | 3.3%  | ~2,000    |
| capture   | 6,010      | 1.6%  | ~1,000    |
| platform  | 3,922      | 1.1%  | ~600      |

"est. gz B" = family share × the measured bundle gzip size (ratio 0.310); per-family
gzip is not measured directly. **Zod is the single largest family at ~48% of the
rendered bundle**; `ui + preact` are ~23% together; `core` is ~11% because the content
entry imports the `core` barrel.

### (c) CPU profile of the content-only series

`node tests/benchmarks/profile-content.mjs` builds an unminified, source-mapped bundle
(`PROFILE=1` → `.output-profile/`) so V8 reports readable function names, then profiles
3 loads with the CDP `Profiler` domain, restricted to `content.js` frames.

- content.js **self time ≈ 26 ms/load**.
- **module evaluation (top-level inclusive) ≈ 21 ms/load — 82% of content.js self
  time.** Module evaluation is the dominant JS phase.
- **Zod/schema-shaped self time ≈ 5.1 ms/load — ~20% of content.js self time, ~24% of
  module evaluation.** The top frames are Zod internals (`init`, `members`,
  `defineBound`, `mergeDefs`, `$constructor.~standard`, `runChecks`, `inst._zod.parse`),
  i.e. **schema construction at import is a real but modest share of JS execution**.

**Interpretation.** In the unminified build the JS execution is ~26 ms, of which module
evaluation is ~21 ms and Zod construction ~5 ms; the remainder (`hostWidgetRoot`,
`createLauncher`, `resolveBindings`, module wrappers) is our bootstrap. The
`TaskDuration` delta (~78 ms, minified, n=20) is larger than the JS self time, so a
significant share is **script parse/compile plus native/IPC work** (port connect,
storage read, `sendMessage`) that the JS profiler does not report as self time. Zod's
48% of the _bundle_ buys both its ~5 ms of construction **and** a large share of the
parse/compile cost (unminified names are not representative of absolute time).

### (d) Ranked candidate fixes (evidence-based estimates; not implemented)

Estimates are `family share × the ~78 ms content-only delta`, which is crude (shares are
pre-minify rendered bytes; parse/compile scales with bytes, execution does not). Treat
them as a ranking, not promises. "Cheap" = no validation-model change.

| rank | candidate                                                                                                                                                    | est. gain                                           | cost                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | -------------------------------------------- |
| 1    | **Relay-only content script with no Zod (G15)** — forward `event.batch` to the worker with cheap size/shape checks; the worker stays the validating boundary | up to ~35 ms (zod ≈ 48% of bundle)                  | **not cheap — changes the validation model** |
| 2    | **Real ESM lazy chunk for the UI (G14)** — take `ui + preact` out of the `document_start` bundle (WXT manual split)                                          | ~15–18 ms (ui+preact ≈ 23%)                         | cheap (build tooling)                        |
| 3    | **Narrow the `core` import** — the content entry imports the `core` barrel; import `ids` / `commands` / `placement` directly instead                         | ~8 ms (core ≈ 11%)                                  | cheap                                        |
| 4    | **Narrow protocol/barrel imports + lazy schema construction** — build only the schemas the bootstrap uses, on first use rather than at import                | ~2–4 ms (protocol ≈ 4%; zod construction ≈ 5 ms JS) | cheap                                        |
| 5    | `other` (≈ 7%) — WXT/browser glue and the rolldown runtime; not directly addressable                                                                         | ~0                                                  | —                                            |

Candidates 2 and 3 are additive and validation-model-neutral: together ~23–26 ms for
build/import cleanup, moving the content-only delta from ~78 ms toward ~55 ms without
touching the trust boundary. Candidate 1 is the largest single lever but re-opens the
ADR 0018 trade-off for the content path.

**Not implemented here** (diagnosis only). G14/G15 remain the tracked gaps in
`docs/INTEGRATION-GAPS.md`.

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
this number. The **Diagnosis** section above re-prioritises the content-script work:
the fixed injection cost is **~2 ms**, so the levers are our bundle's size and its
`document_start` work, ranked in (d) — **G14** (real ESM lazy chunk, cheap),
**narrowing the `core` barrel** (cheap), and **G15** (relay-only, Zod-free) as the
largest lever that changes the validation model. Ordered, cheapest first, each
measured before/after (medians and IQRs, n=30) with the same spec:

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
