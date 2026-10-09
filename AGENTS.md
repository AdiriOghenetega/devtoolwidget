# AGENTS.md

Rules and context for AI assistants (and humans) working in this repository.

The source of truth for product requirements is [`docs/PRD.md`](docs/PRD.md). When this
file and the PRD disagree, the PRD wins and this file must be corrected.

## 1. Project summary

devtoolwidget is an open-source browser extension that gives developers one
always-available, glanceable panel answering: _what is wrong with this page right now,
and what can I do about it?_ It replaces tab-hopping across browser DevTools with live
diagnosis, ranked plain-language findings and one-click fixes.

- Tagline: **Diagnose and act, in one click.**
- Differentiator: it is the summary layer _on top of_ DevTools, not a DevTools clone.
- Targets: Chromium (Chrome, Edge, Brave) first; Firefox build via WXT with feature
  detection; Deep mode is Chromium-only.
- Privacy-first: no network calls from the extension, no telemetry, all data stays on
  device, sensitive values redacted by default.

Do not build DevTools-lite. Build the synthesized summary layer.

## 2. Architecture (PRD §8.2) and the dependency rule

The codebase is a **hexagonal / layered** design. Each layer has a narrow, explicit set
of allowed dependencies.

- **core** — pure TypeScript, **no browser APIs**. Domain types, insights engine,
  scoring, redaction, ring buffer, formatters, HAR builder, diffing.
- **protocol** — message types and Zod schemas plus a typed channel abstraction with
  versioning.
- **platform** — defines ports (interfaces) for storage, tabs, browsingData, scripting,
  debugger and clock, and provides real adapters plus in-memory fakes for tests.
- **capture** — collectors (console, network, performance) that depend only on core,
  protocol and the platform ports (interfaces).
- **ui** — components, signal-based stores and screens. Depends on core and protocol
  only.
- **entrypoints** (WXT) — wires everything together and contains **no business logic**.

**Dependency rule (enforced in CI via dependency-cruiser or eslint-plugin-boundaries):**

- `entrypoints` may import anything.
- `platform` and `ui` may import `core` and `protocol`.
- `capture` may import `core`, `protocol` and the **platform ports (interfaces) only**; it
  must never import the platform adapters (`platform/chrome`, `platform/firefox`), the
  fakes (`platform/fakes`) or the platform barrel. Tests may import the fakes.
- `core` imports **nothing** from the other layers; `protocol` may import `core` only
  (never `platform`, `capture`, `ui` or `entrypoints`).

The rule is encoded in `.dependency-cruiser.cjs`; `tests/architecture/dependency-rule.test.ts`
cruises a fixture that intentionally violates it to prove detection, and the real `src`
tree to prove compliance. See ADR 0003.

When adding an import, confirm it respects the rule. A new cross-layer dependency is an
architectural change and requires an ADR (see §7).

Folder layout is fixed by PRD §8.3: `src/core`, `src/protocol`, `src/platform`,
`src/capture`, `src/ui`, `src/entrypoints`, plus `docs/`, `tests/`.

## 3. Engineering standards (PRD §13)

- No `any`, no non-null assertions, no unchecked casts. Prefer discriminated unions,
  branded types and `readonly`.
- Pure functions in `core`; side effects only behind `platform` ports.
- Named exports only. One component per file. Files under 300 lines, functions under 40
  lines where practical.
- No magic numbers: thresholds and limits live in typed constants or configuration.
- Expected failures return `Result`; exceptions are for programmer errors only. Every
  cross-context input is validated.
- Test files sit beside the code as `*.test.ts`. Test names describe behavior. Bug fixes
  start with a failing test.
- TSDoc on public APIs. Architectural decisions recorded as ADRs in `docs/adr/`.
- Conventional Commits, small focused commits, no dead code or commented-out code.

Also enforced by the toolchain: TypeScript strict (with `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`), ESLint flat config with
`typescript-eslint` strict-type-checked, Prettier, dependency-cruiser, size-limit,
commitlint. Verify current versions and APIs when installing; do not pin from the PRD.

## 4. Verify APIs against current official docs

