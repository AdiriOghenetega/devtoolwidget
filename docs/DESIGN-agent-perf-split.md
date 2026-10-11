# Design note: splitting the agent's critical and deferred scripts

Status: proposal (no code yet). Needs a PRD §4 decision (below).

## Why

The injected main-world agent is currently **one script** budgeted at **< 15 kB
gzipped** (PRD §4). It is at **14.34 kB**, so there is under 1 kB of headroom.
Wiring the `PerformanceCollector` end to end (web-vitals for LCP/CLS/INP, long
tasks / TBT, resource and image observers) would add several kB and blow the
budget. The question is what actually has to be there at `document_start`.

## What must run at document_start

These must be installed **before page scripts run**, or data is lost irrecoverably:

- **Console patching** — `console.log/info/warn/error/…` and `window.onerror` /
  `unhandledrejection` / `securitypolicyviolation` listeners. Logs emitted before
  the patch cannot be replayed.
- **Network patching** — the `fetch` (and `XMLHttpRequest`, WebSocket) wrappers.
  A request issued before the patch is invisible.
- **The secure bridge** — the capturing `handshake` listener, port adoption and
  the `agent.config` bootstrap handling, plus event batching over the port.

## What can be deferred (after load)

`PerformanceObserver` can be registered late and still receive past entries with
`{ buffered: true }`; web-vitals likewise reads buffered entries and supports
late subscription:

- **Core Web Vitals (LCP/CLS/INP/FCP/TTFB)** via web-vitals — buffered, with
  attribution.
- **Long tasks / total blocking time** — `PerformanceObserver({ type: 'longtask' })`
  with `buffered: true`.
- **Resource timing reconciliation** — already runs off a resource observer; it
  refines network entries asynchronously and tolerates late attachment.
- **Image / oversized-resource scans** — a post-load scan.

So only the _console, network and bridge_ need to be critical; performance is a
good candidate for a second, deferred script.

## Expected size cost

Rough, gzipped, added to the agent if performance stays in the critical script:

| item                                      | est. gz   |
| ----------------------------------------- | --------- |
| web-vitals                                | ~2.5 kB   |
| PerformanceCollector + limits + summaries | ~2.5 kB   |
| long-task / resource observers + glue     | ~1 kB     |
| **total**                                 | **~6 kB** |

That would take the agent from 14.34 kB to ~20 kB — well over 15 kB.

## Proposal: two scripts, two budgets

1. **Critical script** (injected at `document_start`): console + network patching,
   the bridge, batching. Hard budget, e.g. **≤ 15 kB gz**. This is today's agent
   minus the performance wiring.
2. **Deferred performance script**: injected after load (e.g. on `load` or
   `DOMContentLoaded` + a tick), registers observers with `buffered: true` and
   feeds the same pipeline over the same bridge. Separate budget, e.g.
   **≤ 25 kB gz**.

The two scripts share the pipeline/bridge contract but not a bundle, so
performance growth cannot threaten the critical budget.

## PRD §4 change implied

PRD §4 currently sets a single budget: "the injected main-world agent < 15 kB".
This proposal needs that to become **two** budgets (a tight critical script and a
separate deferred performance script), with the deferral justified by
`buffer: true`. That is a PRD change and needs sign-off before implementation;
it would also be recorded as an ADR (amending ADR 0006 §4 and ADR 0018's agent
budget).

## Open questions

- Deferred injection trigger: `load` vs `requestIdleCallback` vs a
  `content_scripts` entry with `run_at: document_idle` (simplest, no extra code).
- Does `SecurityPolicyViolationEvent` capture also belong in the deferred script?
  It fires at any time and can be replayed only by listening — keep it critical.
- Whether the deferred script is a dynamic `import()` from the content script or
  a second WXT entrypoint; WXT inlines dynamic imports for the background (ADR
  0016), so a second entrypoint registered at `document_idle` is the safer shape.
