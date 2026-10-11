# 16. Amend the background size budget and enforce the UI budget

- Status: Accepted
- Date: 2026-10-11

## Context

ADR 0006 enforced a single placeholder guard on `background.js` at 40 kB gzipped
and said to add entries for the agent and UI bundles when those entrypoints
land, amending a budget with an ADR if a real bundle exceeds it.

Slice C made the service worker host the command router, the network controller,
the clear orchestrator and its two executors (including the serialized
page-clearing function that must live in the bundle to be injected), and the
report path. `pnpm size` then failed: background 43.91 kB gzipped against 40 kB.

Measured gzipped sizes today: **background 42.95 kB**, **agent 39.43 kB**,
**content (UI host) 56.92 kB**.

An attempt to code-split the cold export/report path out of the worker with a
dynamic `import()` was reverted: WXT inlines it for the background bundle, so the
bundle grew instead of shrinking.

## Decision

- Amend the background budget from 40 kB to **50 kB** gzipped. The growth is
  functional (the worker now hosts the command handlers and clear executors) and
  40 kB was an arbitrary placeholder, not a PRD budget; 50 kB leaves headroom
  without hiding growth.
- Add a **content (UI host)** entry at the PRD section 4 lazy-UI budget of
  **120 kB** gzipped. The UI is inlined into the content script, so that bundle is
  what the PRD budget applies to; at 56.92 kB it passes.
- Do **not** add an agent entry while the PRD section 4 budget (< 15 kB) is not
  met: the agent is 39.43 kB because it bundles Zod and the core validation path.
  Adding a failing entry would red the pipeline without a fix; instead the gap is
  recorded as **G11** with the measured number and the intended fix (validate only
  at the trust boundary that needs it, or use a lighter schema in the agent), and
  it stays visible in `.size-limit.mjs` and `INTEGRATION-GAPS.md`.

## Consequences

- `pnpm size` is green again and now guards both the worker and the UI host.
- The PRD's agent budget remains unmet and tracked (G11); closing it is required
  before the agent budget can be enforced.