Browser extension APIs drift. Do **not** rely on memory or on the PRD for API behavior.

- Before implementing against a browser API (chrome.*, WXT, Manifest V3, CDP,
  Performance APIs, web.dev thresholds), check the **current official documentation**
  (developer.chrome.com for Chrome extensions, MDN, WXT docs, web.dev) and cite the
  behavior you verified.
- The PRD's own thresholds explicitly say to re-verify them (e.g. LCP/CLS/INP in
  PRD §10). Treat them as starting values to confirm, not gospel.
- This repository must make no network calls at runtime, but research during
  development is expected and encouraged.

## 5. Stop and ask when requirements are ambiguous

If a requirement is ambiguous, contradictory, or the PRD does not cover the case:

- **Stop.** Do not guess, invent scope, or silently pick an interpretation.
- Surface the specific ambiguity, the options, and the trade-offs, and ask for a
  decision before writing the code that depends on it.
- Prefer the smallest change that satisfies an unambiguous reading; if none exists,
  asking is required.
- An unanswered ambiguity is a blocker, not a license to improvise.

## 6. Result and Zod conventions

**Result** (PRD §8.5, §13):

- Expected failures never throw. Commands and fallible operations return a typed
  `Result` value. Model success and failure as a discriminated union rather than
  throwing.
- Exceptions are reserved for programmer errors (bugs), not for expected runtime
  conditions (missing data, permission denied, API unavailability, IO failure).
- Never `throw` across a trust or context boundary; convert to a `Result`.

**Zod:**

- Zod is required **at every trust boundary**: messages, storage reads/writes, imports,
  and all data arriving from the main world (which is untrusted — see PRD §7 security).
- Every cross-context message carries a type, a schema version, a correlation ID and a
  Zod schema. Validate on receipt and before use; never consume unvalidated input.
- Parse, do not cast. Do not add an unchecked cast to silence a validation mismatch;
  fix the schema or handle the `Result` failure.
- Settings are persisted through the storage port with a schema version and explicit
  migrations.

## 7. Tests: naming and colocation

- **Colocated:** test files live beside the code they test, as `*.test.ts` /
  `*.test.tsx`. No parallel `__tests__` mirror tree.
- **Naming:** test names describe **behavior**, not implementation. Write what the unit
  does under which condition and the expected outcome (e.g.
  `returns a critical finding when a request returns 500`), not `it works` or
  `test redaction`.
- **Bug fixes start with a failing test** that reproduces the bug, then the fix.
- Coverage gates (PRD §4): line coverage ≥ 90% in `src/core`, ≥ 80% overall.
- Unit tests use in-memory platform fakes; every insight rule is unit-tested with
  boundary-value cases; redaction is tested with adversarial inputs.

## 8. Commits: Conventional Commits

All commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

- Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`,
  `chore`, `style`.
- Scope is the layer or area, e.g. `core`, `protocol`, `platform`, `capture`, `ui`,
  `entrypoints`, `insights`, `docs`.
- Reference stable FR IDs from PRD §6 in the description or body where relevant
  (e.g. `feat(capture): capture console entries (FR-3)`).
- Keep commits small and focused; no dead code or commented-out code. `commitlint`
  enforces the format.

## 9. Task Completion Protocol

After **every** task, before reporting it as done:

1. Run **lint**.
2. Run **typecheck**.
3. Run the **dependency check** (dependency-cruiser / eslint-plugin-boundaries) to
   confirm the layering rule in §2 still holds.
4. Run the **tests with coverage** and confirm the coverage gates in §7.
5. **Fix all failures** — lint, type errors, boundary violations and failing tests. A
   task is not complete while any of these fail.
6. **Report**, concisely:
   - **What changed** — files and behavior.
   - **What was tested** — commands run and their results (including coverage numbers).
   - **Deviations from the PRD** — anything implemented differently, plus any ambiguity
     in §5 that was resolved, and how.
   - **Suggested commit message** — a Conventional Commits message per §8.

If a required command does not exist yet (tooling not installed), say so explicitly in
the report rather than claiming the check passed. Do not install dependencies unless
the task asks for it.
