# 1. Record architecture decisions

- Status: Accepted
- Date: 2026-10-08

## Context

devtoolwidget is a layered browser extension with an explicit dependency rule and a
privacy-first, no-network-calls mandate ([`docs/PRD.md`](../PRD.md) §8, §7). Decisions
about layering, security boundaries (the main-world bridge), validation, and tooling
will shape the codebase for its whole life. These decisions must be recorded where
future contributors and AI assistants can find them, and reasoning must survive the
people who made it.

## Decision

We will record every architecturally significant decision as an Architecture Decision
Record (ADR) in `docs/adr/`, one Markdown file per decision, numbered sequentially:
`NNNN-title-in-kebab-case.md`.

An ADR captures the status, the context, the decision, and its consequences. Once
accepted, an ADR is immutable: supersede it with a new ADR rather than editing history.
The PRD remains the source of truth for *what* to build; ADRs record *how* we chose to
build it and why.

Significant decisions include, but are not limited to:

- a new cross-layer dependency in the `core` / `protocol` / `platform` / `capture` /
  `ui` / `entrypoints` layering (§8.2),
- changes to trust boundaries or validation policy,
- choice of a framework, protocol, or storage format that is expensive to change,
- any deviation from the PRD.

## Consequences

- Decisions and their rationale are discoverable and reviewable in version control.
- Contributors must write an ADR before making a significant or deviating change.
- There is a small ongoing cost to keep the ADR log current.
