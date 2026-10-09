# 9. Protocol may depend on core

- Status: Accepted
- Date: 2026-10-09

## Context

PRD section 8.2 and AGENTS.md section 2 originally stated that both `core` and
`protocol` import nothing from the other layers. Implementing `src/protocol`
surfaced a conflict: the protocol's parse functions must return the `Result` type, and
its event and command payloads carry `core` domain data (console entries, network
entries, vitals, storage summaries, `PageSnapshot`, branded `Millis`/`Bytes`/`TabId`).
`Result` and those shapes live in `src/core`.

The alternatives were to duplicate `Result` and the payload shapes inside `protocol`, or
to let `protocol` depend on `core`. Duplication would create drift between the wire
contract and the domain model, which the "one source of truth" goal forbids.

## Decision

- `protocol` may import `core`, **one direction only**. `core` must never import
  `protocol` (or any other layer).
- `protocol` must not import `platform`, `capture`, `ui` or `entrypoints`.
- `protocol` reuses `Result`, the `ok`/`err` helpers and the branded constructors from
  `core`; it does not redefine them.
- `core` stays the source of truth for domain shapes. Zod payload schemas are written to
  produce the core types (branded numbers via the core constructors) and are verified
  against them with `expectTypeOf` type-level tests that fail on drift.
- Envelope, command and result types that exist only in `protocol` are inferred from
  their Zod schemas with `z.infer`.
- Encoded in `.dependency-cruiser.cjs`: `core-must-not-import-other-layers` (which still
  forbids `core` → `protocol`) and `protocol-may-only-import-core`. Architecture tests
  cruise fixtures proving `core` cannot import `protocol`, that `protocol` cannot import
  `platform`, and that `protocol` may import `core`.

## Consequences

- PRD section 8.2 and AGENTS.md section 2 are updated to: `core` imports nothing;
  `protocol` may import `core` only; `platform`, `capture` and `ui` may import `core` and
  `protocol`.
- The wire contract cannot silently diverge from the domain model; a drift fails
  `pnpm typecheck`.
- `core` remains dependency-free, so it stays portable and testable.
