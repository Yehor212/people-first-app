# ADR-0003: 28-law enforcement via Claude Code hooks (mechanical quality gates)

- **Status:** Accepted (retroactive — framework built across 2025-Q4 / 2026-Q1)
- **Date:** 2026-04-18 (retroactively recorded)
- **Deciders:** Team Lead
- **Tags:** process, quality-gates, tooling, meta

## Context

ZenFlow is a solo-maintained mobile app with an AI pair-programmer (Claude Code) as the primary second set of eyes. Conventional pull-request review and linting are present but insufficient because:

- A solo author silently accumulates architectural inconsistencies over time — there's nobody to push back on "just this one hardcoded color" or "just this one silent `.catch`".
- AI pair-programmers have a known failure mode: they claim to have done X when they did Y. Prose policies ("always use theme tokens") are easily bypassed.
- Tech-debt ledger rot — as of 2026-04-18 audit, `CLAUDE.md` and `ARCHITECTURE.md` had drifted 34-175% from reality because nothing forced them to stay current.

The project needs enforcement that is **mechanical** (no human or AI needs to remember to run it) and **unbypassable** (agent edits trigger it).

## Decision

We implement 28 "Laws" — cross-cutting engineering rules (Zero Regression, Reality Anchor, Loud Failure, 60-FPS, Cross-Platform, State Integrity, Babel Law, Race Law, Ratchet Law, etc.) — and enforce them via ~45 hooks configured in `.claude/hooks/` and `.claude/settings.json`.

Enforcement layers:

1. **Pre-flight gate** — 11 checks before any edit (Law 21 Root Cause Mandate, etc.)
2. **Edit-time hooks** — ide-diagnostic-gate, auto-format, ci-tracker, protected-files
3. **Post-flight reflection** — 28-row compliance table after every edit
4. **Stop gate** — structured JSON validation (`.postflight-done` via `reflection-validate.cjs`, 20 rules)
5. **Commit gate** — 8-layer validation before `git commit`
6. **Push gate** — CI preflight (`npm run ci:preflight`)
7. **Ratchet Law (Law 27)** — quality floors that only move down (better)

Token files (`.preflight-token`, `.postflight-done`, `.fullcycle-active`, `.ci-evidence`, etc.) are one-time, gitignored, consumed after use. Self-tampering defense: `CLAUDE.md` and `.claude/settings.json` require `.claude-md-unlock` token for edits.

## Alternatives Considered

- **Pure CI-side enforcement (GitHub Actions only)** — rejected: agent failures would still be committed locally, wasting tokens on rejected PRs. Fast feedback loop required for solo dev.
- **Pre-commit hooks only (Husky, no framework)** — rejected: Husky runs at git-commit time, too late; agent edits need gates at edit-time to be caught cheaply.
- **ESLint/TypeScript only** — rejected: too narrow (doesn't cover "reality anchor," "cross-platform equivalence," "race conditions").
- **No enforcement, rely on prose policies** — rejected by empirics: 2025 drift found CLAUDE.md undercounted hooks by 39%, stores by 175%, for weeks.

## Consequences

**Positive:**
- Agent edits either pass the gates or don't land. Policy becomes unenforceable only via explicit override.
- Mechanical evidence requirement — tokens carry structured JSON with confidence scores, evidence files, root cause 5-whys.
- Quality floors ratchet (Law 27) — 46 → 28 npm-outdated floor in 30 days; tests 3626 → 3786.
- Onboarding docs can say "run it, the gates will guide you."

**Negative:**
- Significant setup + maintenance cost. 45 hooks is a lot of moving parts.
- Hook failures can be opaque — debug via `.claude-audit.log`.
- Risk of over-enforcement friction — mitigated by "simple task → do it yourself" guidance in CLAUDE.md.
- Gate correctness is itself never audited (self-reflection §8 of 2026-04-18 audit: "I never verified whether gates actually *block* violations, only that they *fire*").

**Neutral:**
- Framework is idiosyncratic to this project; won't port to repos without Claude Code.

## Rollout / Migration Plan

Built incrementally over multiple sessions. Stabilized ~2026-03 with structured JSON validation.

## Verification

- Ratchet metric `HookCount` (in `doc-counts.cjs` — future enhancement): currently ~45.
- `npm run enforcement:check` runs hook health check.
- Every commit produces a `.postflight-done` JSON validated by `reflection-validate.cjs`.
- Known unverified: gate enforcement is asserted, not measured. Action: add gate-bypass detection test that intentionally triggers each gate with a known violation and asserts block occurred.

## References

- Michael Feathers, "Legacy Code" (2004) — characterization tests as quality floor concept.
- Chris Brown, "Ratcheting static analysis" — LeadDev 2022, precursor to Law 27.
- Nygard, "Release It!" — circuit breakers as enforcement pattern, applied here to quality rather than runtime.
- Internal: `memory/feedback_enforcement_hooks.md`, `memory/feedback_dual_gate_validation.md`.
- Internal: `CLAUDE.md` § Enforcement; `docs/law27-ratchet.md`.
