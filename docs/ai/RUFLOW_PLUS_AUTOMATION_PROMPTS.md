# Ruflow+ Automation Prompts

These are concrete prompt drafts for Codex Automations so the automation layer is not just an idea list.

Use them as starting points when creating scheduled workflows in Codex.

For the ZenFlow integrity suite, the tracked source of truth now lives in [ZENFLOW_INTEGRITY_AUTOMATION_V2.md](</C:/project/people-first-app/docs/ai/ZENFLOW_INTEGRITY_AUTOMATION_V2.md>).

## ZenFlow Integrity Suite (v2)

### 1. Daily Fast Integrity Sweep

Suggested title:
- `ZenFlow fast integrity`

Prompt:

```text
Run a ZenFlow integrity audit in FAST mode for this repository.

Default mode is REPORT-ONLY. Do not edit files, create patches, stage changes, commit, push, open PRs, or modify automations.

Before substantive work, print a visible <thinking> block with:
1. missing context and how you will resolve it from repo truth,
2. systemic impact and likely blind spots,
3. the top 2 audit failure modes in FAST mode,
4. a strict audit plan.

Execution order:
1. Read repo truth first: AGENTS.md, ARCHITECTURE.md, package scripts, CI/preflight docs, .Codex/hooks/, .Codex/rules/, key configs, i18n files, and critical entry points.
2. Build an invariant register before judging anything.
3. Run the strongest fresh non-destructive repo-native checks available.
4. Inspect code and config for static risks that those checks do not prove.
5. Produce a coverage matrix with status, confidence, and evidence for every major surface you touched.

FAST mode priorities:
- architecture drift and doc drift
- CI and quality-gate drift
- i18n parity and key drift
- hardcoded colors and design-token violations
- banned localStorage usage and silent .catch(() => {})
- hooks/rules/token protocol drift
- obvious platform/config risks discovered statically

Rules:
- runtime evidence outranks static inference
- no evidence = FAIL for that line item
- if a runtime-only claim cannot be proven in FAST mode, mark PARTIAL or UNVERIFIED instead of overclaiming
- group findings by root cause
- include self-reflection and residual risks

Output:
1. <thinking>
2. Overall verdict: GREEN, YELLOW, or RED
3. Coverage matrix with confidence and evidence
4. Findings grouped by root cause
5. 5 Whys for critical issues
6. Self-reflection
7. Residual risks
8. Next actions
```

### 2. Nightly Deep UI Audit

Suggested title:
- `ZenFlow deep UI audit`

Prompt:

```text
Run a ZenFlow integrity audit in DEEP-UI mode for this repository.

Default mode is REPORT-ONLY. Do not edit files, create patches, stage changes, commit, push, open PRs, or modify automations.

Before substantive work, print a visible <thinking> block with:
1. missing context and how you will resolve it from repo truth,
2. the subsystems and platforms most likely to hide UI regressions,
3. the top 2 audit blind spots in DEEP-UI mode,
4. a strict runtime-first audit plan.

Execution order:
1. Read repo truth: AGENTS.md, ARCHITECTURE.md, UI constraints, hooks/rules, platform configs, i18n files, and critical UI/state/navigation entry points.
2. Build an invariant register and a representative flow matrix before rendering verdicts.
3. Use the strongest available runtime tooling first for browser, screenshots, and platform evidence.
4. Use static audit to explain uncovered risks or blocked paths.
5. Report every major UI surface with status, confidence, and evidence.

DEEP-UI mode must cover:
- every button-like element class, not just literal <button> tags
- touch target size, state visibility, keyboard activation, accessible names, loading/disabled semantics, duplicate-submit protection, safe-area collisions, and overlay clipping
- modal, sheet, dialog, toast, dropdown, and navigation transitions
- reduced-motion behavior, interruptibility, mount/unmount cleanup, layout-thrashing risks, transform/opacity preference, and blur fallback consistency
- accessibility, focus trap/restore, semantic roles, keyboard flow, contrast risks, and desktop input parity
- responsive checks at desktop wide, desktop narrow, tablet width, mobile standard, and mobile narrow sizes
- Android hardware back for every modal/sheet class when Android tooling exists
- locale switch and at least one RTL flow

Rules:
- runtime evidence > static inference
- if browser/native tooling is unavailable, mark the blocked runtime path UNVERIFIED and explain the blocker
- no evidence = FAIL for that line item
- group findings by root cause
- include self-reflection and residual risks even on GREEN

Output:
1. <thinking>
2. Overall verdict: GREEN, YELLOW, or RED
3. Coverage matrix with confidence and evidence
4. Representative flow matrix
5. Findings grouped by root cause
6. 5 Whys for critical issues
7. Self-reflection
8. Residual risks
9. Next actions
```

### 3. Weekly Architecture & Governance Audit

Suggested title:
- `ZenFlow architecture audit`

Prompt:

