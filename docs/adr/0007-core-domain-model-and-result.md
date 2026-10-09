# 7. Core domain model, branded types and the Result convention

- Status: Accepted
- Date: 2026-10-09

## Context

PRD section 9 gives a starting domain model and PRD section 10 gives the numeric
insight thresholds, but several types the model references are left implicit
(`SerializedValue`, `RedactedHeaders`), and several rule bullets give no number at all.
AGENTS.md section 3 requires branded types, discriminated unions, `readonly`, `Result`
for expected failures, no magic numbers, TSDoc on public APIs, and an ADR for
architectural decisions.

## Decision

- **Branded primitives.** `Millis`, `TabId` and `Bytes` are branded numbers built on a
  unique-symbol `Brand<T, B>`, with constructors `toMillis`, `toTabId`, `toBytes` in
  `src/core/domain/brands.ts`. Brands are erased at runtime, so the module holds the one
  sanctioned type assertion in the codebase; it is documented and confined there.
- **Layout.** Domain types live under `src/core/domain/`, split by area with a barrel
  `index.ts`. `src/core/index.ts` re-exports the domain and `Result` as the layer's
  public API. `core` still imports nothing from other layers (PRD section 8.2).
- **Implicit types defined.** `SerializedValue` is a discriminated union covering the
  FR-3 serialization cases (circular references, DOM nodes, errors, truncated
  collections); `RedactedHeaders` is a readonly record.
- **`ActionRef`** is a discriminated union on `type` whose payloads match the FRs:
  `clearStorage` carries a FR-6 preset, `setThrottle` a FR-7 profile, `exportReport` a
  FR-10 format; `hardReload` and `toggleDisableCache` carry the minimum payload.
- **Thresholds and limits** live in `src/core/domain/constants.ts`, including
  `DEFAULT_THRESHOLDS` from PRD section 10. The Core Web Vitals cut-offs were
  re-verified against web.dev (Web Vitals, last updated 2024-10-31): LCP good <= 2.5 s,
  CLS good <= 0.1, INP good <= 200 ms. Rules whose PRD bullet gives no number are
  omitted rather than invented (AGENTS.md section 5): R01, R05, R08, R13 and R14 are
  categorical, and R15 (oversized images) and R16 (memory growth) still need product
  decisions.
- **`Result`** lives in `src/core/result.ts` as a discriminated union with `ok`, `err`,
  `map`, `mapErr`, `andThen`, `unwrapOr` and `fromPromise`. Expected failures never
  throw; `fromPromise` converts a rejection into `err(error)`.
- **Tests.** Runtime tests are `*.test.ts`; type-level tests use `expectTypeOf` in
  `*.test-d.ts`. Type tests are enforced by `pnpm typecheck`, because `expect-type`
  surfaces a mismatch to `tsc` (TS2344). They are excluded from coverage.

## Consequences

- A bare `number` cannot be used where a branded value is expected; consumers call the
  constructors. Constructors do not validate ranges.
- New thresholds must be added to `Thresholds` and `DEFAULT_THRESHOLDS`; inline magic
  numbers are not allowed. Implementing R15/R16 requires a product decision first.
- `*.test-d.ts` files are type-checked but not executed, so they must stay excluded from
  coverage (already configured in `vitest.config.ts`).
