# ZenFlow Integrity Automation v2

Purpose: give ZenFlow a truthful, layered integrity-audit system for Codex automations.

This is the tracked source of truth for the audit suite. It is intentionally stricter than a generic repo audit because ZenFlow has cross-platform UX constraints, animation rules, i18n parity requirements, architecture drift risks, and repo-specific governance laws.

## Why v2 Exists

The first instinct for this problem is to write one giant prompt and hope it catches everything.
That is not reliable enough for this repo.

Key self-corrections behind v2:
- one super-prompt tends to drift toward shallow checklisting or noisy false confidence
- static evidence and runtime evidence are not equivalent, especially for buttons, animations, focus flow, overlays, safe areas, and Android back behavior
- "check absolutely everything" is not a truthful claim; the real goal is maximum practical coverage plus an explicit map of what remains unknown
- expensive deep UI checks and fast invariant checks must run on different cadences
- findings must be grouped by root cause instead of repeating the same symptom across many files
- each audit surface needs its own confidence score so a static heuristic does not masquerade as a fully proven runtime pass

## Operating Principles

1. Honesty over completeness theater
- If tooling is missing, blocked, or unavailable, say `UNVERIFIED`.
- Do not upgrade an inference into a `PASS` without evidence.

2. Runtime evidence outranks static inference
- For UX and interaction claims, browser/native/runtime evidence is stronger than code inspection.
- Static review is still required, but it must not overclaim.

3. Report-only by default
- The automation audits the repo and produces a verdict.
- It does not edit files, commit changes, push branches, or create PRs unless a later workflow explicitly switches to repair mode.

4. Worktree isolation by default
- Use standalone project automations with a dedicated worktree.
- Keep audit runs isolated from the primary working tree.

5. Root-cause clustering
- Similar failures must be grouped by shared cause.
- The report should not list 20 copies of the same primitive-level bug as 20 unrelated findings.

6. Evidence discipline
- Every line item gets `PASS`, `FAIL`, `PARTIAL`, or `UNVERIFIED`.
- Every line item includes evidence from the current run.
- No evidence means the item cannot be counted as proven.

## Shared Execution Contract

Default configuration for every integrity automation:
- environment: `worktree`
- mode: `report-only`
- model: `gpt-5.3-codex`
- reasoning: `high`
- destination: `Triage`

Mandatory run contract:
- Start with a visible `PRE-FLIGHT ARTIFACT` containing decisions, evidence needs, risks, and the audit plan.
- Read repo truth before judging anything.
- Build an invariant register before the first verdict.
- Keep static and runtime evidence separate.
- Group findings by root cause.
- Include self-reflection and residual risks even on a green verdict.

The `PRE-FLIGHT ARTIFACT` must include:
1. implicit requirements or missing context and how the run will resolve them from repo truth
2. systemic impact and which subsystems or platforms are most likely to hide regressions
3. the top 2 blind spots or failure modes of the audit itself and how the run will reduce them
4. a strict step-by-step plan for the current mode

Allowed status values:
- `PASS`
- `FAIL`
- `PARTIAL`
- `UNVERIFIED`

Confidence contract:
- every top-level audit surface gets `confidence: 0.0-1.0`
- confidence must be lowered when runtime verification is missing
- a static-only pass should never imply the same confidence as a runtime-backed pass

Evidence hierarchy:
1. fresh runtime evidence from this run
2. fresh command output from repo-native checks
3. file or config evidence from repo inspection
4. explicit blocker note for `UNVERIFIED`

## Common Output Schema

Every run must produce:
1. `PRE-FLIGHT ARTIFACT`
2. `Overall verdict: GREEN | YELLOW | RED`
3. `Coverage matrix` with top-level domains, critical subdomains, status, confidence, and evidence
4. `Representative flow matrix` with runtime/static/unverified coverage notes
5. `Findings` ordered by severity and grouped by root cause
6. `5 Whys` for every critical issue or systemic pattern
7. `Self-reflection` describing blind spots, low-confidence areas, and the fastest next checks to raise confidence
8. `Residual risks`
9. `Next actions` split into blockers, high-value fixes, and audit-system improvements

