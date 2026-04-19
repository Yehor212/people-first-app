# Architecture Decision Records (ADRs)

An ADR captures a single architecturally-significant decision, its context, the alternatives considered, and the consequences. ADRs are immutable once merged — if a decision changes, write a new ADR that supersedes the prior one.

## Why ADRs for ZenFlow

`ARCHITECTURE.md` describes *what the code looks like today* (the "constitution"). An ADR explains *why* we chose this over the alternatives — institutional memory that survives past the original author and prevents re-litigating settled questions. This complements the `memory/` system: memories are point-in-time observations, ADRs are load-bearing decisions.

Reference: Michael Nygard, "Documenting Architecture Decisions" (2011); thoughtworks.com "Architecture Decision Records" (Tech Radar 2018 → Adopt); Google Engineering Practices (2024 public talks).

## When to write an ADR

- **MUST:** Any change that affects 2+ modules, storage layer, state shape, auth flow, native bridge, data schema, or public API.
- **SHOULD:** Choosing between libraries with >10 KB bundle impact; security model changes; migration plans.
- **DO NOT:** Local refactors, bug fixes, small utility additions.

Rule of thumb: if a future engineer would ask "why did we do it this way?" — write an ADR.

## Format

Use the template at `./0000-template.md`. Numbering is sequential. Filenames: `NNNN-kebab-case-title.md`.

## Status lifecycle

- `Proposed` — under discussion in PR
- `Accepted` — merged; decision is in effect
- `Superseded by NNNN` — a later ADR replaced this one
- `Deprecated` — decision no longer applies but was never formally replaced

## Index

| # | Title | Status |
| --- | --- | --- |
| 0000 | Template | (not an ADR) |
| 0001 | Record architecture decisions | Accepted |

## Relationship to other docs

- `ARCHITECTURE.md` — current state, auto-generated metrics
- `docs/law*.md` — cross-cutting engineering laws (enforced by hooks)
- `docs/tech-debt-audit-*.md` — point-in-time tech-debt audits
- `memory/*.md` — session-level observations and user preferences
- `docs/adr/*.md` — **load-bearing architectural decisions** (this directory)
