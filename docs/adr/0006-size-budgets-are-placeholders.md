# 6. Size budgets are placeholders until the agent and UI entrypoints exist

- Status: Accepted
- Date: 2026-10-08

## Context

PRD §4 sets two bundle budgets: the injected main-world agent must stay under 15 kB
gzipped, and the lazy-loaded UI bundle under 120 kB gzipped. At scaffold time only the
background entrypoint exists; there is no agent or UI entrypoint to measure. The
`size-limit` config was moved from `package.json` to `.size-limit.mjs` so it can carry
explanatory comments.

## Decision

- Enforce only bundles that exist today: a single guard on `background.js`.
- Do **not** invent `size-limit` entries for bundles that do not exist yet; a check that
  points at a missing file would either fail spuriously or be removed, losing the intent.
- Document the two pending PRD §4 budgets in `.size-limit.mjs` and here, and run
  `pnpm size` in CI, so the budget work is not forgotten.
- Add one `size-limit` entry per real bundle (agent, UI) as soon as those entrypoints
  are introduced.

## Consequences

- A green `pnpm size` does not yet mean the PRD §4 agent/UI budgets are met; this ADR is
  the reminder to add them.
- When the agent and UI entrypoints land, they must come with budget entries and, if
  they exceed the PRD limits, a documented fix or an ADR amending the budget.
