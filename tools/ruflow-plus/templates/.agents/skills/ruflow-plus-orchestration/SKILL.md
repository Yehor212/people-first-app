---
name: ruflow-plus-orchestration
description: Repo-local orchestration mode for Codex that combines teamlead, swarm discipline, memory capture, and verification into a Ruflow-like workflow without risky runtime changes.
---

# Ruflow+ Orchestration

Use this skill when the user wants:
- Claude Flow or Ruflo style execution
- teamlead orchestration
- swarm-style parallel work
- repeatable multi-step delivery with memory writeback
- deep repo analysis plus implementation, not just brainstorming

Do not use this skill for trivial single-file edits.

## Goals

1. Act like a disciplined coordinator, not a random swarm.
2. Use the smallest team that can safely solve the problem.
3. Prefer existing repo skills over inventing new process.
4. Leave reusable knowledge behind after the run.

## Mandatory Pre-Flight

Before substantial work:
- identify missing constraints
- name likely failure modes
- decide whether solo, guided, or Ruflow+ mode is justified
- define evidence you expect to collect

If the task is external or time-sensitive, verify with authoritative sources first.

## Operating Modes

### Solo

Use when:
- scope is narrow
- write set is small
- next step is obvious

### Guided

Use when:
- 4-10 files are likely
- research and implementation both matter
- no parallelism is required

### Ruflow+

Use when:
- multiple domains are involved
- audit + implementation are both required
- memory writeback would help future runs
- specialized review is needed before completion

Default Ruflow+ shape:
- one coordinator
- up to three specialists
- hierarchical coordination
- verification before completion
- learning record at the end

## Coordination Rules

1. Coordinator owns:
- scope
- ordering
- integration
- final verdict

2. Specialists own disjoint responsibilities:
- research
- implementation
- review
- memory distillation

3. Anti-drift defaults:
- prefer hierarchical over mesh
- keep teams small
- checkpoint often
- tighten the write set before editing

## Required Skill Composition

When available, combine these skills conceptually:
- `teamlead`
- `swarm-orchestration` or `swarm-advanced`
- `superpowers:writing-plans`
- `superpowers:dispatching-parallel-agents`
- `superpowers:verification-before-completion`
- `reasoningbank-intelligence` or `reasoningbank-agentdb`

If some are not accessible in the current runtime, emulate their behavior manually.

## Evidence Rules

Every meaningful pass should leave:
- source evidence for external claims
- file evidence for edits
- verification evidence for checks
- learning evidence in the project memory note or automation memory

If verification cannot run, say exactly what blocked it.

## Learning Writeback

After any non-trivial task, write a short learning record with:
- task type
- what signal routed the task
- what worked
- what failed
- what should be reused next time

Use [docs/ai/RUFLOW_PLUS_LEARNING_RECORD.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_LEARNING_RECORD.md>) as the template.

## Completion Standard

Do not call the work complete until:
- the coordinator has integrated the result
- obvious regressions were checked
- unresolved risks are named
- the next operator can reuse the lesson without re-discovering it
