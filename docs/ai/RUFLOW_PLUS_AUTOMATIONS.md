# Ruflow+ Automation Pack

These are the automations worth adding if you want this repo to behave closer to a true orchestration platform.

They are repo-safe because they operate on review, triage, and knowledge capture rather than product runtime.

## 1. CI Failure Sweep

Goal:
- detect new CI failures
- summarize root cause
- propose the smallest safe fix

Frequency:
- hourly on workdays

Output:
- one inbox item
- one short evidence block with failing job, probable cause, and next action

## 2. Architecture Drift Audit

Goal:
- compare repo changes against `ARCHITECTURE.md`
- detect new god files, uncaptured workflows, or doc drift

Frequency:
- daily

Output:
- one inbox item
- drift list with file paths

## 3. Bug Pattern Distillation

Goal:
- scan recent bugfix threads
- convert repeated failures into short reusable patterns

Frequency:
- twice weekly

Output:
- update [docs/ai/RUFLOW_PLUS_LEARNING_RECORD.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_LEARNING_RECORD.md>) instances or linked notes
- one inbox item summarizing the new pattern

## 4. Release Hardening Pass

Goal:
- run a final coordination pass before shipping
- check CI status, obvious risk areas, docs drift, and unresolved review comments

Frequency:
- manual or before release

Output:
- release readiness verdict
- top blockers only

## 5. Skill Evolution Review

Goal:
- inspect repeated manual workflows
- propose new project-local skills or updates to existing ones

Frequency:
- weekly

Output:
- one proposed skill or one refinement to an existing skill

## Why These Five

Together they cover the missing pieces most teams forget:
- background observation
- drift detection
- learning writeback
- pre-release coordination
- improvement of the orchestration layer itself
