# 18. The agent budget: hand-written bridge guards and a Zod-free agent graph

- Status: Accepted
- Date: 2026-10-11

## Context

PRD §4 budgets the injected main-world agent at **< 15 kB gzipped**. Measured, the
agent was **39.43 kB**: it imported Zod (the protocol command schemas and the three
bridge bootstrap schemas). `.size-limit.mjs` deliberately omitted an agent entry
while it failed, so the budget was unenforced and recorded as gap G11.

Zod was only there for a handful of tiny messages and for validation the agent did
not need: the protocol command schemas were already tree-shaken (`parseCommand`
count 0), yet Zod's core remained because _something_ imported it.

## Decision

1. **Hand-written guards for the three bootstrap messages.** `capture/bridge/handshake.ts`
   validates `handshake`/`ack`/`commit` with small strict guards typed against the
   `z.infer` types of the source-of-truth schemas in `protocol/bridge.ts` (exact
   expected keys, primitive checks, nonce length cap, never throws). A permanent
   equivalence test (`capture/bridge/handshake.test.ts`) runs both over a shared
   corpus of valid, invalid and fuzzed inputs — extra keys, wrong types, huge
   strings, missing nonce, `Object.create`-inherited props, `__proto__` pollution —
   and asserts they always agree.
2. **No runtime Zod in `capture/bridge`.** `agent-bridge` no longer parses commands
   (the port carries capture events outward only); `content-bridge` receives the
   protocol `parseMessage` by injection, so it imports only the Zod-free
   `protocol/version` leaf at runtime.
3. **No runtime Zod in `core`.** The settings schemas moved out of `core` into
   `protocol/settings.ts` (a storage trust boundary, ADR 0009); `core` keeps plain
   TypeScript settings types and `DEFAULT_SETTINGS`. The test-only `harSchema` moved
   out of `core/export/builders.ts`. A Zod-free `platform/chrome/clock.ts` was split
   out so the agent can import the clock without the storage adapter's Zod.
4. **Enforcement, two halves.** `.size-limit.mjs` gains the agent entry at **15 kB
   gzipped** (CI already runs `pnpm size`), catching the _symptom_. A
   dependency-cruiser rule bans the agent entrypoint and `capture/bridge` from
   importing a Zod-backed protocol module at runtime (type-only allowed), naming the
   _cause_. A `reachable` rule cannot target npm `zod` here because
   `doNotFollow: node_modules` keeps it out of the graph and it also matches type-only
   edges, so the direct runtime-only ban plus the size gate are the enforceable pair.

## Result

`agent.js` measured **12.60–12.88 kB gzipped** (from 39.43 kB), and `pnpm size`
enforces it. The rule was verified to fire on a deliberate runtime Zod import and to
stay clean otherwise.

## Consequences

- The bridge no longer answers commands over its port. That capability was unused and
  is what let the agent drop the protocol command schemas; the content-side request
  API is kept for a future revision that brings its own validated path.
- **G13 (resolved).** The agent is configured at runtime by a fourth Zod-free
  bootstrap message, `agent.config` (capture level, per-origin body capture, user
  redaction rules, latency), validated by the table-driven guard in
  `capture/bridge/validate.ts`. The worker derives it from settings and pushes it on
  the panel port; the content script forwards it over the committed bridge port. A
  real-browser Playwright test asserts the effect without a page reload.
- **Wire-schema fix.** `networkEntrySchema` omitted `bodyPreview`, `meta` and
  `startedAt`, so the service worker stripped them; the schema now matches core
  `NetworkEntry`/`NetworkMeta`.
- AGENTS.md §6 now states the exception and the reachability/direct-ban rule.

## Residual risks

1. The equivalence test is the only thing keeping the guards honest; it must keep
   running and grow with the corpus.
2. The dependency-cruiser ban is an allow-list of protocol module paths; a new
   Zod-backed protocol module must be added to it, or the size gate is the backstop.
