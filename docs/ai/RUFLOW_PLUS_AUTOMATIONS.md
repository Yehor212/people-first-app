# Ruflow+ Automation Pack

These are the automations worth adding if you want this repo to behave closer to a true orchestration platform.

They are repo-safe because they operate on review, triage, and knowledge capture rather than product runtime.

For the full ZenFlow integrity architecture, prompts, and evidence contract, see [ZENFLOW_INTEGRITY_AUTOMATION_V2.md](</C:/project/people-first-app/docs/ai/ZENFLOW_INTEGRITY_AUTOMATION_V2.md>).

## ZenFlow Integrity Automation Suite

This suite is the primary recommendation for ZenFlow because it separates quick invariant checks from expensive UI and release checks.

Common defaults:
- environment: `worktree`
- mode: `report-only`
- model: `gpt-5.3-codex`
- reasoning: `high`
- destination: `Triage`
- evidence rule: every status line must include fresh evidence from the current run

### 1. Daily Fast Integrity Sweep

Goal:
- catch architecture drift, CI drift, translation drift, token or color regressions, banned patterns, and hooks/rules drift

Frequency:
- weekdays at a fixed local morning time

Output:
- one inbox item in Triage
- overall verdict
- coverage matrix with confidence and evidence
- grouped findings by root cause
- self-reflection and residual risks

Notes:
- this is the cheapest recurring mode
- it should not overclaim runtime UI passes it did not execute

### 2. Nightly Deep UI Audit

Goal:
- verify buttons, motion, overlays, focus flow, accessibility, responsive behavior, safe areas, and cross-platform UX using runtime evidence when tooling exists

Frequency:
- nightly

Output:
- one inbox item in Triage
- coverage matrix plus representative flow matrix
- grouped findings by root cause
- runtime blockers called out as `UNVERIFIED`

Notes:
- this is the most expensive scheduled mode
- browser and native evidence should outrank static inspection whenever available

### 3. Weekly Architecture & Governance Audit

Goal:
- verify structural alignment between repo reality, docs, stores, backend assumptions, laws, hooks, rules, and workflow governance

Frequency:
- weekly

Output:
- one inbox item in Triage
- architecture and governance verdict
- structural drift findings with evidence and confidence

Notes:
- this is the best place to catch silent drift that normal feature work hides

### 4. Pre-Release Gate Audit

Goal:
- combine the earlier modes and raise severity for unresolved `PARTIAL` and `UNVERIFIED` items before shipping

Frequency:
- manual by default, or scheduled in a paused state for release windows

Output:
- one inbox item in Triage
- release verdict with blockers first
- explicit residual risks even if the verdict is green

Notes:
- keep this paused until a release window or manual trigger
- do not use it as a noisy daily job

## Recommended Default Schedule

Suggested local cadence for the four-mode suite:
- Daily Fast Integrity Sweep: weekdays at 10:00
- Nightly Deep UI Audit: daily at 01:30
- Weekly Architecture & Governance Audit: Monday at 13:00
- Pre-Release Gate Audit: paused by default and enabled before release windows

## Calibration Before Trust

Before relying on the suite, manually dry-run each mode against seeded failures and at least one blocked-tooling scenario.

Recommended seeded cases:
- missing i18n key
- hardcoded color token regression
- touch target smaller than the minimum
- modal or sheet without Android back handling
- motion path without reduced-motion fallback
- silent `.catch(() => {})`
- banned `localStorage` usage
- z-index or overlay collision
- blocked browser or native runtime path

Review the first 3 runs of each active automation for:
- false positives
- missing coverage
- evidence quality
- confidence inflation
- runtime cost and latency
- repeated symptoms that should be clustered better

## Adjacent Ruflow+ Automations

These are still useful for narrower operational workflows around the main integrity suite.

### 5. CI Failure Sweep

Goal:
- detect new CI failures
- summarize root cause
- propose the smallest safe fix

Frequency:
- hourly on workdays

Output:
- one inbox item
- one short evidence block with failing job, probable cause, and next action

### 6. Architecture Drift Audit

Goal:
- compare repo changes against `ARCHITECTURE.md`
- detect new god files, uncaptured workflows, or doc drift

Frequency:
- daily

Output:
- one inbox item
- drift list with file paths

### 7. Bug Pattern Distillation

Goal:
- scan recent bugfix threads
- convert repeated failures into short reusable patterns

Frequency:
- twice weekly

Output:
- update [docs/ai/RUFLOW_PLUS_LEARNING_RECORD.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_LEARNING_RECORD.md>) instances or linked notes
- one inbox item summarizing the new pattern

### 8. Release Hardening Pass

Goal:
- run a final coordination pass before shipping
- check CI status, obvious risk areas, docs drift, and unresolved review comments

Frequency:
- manual or before release

Output:
- release readiness verdict
- top blockers only

### 9. Skill Evolution Review

Goal:
- inspect repeated manual workflows
- propose new project-local skills or updates to existing ones

Frequency:
- weekly

Output:
- one proposed skill or one refinement to an existing skill

## Why This Split Works Better

Together, the integrity suite plus the adjacent automations cover the operational gaps most teams miss:
- fast background observation without pretending it proves runtime UX
- deeper interaction and animation coverage on a separate cadence
- architecture and governance drift detection
- pre-release escalation for unresolved uncertainty
- learning and orchestration improvement loops around the audits