## Representative Flow Matrix

Every deep or release-grade run should check these flows, and every other mode should at least account for them:
- app launch, hydration, and first render
- auth or session bootstrap and restoration
- navigation across all visible tabs
- opening and closing each overlay type: modal, sheet, dialog, dropdown, toast
- primary CTA, secondary CTA, icon-only button, destructive button, loading button, disabled button
- form submit, double-tap prevention, retry path, and cancel path
- empty, loading, error, offline, and degraded states
- locale switch plus at least one RTL flow
- Android hardware back for each modal or sheet class
- desktop wide, desktop narrow, tablet width, mobile standard, and mobile narrow layouts

## Audit Surface Matrix

All modes should consider these surfaces, but each mode assigns different priority:
- architecture drift and doc drift
- CI and quality gates
- design-system integrity and token usage
- buttons and interaction primitives
- motion, animation, and reduced-motion behavior
- accessibility and keyboard parity
- i18n, locale parity, and RTL
- cross-platform parity: web, iOS, Android, desktop
- navigation, overlays, and back-stack behavior
- data, state, persistence, and backend assumptions
- network, offline, and resilience scenarios
- performance and release readiness
- governance, laws, hooks, rules, and auditability
- unknown unknowns discovered during the run

## Automation Suite

### 1. Daily Fast Integrity Sweep

Purpose:
- catch quick regressions in architecture drift, quality gates, translation drift, hardcoded colors, banned patterns, and repo governance

Cadence:
- weekdays

Expected runtime shape:
- fast and mostly static
- should prefer repo-native checks and targeted code/config inspection
- should not pretend to have runtime proof for UI claims it did not execute

Mode-specific emphasis:
- architecture drift
- CI and check scripts
- i18n drift
- hardcoded color regressions
- silent catch and localStorage bans
- hooks, rules, and token workflow drift
- platform config red flags discovered statically

Suggested prompt:

```text
Run a ZenFlow integrity audit in FAST mode for C:\project\people-first-app.

Default mode is REPORT-ONLY. Do not edit files, create patches, stage changes, commit, push, open PRs, or modify automations.

Before substantive work, print a visible PRE-FLIGHT ARTIFACT with:
1. missing context and how you will resolve it from repo truth,
2. systemic impact and likely blind spots,
3. the top 2 audit failure modes in FAST mode,
4. a strict audit plan.

Execution order:
1. Read repo truth first: AGENTS.md, ARCHITECTURE.md, package scripts, CI/preflight docs, .codex/hooks/, key configs, i18n files, and critical entry points.
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
1. PRE-FLIGHT ARTIFACT
2. Overall verdict: GREEN, YELLOW, or RED
3. Coverage matrix with confidence and evidence
4. Findings grouped by root cause
5. 5 Whys for critical issues
6. Self-reflection
7. Residual risks
8. Next actions
```

### 2. Nightly Deep UI Audit

Purpose:
- perform the expensive UX, interaction, animation, accessibility, and responsive checks that a fast daily sweep cannot prove

Cadence:
- nightly

Expected runtime shape:
- browser/runtime-first when tooling exists
- code inspection used as backup, not as a substitute for runtime proof

Mode-specific emphasis:
- buttons and all button-like affordances
- motion, animation, and reduced motion
- focus flow, keyboard parity, and accessibility
- safe areas, z-index layering, overlays, and Android back handling
- responsive behavior and desktop/mobile parity
- representative flows instead of random spot checks

Suggested prompt:

