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

| bundle                                 | budget | measured     |
| -------------------------------------- | ------ | ------------ |
| `agent.js` (main world)                | 15 kB  | **14.34 kB** |
| `background.js` (MV3)                  | 50 kB  | 44.5 kB      |
| `content-scripts/content.js` (UI host) | 120 kB | 57.8 kB      |

### Agent size trend (per merge)

Headroom is **0.66 kB** to the 15 kB budget, so every merge that touches the
agent must re-measure. Record the `agent (main world)` line of `pnpm size` here on
each merge:

| merge                                       | agent (kB gz) | note                   |
| ------------------------------------------- | ------------- | ---------------------- |
| Slice A (typed capture, Zod in bridge)      | 39.43         | over budget (G11)      |
| + hand-written bridge guards, Zod-free core | 12.88         | under budget           |
| + default redaction at capture (PRD 7)      | 13.60         | privacy fix            |
| + `agent.config` (G13)                      | 14.23         | guarded config message |
| + table-driven guards (G13 review)          | **14.34**     | current `main` + G13   |

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

**Result (platform `win32`, laptop i7-8565U, n=30, metric `TaskDuration`):**

| series                           | median      | IQR (q3−q1) |
| -------------------------------- | ----------- | ----------- |
| inactive (no site scripts)       | 113.4 ms    | 7.3 ms      |
| active (site scripts registered) | 208.0 ms    | 13.9 ms     |
| **overhead (median)**            | **94.6 ms** |             |

**Honest verdict:** the added main-thread task time is **~95 ms**, which **misses
the PRD target of 50 ms**. The IQRs are tight (7–14 ms), so this CDP-based method is
much less noisy than the previous `navigation.duration` approach and the number is
reliable on this machine; re-measure on the CI runner to confirm.

### Gating policy

- **Hard-gated in CI (deterministic):** `pnpm size` (above) and the memory check
  (below).
- **Benchmark: relative threshold, report-only spirit.** The spec asserts
  `activeMedian <= inactiveMedian * 3 + 50 ms` — a generous guard that fails only on
  a catastrophic regression. Runtime timings on shared runners are noisy, so a tight
  absolute gate would be flaky; the numbers are logged (`[bench] …`) and should be
  trended, not hard-gated.

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
3. **Trim the content-script work at `document_start`**: the UI shell mount and the
   design tokens are not needed for capture; gate them behind the first open.
4. **Re-measure on CI hardware** and, if the overhead is still over 50 ms, record
   the residual with the contributing breakdown rather than adjusting the target.
