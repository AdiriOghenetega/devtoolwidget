# 2. WXT + Preact scaffold, path aliases and pinned TypeScript

- Status: Accepted
- Date: 2026-10-08

## Context

The project needs a Manifest V3 extension scaffold with TypeScript and Preact, a
single package-manager workflow, and the layer folders from PRD §8.3. Tooling must
support the strict compiler options and per-layer coverage thresholds the PRD and
AGENTS.md require. Several cross-cutting choices had to be made once and recorded, and
the newest published package versions are not all mutually compatible.

## Decision

- **Framework:** WXT 0.21 builds the extension. `srcDir: 'src'` is set so the PRD §8.3
  layout (`src/core`, `src/protocol`, `src/platform`, `src/capture`, `src/ui`,
  `src/entrypoints`) is the project layout.
- **UI framework:** Preact via `@preact/preset-vite`, added through WXT's `vite`
  option. WXT has no official Preact module, so the Vite plugin is used directly.
- **Path aliases:** `@core`, `@protocol`, `@platform`, `@capture` and `@ui` are declared
  in `wxt.config.ts` under `alias` — **not** as hand-written `paths` in `tsconfig.json`.
  WXT materializes them into `.wxt/tsconfig.json` (which the root `tsconfig.json`
  extends) and into the bundler, keeping TypeScript and Vite resolution in sync. This
  follows the WXT TypeScript guidance.
- **TypeScript is pinned to 5.x.** The registry currently resolves `typescript` to 7.x,
  but dependency-cruiser 18 and typescript-eslint 8 support only TypeScript `< 7`.
  Pinning to the 5.x line (the PRD's own line) keeps lint and the dependency check
  functional. Revisit when those tools support TypeScript 7.
- **Package manager:** pnpm, with `postinstall: wxt prepare` and `prepare: husky`.
- **Toolchain pin:** Node is pinned via `.nvmrc` (`24.16.0`) and `package.json`
  `engines` (`>=24.16.0`); pnpm is pinned via the `packageManager` field
  (`pnpm@12.10.1`) and `.npmrc` sets `engine-strict=true`. CI
  (`.github/workflows/ci.yml`) uses the same Node version (from `.nvmrc`) and pnpm
  version, so the PRD §12 gates are reproducible.

## Consequences

- CI and local installs resolve the same Node and pnpm versions; a required tool that
  needs a newer runtime must be accompanied by a pin update.

- Aliases must be edited in `wxt.config.ts`, then `wxt prepare` re-run; editing
  `tsconfig.json` paths directly would clobber WXT's generated paths.
- The TypeScript pin is a deliberate deviation from "latest"; it is revisited when the
  dependency tooling supports 7.x.
- Preact is wired but no framework module handles auto-imports for it.