```text
Run a ZenFlow integrity audit in DEEP-UI mode for C:\project\people-first-app.

Default mode is REPORT-ONLY. Do not edit files, create patches, stage changes, commit, push, open PRs, or modify automations.

Before substantive work, print a visible PRE-FLIGHT ARTIFACT with:
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
1. PRE-FLIGHT ARTIFACT
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

Purpose:
- verify that repo structure, stores, docs, laws, hooks, and operational assumptions stay aligned as the app evolves

Cadence:
- weekly

Expected runtime shape:
- architecture and governance focused
- static/declarative checks dominate, but fresh evidence is still mandatory

Mode-specific emphasis:
- orchestrator boundaries and feature drift
- Zustand topology, hydrate bridges, Dexie/Supabase/Firebase assumptions
- doc-count and ARCHITECTURE drift
- laws, hooks, rules, protected files, and workflow tokens
- deletion tracker, sync order, backend schema assumptions, and release governance

Suggested prompt:

```text
Run a ZenFlow integrity audit in ARCHITECTURE mode for C:\project\people-first-app.

Default mode is REPORT-ONLY. Do not edit files, create patches, stage changes, commit, push, open PRs, or modify automations.

Before substantive work, print a visible PRE-FLIGHT ARTIFACT with:
1. missing context and how you will resolve it from repo truth,
2. the subsystems most likely to drift silently,
3. the top 2 architecture-audit blind spots,
4. a strict audit plan.

Execution order:
1. Read repo truth first: AGENTS.md, ARCHITECTURE.md, package scripts, CI/preflight docs, .codex/hooks/, critical store files, storage/backend integration points, and platform configs.
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
1. PRE-FLIGHT ARTIFACT
2. Overall verdict: GREEN, YELLOW, or RED
3. Coverage matrix with confidence and evidence
4. Findings grouped by root cause
5. 5 Whys for critical issues
6. Self-reflection
7. Residual risks
8. Next actions
```

### 4. Pre-Release Gate Audit

Purpose:
- run the strictest integrated audit before a release, merge train, or risky milestone

Cadence:
- manual by default or scheduled in a paused state

Expected runtime shape:
- combines the three earlier modes
- treats unresolved `PARTIAL` and `UNVERIFIED` items as release risks unless explicitly justified

Mode-specific emphasis:
- release blockers
- unresolved confidence gaps
- cross-platform parity
- runtime coverage breadth
- remaining architectural drift or governance holes

Suggested prompt:

```text
Run a ZenFlow integrity audit in RELEASE-GATE mode for C:\project\people-first-app.

Default mode is REPORT-ONLY. Do not edit files, create patches, stage changes, commit, push, open PRs, or modify automations.

Before substantive work, print a visible PRE-FLIGHT ARTIFACT with:
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
1. PRE-FLIGHT ARTIFACT
2. Overall verdict: GREEN, YELLOW, or RED
3. Coverage matrix with confidence and evidence
4. Representative flow matrix
5. Findings grouped by root cause
6. 5 Whys for critical issues
7. Self-reflection
8. Residual risks
9. Next actions with release blockers first
```

## Calibration Checklist

Before trusting the suite, manually dry-run each mode against at least these seeded cases:
- missing i18n key
- hardcoded color token regression
- button hit target below minimum
- modal or sheet without Android back handling
- motion path without reduced-motion fallback
- silent `.catch(() => {})`
- banned `localStorage` usage
- z-index or overlay collision
- blocked browser or native tooling path that should produce `UNVERIFIED`

After the first 3 runs of each scheduled mode, review in Triage:
- false positives
- missing coverage
- evidence quality
- confidence inflation
- runtime cost and latency
- repeated symptoms that should be clustered better

## Recommended Default Schedule

These defaults are intentionally separated by cost and depth:
- Daily Fast Integrity Sweep: weekdays at 10:00 local time
- Nightly Deep UI Audit: daily at 01:30 local time
- Weekly Architecture & Governance Audit: Mondays at 13:00 local time
- Pre-Release Gate Audit: paused by default, enabled manually before release windows

## Important Limits

This suite is designed to be honest about uncertainty.
It should never claim omniscience.

It is acceptable for a strong report to say:
- what was proven
- what is still only inferred
- what could not be verified
- what would raise confidence fastest

That honesty is a feature, not a weakness.