```text
Run a ZenFlow integrity audit in ARCHITECTURE mode for this repository.

Default mode is REPORT-ONLY. Do not edit files, create patches, stage changes, commit, push, open PRs, or modify automations.

Before substantive work, print a visible <thinking> block with:
1. missing context and how you will resolve it from repo truth,
2. the subsystems most likely to drift silently,
3. the top 2 architecture-audit blind spots,
4. a strict audit plan.

Execution order:
1. Read repo truth first: AGENTS.md, ARCHITECTURE.md, package scripts, CI/preflight docs, .Codex/hooks/, .Codex/rules/, critical store files, storage/backend integration points, and platform configs.
2. Build an invariant register before the first verdict.
3. Run the strongest fresh non-destructive checks available.
4. Inspect code, docs, and config for structural drift and governance gaps.
5. Produce a coverage matrix with status, confidence, and evidence.

ARCHITECTURE mode priorities:
- orchestrator and tab boundaries
- Zustand stores, hydrate bridges, Dexie persistence, and state topology
- Supabase, Firebase, and backend assumptions including signup-critical functions and schema hazards
- doc-count drift, ARCHITECTURE drift, and repeated patterns that should become docs, ADRs, or skills
- hooks/rules/token protocol drift and protected-file governance
- deletion tracker permanence, sync-order rules, and release-safety assumptions

Rules:
- no evidence = FAIL for that line item
- if a claim depends on runtime behavior you could not execute, mark PARTIAL or UNVERIFIED
- group findings by root cause
- include self-reflection and residual risks

Output:
1. <thinking>
2. Overall verdict: GREEN, YELLOW, or RED
3. Coverage matrix with confidence and evidence
4. Findings grouped by root cause
5. 5 Whys for critical issues
6. Self-reflection
7. Residual risks
8. Next actions
```

### 4. Pre-Release Gate Audit

Suggested title:
- `ZenFlow release gate`

Prompt:

```text
Run a ZenFlow integrity audit in RELEASE-GATE mode for this repository.

Default mode is REPORT-ONLY. Do not edit files, create patches, stage changes, commit, push, open PRs, or modify automations.

Before substantive work, print a visible <thinking> block with:
1. missing context and how you will resolve it from repo truth,
2. the release-critical surfaces most likely to hide regressions,
3. the top 2 release-gate blind spots,
4. a strict integrated audit plan.

Execution order:
1. Read repo truth first: AGENTS.md, ARCHITECTURE.md, package scripts, CI/preflight docs, hooks/rules, platform configs, i18n files, storage/backend integration points, and critical UI/state/navigation entry points.
2. Build an invariant register and representative flow matrix before verdicts.
3. Run the strongest fresh non-destructive checks available.
4. Use runtime/browser/native evidence wherever tooling exists.
5. Use static audit to explain remaining risks or blockers.
6. Treat unresolved PARTIAL/UNVERIFIED items as release risks unless a narrow justification is explicit.

RELEASE-GATE mode must cover:
- architecture and doc drift
- CI and quality gates
- buttons, animations, overlays, safe areas, and accessibility
- responsive and cross-platform parity for web, iOS, Android, and desktop when tooling exists
- i18n, RTL, and truncation risks
- data, state, backend, offline, resilience, and auth/session risks
- governance, laws, rules, hooks, and protected-file integrity
- unknown unknowns discovered during the run

Rules:
- runtime evidence > static inference
- unresolved runtime blockers must be shown, not hidden
- no evidence = FAIL for that line item
- group findings by root cause
- include self-reflection and residual risks even on GREEN

Output:
1. <thinking>
2. Overall verdict: GREEN, YELLOW, or RED
3. Coverage matrix with confidence and evidence
4. Representative flow matrix
5. Findings grouped by root cause
6. 5 Whys for critical issues
7. Self-reflection
8. Residual risks
9. Next actions with release blockers first
```

## Adjacent Automation Prompts

These remain useful when you want narrower workflows around the integrity suite rather than the full layered audit.

## 5. CI Failure Sweep

Suggested title:
- `CI failure sweep`

Prompt:

```text
Inspect the latest CI failures for this repository. Identify the failing job, the likely root cause, and the smallest safe next action. Prefer evidence from logs and changed files over speculation. If there is no new failure, summarize the last known failure state briefly. Always open an inbox item.
```

## 6. Architecture Drift Audit

Suggested title:
- `Architecture drift audit`

Prompt:

```text
Compare the current repository state against ARCHITECTURE.md and AGENTS.md. Identify doc drift, newly oversized files, missing workflow documentation, or newly repeated patterns that should be captured as a skill, ADR, or incident. Keep findings specific and evidence-based. Always open an inbox item.
```

## 7. Bug Pattern Distillation

Suggested title:
- `Bug pattern distillation`

Prompt:

```text
Review recent bugfix-related work and distill one or two reusable engineering patterns. Focus on what changed routing, debugging strategy, or verification strategy. Update the learning record or propose a concise new pattern note. Always open an inbox item.
```

## 8. Release Hardening Pass

Suggested title:
- `Release hardening pass`

Prompt:

```text
Perform a release-readiness audit for this repository. Check current CI state, unresolved risk areas, docs drift, and any obvious gaps that would make a release unsafe or incomplete. Prioritize blockers over general commentary. Always open an inbox item.
```

## 9. Skill Evolution Review

Suggested title:
- `Skill evolution review`

Prompt:

```text
Inspect repeated manual workflows in this repository and propose one concrete improvement to the orchestration layer: a new skill, a refinement to an existing skill, a new verification step, or a new automation prompt. Keep the proposal narrow and implementable. Always open an inbox item.
```
