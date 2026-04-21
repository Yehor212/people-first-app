# Ruflow+ Automation Prompts

These are concrete prompt drafts for Codex Automations so the automation layer is not just an idea list.

Use them as starting points when creating scheduled workflows in Codex.

## 1. CI Failure Sweep

Suggested title:
- `CI failure sweep`

Prompt:

```text
Inspect the latest CI failures for this repository. Identify the failing job, the likely root cause, and the smallest safe next action. Prefer evidence from logs and changed files over speculation. If there is no new failure, summarize the last known failure state briefly. Always open an inbox item.
```

## 2. Architecture Drift Audit

Suggested title:
- `Architecture drift audit`

Prompt:

```text
Compare the current repository state against ARCHITECTURE.md and AGENTS.md. Identify doc drift, newly oversized files, missing workflow documentation, or newly repeated patterns that should be captured as a skill, ADR, or incident. Keep findings specific and evidence-based. Always open an inbox item.
```

## 3. Bug Pattern Distillation

Suggested title:
- `Bug pattern distillation`

Prompt:

```text
Review recent bugfix-related work and distill one or two reusable engineering patterns. Focus on what changed routing, debugging strategy, or verification strategy. Update the learning record or propose a concise new pattern note. Always open an inbox item.
```

## 4. Release Hardening Pass

Suggested title:
- `Release hardening pass`

Prompt:

```text
Perform a release-readiness audit for this repository. Check current CI state, unresolved risk areas, docs drift, and any obvious gaps that would make a release unsafe or incomplete. Prioritize blockers over general commentary. Always open an inbox item.
```

## 5. Skill Evolution Review

Suggested title:
- `Skill evolution review`

Prompt:

```text
Inspect repeated manual workflows in this repository and propose one concrete improvement to the orchestration layer: a new skill, a refinement to an existing skill, a new verification step, or a new automation prompt. Keep the proposal narrow and implementable. Always open an inbox item.
```
