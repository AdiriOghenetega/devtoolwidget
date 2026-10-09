# 4. Ban default exports, with a WXT entrypoint exception

- Status: Accepted
- Date: 2026-10-08

## Context

PRD §13 and AGENTS.md §3 require named exports ("Named exports only. One component per
file."). WXT, however, requires its entrypoints to **default-export** their definition
(`export default defineBackground(...)`), and a file placed directly in
`src/entrypoints/` is treated by WXT as an entrypoint. A plain named-export barrel at
`src/entrypoints/index.ts` would therefore be built as an (unlisted-script) entrypoint,
which is both wrong and a build hazard.

## Decision

- The `no-restricted-syntax` rule bans `ExportDefaultDeclaration` across `src/**`.
- The only override is `src/entrypoints/**`, where WXT mandates a default export; the
  override is documented in `eslint.config.mjs` and here.
- The `entrypoints` layer therefore has no barrel at the layer root. Its first
  entrypoint is `src/entrypoints/background/index.ts`, and the layer's wiring test is
  colocated in the same subfolder as `index.test.ts`.
- The default-export ban applies unchanged to `core`, `protocol`, `platform`, `capture`
  and `ui`.

## Consequences

- WXT entrypoints can follow WXT's required shape without weakening the rule elsewhere.
- The exception is scoped to a single directory; any default export outside
  `src/entrypoints/**` fails lint.
