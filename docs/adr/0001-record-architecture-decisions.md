# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-04-18
- **Deciders:** Team Lead (tech-debt audit 2026-04-18)
- **Tags:** process, documentation, institutional-memory

## Context

The tech-debt audit on 2026-04-18 surfaced a Law 6 (Reality Anchor) violation: `CLAUDE.md` and `ARCHITECTURE.md` had drifted from the actual codebase by up to 175% on store count and 34% on Index.tsx LOC. The root cause was not bad intent — it was that point-in-time claims in prose documents have no enforcement mechanism and no audit trail of *why* the numbers should be one way or another.

Separately, repeated design questions ("why 4 Zustand stores instead of a single root?", "why bridge pattern between IndexedDB and Zustand?", "why Capacitor 8 over React Native?") have been answered verbally or in chat transcripts that do not survive session boundaries. This is reasoning debt — the answers exist but are inaccessible to future engineers (or future AI sessions).

## Decision

We adopt lightweight Architecture Decision Records under `docs/adr/` following the Michael Nygard (2011) format. Every architecturally-significant decision is recorded as one numbered Markdown file, committed alongside the PR that implements it.

## Alternatives Considered

- **Status quo (prose in `ARCHITECTURE.md`)** — rejected: no separation between "what exists now" and "why we chose it over the alternative"; prose rots silently.
- **GitHub Discussions / Issues** — rejected: not version-controlled with the code; searchable only via the GitHub UI; brittle to repo moves.
- **Y-ADRs (YAML structured ADRs)** — rejected: machine-readable but adds tooling dependency with no proven benefit for a small team.
- **Full `arc42` template** — rejected: heavyweight for a mobile-wellness app; 90% of sections would be empty.

## Consequences

**Positive:**
- Institutional memory survives author turnover and session restarts.
- PR reviewers get context ("why this and not Y?") without re-litigating.
- Future AI sessions (CLAUDE) can read ADRs before proposing changes — reducing Law 6 violations.
- When rejecting an RFC, we can cite an ADR as precedent.

**Negative:**
- Added discipline: every significant PR should ask "is this ADR-worthy?"
- Slight writing overhead (~15 min per decision).

**Neutral:**
- `ARCHITECTURE.md` remains the current-state constitution; ADRs are the historical "why."

## Rollout / Migration Plan

- This ADR merges with the tech-debt audit Stage 1 PR.
- Going forward: PR reviewers request an ADR for any change affecting 2+ modules, storage layer, native bridge, or public API surface.
- Retroactive ADRs are optional. Good candidates (to be backfilled opportunistically): "Why Zustand + Dexie bridge pattern", "Why Capacitor 8 over React Native", "Why custom i18n over i18next", "Why 28-law enforcement hook framework".

## Verification

- `docs/adr/` directory exists with `README.md` + `0000-template.md` + this file.
- Future PRs that touch store shape, auth flow, or schema reference an ADR number.
- ADR count is tracked in `doc-counts.cjs` (future enhancement).

## References

- Michael Nygard, "Documenting Architecture Decisions" (2011)
- thoughtworks.com Technology Radar: ADRs moved to Adopt (2018)
- Internal: `docs/tech-debt-audit-2026-04-18.md` §8 (self-reflection on doc drift)
- Internal: `docs/law6-empiricism.md` (Reality Anchor)
