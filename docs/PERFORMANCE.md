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
- **Method:** load the fixture page (`/`) **7 iterations** in (a) a plain Chromium
  persistent context with **no extension** and (b) the extension context, one
  warm-up each, and read `PerformanceNavigationTiming.duration` for each load.
  Compare **medians**, and report the min–max spread.
- **Command:** `pnpm exec playwright test --config tests/e2e/playwright.config.ts benchmark`.

**Result (this machine, n=7):**

|                       | median      | spread (max−min) |
| --------------------- | ----------- | ---------------- |
| without extension     | 145.3 ms    | 49.8 ms          |
| with extension        | 220.2 ms    | 89.5 ms          |
| **overhead (median)** | **74.9 ms** |                  |

**Honest verdict:** the added main-thread time is **~75 ms**, which **misses the
PRD target of 50 ms**. The spread (±50–90 ms) is large because the machine is a
loaded laptop and the fixture itself is not a steady-state page, so treat 75 ms as
an order-of-magnitude, to be re-measured on a quiet CI runner.

### Gating policy

- **Hard-gated in CI (deterministic):** `pnpm size` (above) and the memory check
  (below).
- **Benchmark: relative threshold, report-only spirit.** The spec asserts
  `extendedMedian <= baselineMedian * 3 + 50 ms` — a generous guard that fails
  only on a catastrophic regression. Runtime timings on shared runners are noisy,
  so a tight absolute gate would be flaky; the numbers are logged
  (`[bench] …`) and should be trended, not hard-gated.

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
not demonstrate a change large enough to report against the ~75 ms aggregate, so
none was merged. The plan for closing the PRD gap is below.

## Plan to close the ~25 ms gap (75 ms → ≤ 50 ms)

Ordered, cheapest first, each measured with the benchmark above (medians, n≥15, on
a quiet runner) before/after:

1. **`redactUrl` fast path** (skip `new URL` when there is no query/userinfo) and a
   `redactString` fast path (skip the two regexes when the string has no `e`/`B`).
2. **Defer the performance work** (see `docs/DESIGN-agent-perf-split.md`): move
   web-vitals/long-task observers to a `document_idle` script so the
   `document_start` critical path only patches console/network and the bridge.
3. **Trim the content-script work at `document_start`**: the UI shell mount and the
   design tokens are not needed for capture; gate them behind the first open.
4. **Re-measure on CI hardware** and, if the overhead is still over 50 ms, record
   the residual with the contributing breakdown rather than adjusting the target.
