# 3. Enforce the dependency rule with dependency-cruiser

- Status: Accepted
- Date: 2026-10-08

## Context

PRD §8.2 defines a hexagonal layering, and AGENTS.md §2 requires the dependency rule to
be enforced in CI. The PRD's prose ("capture ... depend only on ports and core") and its
dependency-rule sentence disagreed: the sentence listed only `core` and `protocol` as
what `capture` may import, while ports live in the `platform` layer. This was resolved
with the maintainer: capture may import the platform **ports (interfaces)** but never
the platform **adapters** or **fakes**. Tests are colocated inside `src` (AGENTS.md §7),
so a capture test that uses the in-memory fakes is allowed, but production capture code
is not. The PRD prose and rule sentence were updated to match.

## Decision

- Encode the rule in `.dependency-cruiser.cjs` as `forbidden` rules:
  - `core` and `protocol` import nothing from the other layers.
  - `platform` and `ui` may import `core` and `protocol` only.
  - `capture` may import `core`, `protocol` and `src/platform/ports/**` only.
  - `capture` must never import the platform adapters (`platform/chrome`,
    `platform/firefox`) — this holds even for test files.
  - `capture` must not import the platform barrel or any other platform file that is
    not under `ports/` or `fakes/`.
  - `capture` may import `src/platform/fakes/**` **only from colocated test files**
    (`*.test.ts` / `*.test.tsx`); production capture code must depend on the ports.
  - `capture` → `ui` and `capture` → `entrypoints` are never exempted.
  - `entrypoints` may import anything and carries no business logic.
- `deps:check` (`depcruise src --config .dependency-cruiser.cjs`) runs the rules against
  the real source.
- `tests/architecture/dependency-rule.test.ts` cruises committed fixtures under
  `tests/architecture/fixtures/` and asserts:
  - `core` importing `ui` is detected (`dependency-rule/`);
  - a colocated capture test importing `platform/fakes` is allowed
    (`capture-test-imports/`);
  - a colocated capture test importing `platform/chrome` is rejected
    (`capture-test-imports/`);
  - non-test capture code importing `platform/fakes` is rejected
    (`capture-nontest-imports/`);
  - the real `src` tree is clean.

## Consequences

- A layering violation fails CI through two independent paths: the CLI check and the
  fixture test.
- The fakes exemption keys off the `*.test.ts(x)` filename, so a shared capture test
  helper without that suffix is treated as production code and cannot import fakes.
- The fixtures are deliberately broken code; lint ignores them
  (`tests/architecture/fixtures/**`) and they live outside `src`, so they are excluded
  from coverage and from the shipped graph.
- Adding a legitimate new cross-layer import requires updating the ruleset and an ADR.
