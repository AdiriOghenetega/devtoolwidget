# 8. Core utilities: buffers, redaction, serialization, formatting and ids

- Status: Accepted
- Date: 2026-10-09

## Context

PRD section 8.3 names `core/redaction` and `core/buffers`; FR-3 needs a capped, safe
serializer that never throws on hostile console arguments; PRD section 7 makes
redaction the default; and ids must be reproducible in tests. `core` remains pure
TypeScript with no browser APIs (PRD section 8.2).

## Decision

- **Layout.** Pure utilities live under `src/core/` in `buffers/`, `redaction/`,
  `serialization/`, `format/` and `ids/`, and are re-exported from the `src/core`
  barrel. They import only from `core` and the standard library.
- **`RingBuffer<T>`** (`buffers/ring-buffer.ts`) keeps the last N items with O(1) push,
  drop-oldest on overflow, `toArray`, `clear`, `size` and `capacity`, and rejects a
  non-positive/integer capacity with a `RangeError`.
- **Redaction** (`redaction/redact.ts`) exposes `redactHeaders`, `redactUrl` and
  `redactString`. Sensitive headers/params match an explicit list plus an
  api-key / token / secret / auth shaped name pattern, case-insensitively; Bearer
  tokens and JWT-shaped strings are redacted in free text; callers may add
  `extraRules`. The placeholder is `REDACTED`.
- **Safe serializer** (`serialization/serialize-value.ts`) turns arbitrary values into
  the domain `SerializedValue` union, extended with `map`, `set`, `typed-array`, `date`
  and `regexp` variants. It never throws (property-tested with `fc.anything()`), turns
  cycles into `circular` markers, and honours depth and size caps from
  `DEFAULT_SERIALIZER_LIMITS` (`domain/constants.ts`). DOM-node detection is injected
  via `SerializerHelpers` so `core` stays DOM-free.
- **Formatters** (`format/formatters.ts`): `formatBytes` uses SI units (1000-based),
  `formatDuration` renders ms/s/min, and `formatPercent` takes a fraction (0..1).
- **Ids** (`ids/id.ts`): `createIdFactory` takes injected `now` and `random`, so the
  id sequence is reproducible; a monotonic counter keeps ids unique in a session.
- **Tests** use Vitest, with `fast-check` property tests where invariants are valuable
  (buffer contents, redaction idempotence/no-leak, serializer never throws, formatter
  shape, id determinism/uniqueness).

## Consequences

- New limits belong in `DEFAULT_SERIALIZER_LIMITS` (or `Thresholds`); no inline magic
  numbers. Redaction lists are data, not limits, so they live with the redaction code.
- `core` gains a dev-only dependency on `fast-check`; it is not shipped in the bundle.
- Callers that need DOM awareness pass `SerializerHelpers`; the default treats no value
  as a DOM node.
