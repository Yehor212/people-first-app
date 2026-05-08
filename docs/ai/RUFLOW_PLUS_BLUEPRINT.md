# Ruflow+ Blueprint For ZenFlow

Purpose: give this repo a Ruflow-like orchestration layer and head-agent teamlead protocol using Codex-native primitives, project-local skills, explicit memory loops, and verification gates, without adding risky runtime dependencies to the product app.

This is the tracked source of truth for the main agent's teamlead behavior. Local `.Codex/agents/` prompts and `.agents/skills/` files are generated working copies; keep them aligned through `tools/ruflow-plus/templates/**` and `npm run ai:ruflow-plus:check`.

## What This Tries To Emulate

Ruflo positions itself as a multi-agent orchestration platform with:
- specialized agents
- swarm coordination
- persistent/shared memory
- learning loops
- routing and anti-drift controls
- background workers and repeated workflows

Primary external references:
- [Ruflo README](https://github.com/ruvnet/ruflo/blob/main/README.md)
- [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)
- [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-codex-in-chatgpt)
- [Codex use cases](https://developers.openai.com/codex/use-cases)

## Self-Reflection

This blueprint deliberately does not copy Ruflo's marketing claims or invent hidden platform features.

What Codex already gives us:
- multiple agents in parallel
- skills
- automations
- isolated worktrees
- local/cloud handoff

What this repo already exposes in the active session:
- `teamlead`
- `swarm-orchestration`
- `swarm-advanced`
- `superpowers:dispatching-parallel-agents`
- `superpowers:subagent-driven-development`
- `reasoningbank-intelligence`
- `reasoningbank-agentdb`
- `agentdb-learning`
- `agentdb-memory-patterns`
- `verification-before-completion`

What was missing at the repo level:
- one opinionated entrypoint that combines those pieces into a single repeatable mode
- a repo-local anti-drift contract
- a memory/learning record format
- a safe escalation ladder for when to stay local vs orchestrate multiple agents

## Design Principles

1. Runtime safety first
- No changes to the shipped React/Capacitor app are required for orchestration.
- The orchestration layer lives in docs, skills, prompts, and templates.

2. Anti-drift by default
- Hierarchical coordination beats unconstrained swarms for production app work.
- Small specialist groups beat large generic swarms.

3. Evidence over vibes
- Every major pass should leave an artifact: commands, diffs, checks, or a learning note.

4. Learning must be explicit
- "Self-learning" is implemented as capture -> judge -> distill -> reuse.
- No fake claim that Codex silently self-trains.

5. Visible reasoning artifact, private chain-of-thought
- Substantial work must produce a visible, evidence-backed pre-flight artifact.
- Do not require or expose raw hidden chain-of-thought. The artifact must summarize decisions, evidence, risks, and verification in reviewable form.

## Ruflo Feature Mapping

| Ruflo idea | Codex / repo-native equivalent | Decision |
| --- | --- | --- |
| Specialized agents | Codex agents + project-local role prompts + existing skills | Supported |
| Swarm orchestration | `teamlead` + `swarm-*` + `dispatching-parallel-agents` | Supported |
| Shared memory | reasoningbank/agentdb skills + learning record template | Supported via workflow |
| Learning loop | explicit post-task capture + replay rules | Supported via workflow |
| Anti-drift coordination | hierarchical coordinator + verification gates | Supported |
| Background work | Codex automations | Supported |
| Plugin packaging | Codex plugins exist officially, but plugin manifest format was not added here to avoid guessing or inventing unsupported repo metadata | Deferred safely |
| 100+ built-in roles | Not a guaranteed Codex built-in | Emulated with targeted role prompts |

## Ruflow+ Mode For This Repo

Default operating mode:
- topology: hierarchical
- coordinator: exactly one
- max concurrent workers: 3 for medium work, 5 for large work
- verification: mandatory before completion
- memory writeback: mandatory for any bug, architectural decision, or reusable pattern
- install recommendations: allowed only after checking current availability, concrete benefit, risk, and whether the tool is required or optional

Recommended role set:
- `coordinator`: owns scope, sequencing, integration, and stop/go decisions
- `researcher`: gathers codebase and web evidence before changes
- `implementer`: writes bounded patches in a narrow file set
- `reviewer`: checks regressions, missing tests, and rule violations
- `memory-keeper`: distills reusable patterns and updates the learning log

Coordinator responsibilities:
- translate vague user requests into actual goal, success criteria, hidden requirements, affected platforms, affected domains, and out-of-scope boundaries
- think beyond the literal request for ZenFlow-specific risks: Web/iOS/Android/Desktop parity, safe areas, Android back handling, i18n/RTL, offline-first behavior, Dexie/Zustand/Supabase sync, Firebase/Sentry, accessibility, motion comfort, performance, security, CI, and rollback
- prevent over-orchestration: simple 1-3 file tasks stay solo unless evidence shows hidden risk
- reject specialist output that lacks evidence, verification, platform/domain impact, unresolved-risk accounting, or a final `GO / STOP / ASK`

Inheritance rule:
- every specialist inherits the same pre-flight contract: evidence, failure modes, platform/domain impact scan, verification plan, and explicit `GO / STOP / ASK`
- if UI, motion, layout, or styling is touched, every specialist also inherits the visual-audit matrix: hierarchy, contrast/focus, target size, reflow, motion/transparency, state coverage, and proof expectations

## Visible Pre-Flight Artifact

Every substantial pass must create a visible `PRE-FLIGHT ARTIFACT` before implementation. It must contain:

- implicit requirements: missing constraints, inferred needs, platform/design/security/test implications
- systemic impact: files, stores, hooks, schemas, CI, global state, user flows, and rollback surface
- failure modes: top two task-specific risks, root-cause hypothesis, prevention, and proof to collect
- step plan: strict sequence with source evidence, verification method, and rollback path
- evidence: repo file paths, command outputs, checklists, screenshots/traces for UI, or official links for external/current facts
- verdict: `GO`, `STOP`, or `ASK`; no substantial implementation starts without `GO`

Raw hidden chain-of-thought is not a deliverable. The artifact is the reviewable contract.

## Anti-Drift Contract

Use these defaults unless there is a strong reason not to:

1. Start with a written plan
- Required for any task that spans multiple domains or more than 3 files.
- Default operator format: [docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md](PREFLIGHT_OPERATOR_TEMPLATE.md)
- Repo-touching work defaults to `L2` minimum. Cross-platform, stateful, prompt/config, sync/auth, CI/build, or 4+ file work defaults to `L3`. Governance/law/orchestration changes default to `L4`.

2. Keep write scopes disjoint
- Parallel workers may not share the same write set.

3. Research before edits
- Research is local-first, then official web/docs when facts are time-sensitive or external.
- Self-reflection does not replace external verification. For external facts, use primary or official sources before acting.

4. Scan platform and domain impact before implementation
- If the task can touch product behavior, explicitly check Web, iOS, Android, Desktop, and CI relevance.
- For large or stateful work, explicitly consider UI, state, storage, sync, auth, i18n, analytics, performance, accessibility, and security.

5. Treat visual audit as a real layer, not taste
- If UI is involved, read [docs/visual-aesthetic.md](</C:/project/people-first-app/docs/visual-aesthetic.md>) and inspect [scripts/check-visual-guards.ts](</C:/project/people-first-app/scripts/check-visual-guards.ts>).
- Require explicit coverage for hierarchy, focus, contrast, touch targets, responsive reflow, reduced motion, blur/transparency fallbacks, and user-visible states.
- Prefer screenshot, trace, or inspector evidence over opinion-only claims.

6. Apply the modern practice matrix
- Code: follow existing React 18, TypeScript, Vite, Tailwind, and shadcn/ui patterns; avoid broad rewrites; use structured APIs over string hacks.
- Design/UI: no visual changes without proof; verify hierarchy, spacing, focus, touch targets, responsive reflow, dark/light, reduced motion, blur fallback, and loading/empty/error/offline states.
- Animation: motion must communicate state, respect reduced-motion, and stay performant on mobile.
- Security: run Snyk Code for new first-party JS/TS code when supported; fix introduced findings and rescan.
- Performance: measure before adding complexity; memoization is optimization, not correctness.
- Tooling: recommend installs only after checking current availability, concrete benefit, risk, and whether the tool is required or optional.

7. Verify before claiming success
- Prefer fresh command output or a precise checklist of what could not be run.
- Missing evidence is a blocker, not a footnote.

8. Gate every pass with a verdict
- No substantial implementation starts until the pass reaches `GO`.
- `STOP` and `ASK` are valid outcomes and should be used early when evidence is weak.

9. Distill after success or failure
- Every meaningful run should update memory with what worked, what failed, and what should route differently next time.

## Learning Loop

Ruflow+ uses a lightweight loop instead of pretending the platform self-trains:

1. Retrieve
- Check existing repo memory, automation memory, prior ADRs, and incident notes.

2. Judge
- Was the approach effective, safe, and reusable?

3. Distill
- Convert findings into one short pattern, guardrail, or routing heuristic.

4. Consolidate
- Store the distilled rule in a memory note.

5. Reuse
- On the next similar task, prefer the stored pattern before free-form exploration.

## When To Use Ruflow+ Mode

Use it for:
- architectural refactors
- bug clusters across multiple subsystems
- repo audits
- CI stabilization
- release hardening
- repeated operational workflows

Do not use it for:
- trivial single-file edits
- quick text rewrites
- simple answers with no repo impact

## What Makes This Better Than A Direct Ruflo Clone

This repo has constraints Ruflo does not know:
- strict AGENTS.md rules
- preflight and reflection gates
- mobile parity requirements
- repo-specific CI laws
- Obsidian knowledge capture expectations

So Ruflow+ is intentionally stronger in these areas:
- repo-specific safety
- explicit evidence discipline
- app-specific anti-regression focus
- smaller, higher-signal specialist teams

## Suggested Operating Ladder

Level 0: Solo mode
- one agent
- no delegation
- use for 1-3 files

Level 1: Guided mode
- one agent + explicit plan + verification
- use for medium changes

Level 2: Ruflow+ mode
- coordinator + 2-3 specialists + memory writeback
- use for multi-domain work

Level 3: Release hardening mode
- coordinator + researcher + implementer + reviewer + memory-keeper + automation follow-up
- use before merges, releases, and risky migrations

## Evidence Checklist

Before calling a run complete, capture at least one item from each applicable category:
- file evidence: changed files and purpose
- command evidence: lint/test/type/build output, or explicit note that shell execution was unavailable
- research evidence: source links for external claims
- memory evidence: what was learned and where it was stored

## Files Added By This Blueprint

- [docs/ai/RUFLOW_PLUS_BLUEPRINT.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_BLUEPRINT.md>)
- [.agents/skills/ruflow-plus-orchestration/SKILL.md](</C:/project/people-first-app/.agents/skills/ruflow-plus-orchestration/SKILL.md>)
- [.Codex/ruflow-plus.config.example.toml](</C:/project/people-first-app/.Codex/ruflow-plus.config.example.toml>)
- [docs/ai/RUFLOW_PLUS_LEARNING_RECORD.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_LEARNING_RECORD.md>)
- [docs/ai/RUFLOW_PLUS_ROLE_PROMPTS.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_ROLE_PROMPTS.md>)
- [docs/ai/RUFLOW_PLUS_SKILL_MIRROR.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_SKILL_MIRROR.md>)
- [docs/ai/RUFLOW_PLUS_SETUP.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_SETUP.md>)
- [docs/ai/RUFLOW_PLUS_AUTOMATION_PROMPTS.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_AUTOMATION_PROMPTS.md>)
- [tools/ruflow-plus/templates](</C:/project/people-first-app/tools/ruflow-plus/templates>)
- [scripts/sync-ruflow-plus.mjs](</C:/project/people-first-app/scripts/sync-ruflow-plus.mjs>)

## Practical Next Step

When you want this mode, ask for:
- "Use Ruflow+ mode"
- "Run this as coordinator plus reviewer"
- "Do a Ruflow+ pass with learning writeback"

## Repo Integration Note

In this repo, `.Codex/` and `.agents/` are currently local-first. On this machine, git ignore rules catch them, which is useful for local experimentation, but it means the tracked source of truth must live under `docs/ai/`.

See [RUFLOW_PLUS_REPO_INTEGRATION.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_REPO_INTEGRATION.md>) for the tracked reference of local env vars, role prompts, and sharing guidance.
See [RUFLOW_PLUS_ROLE_PROMPTS.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_ROLE_PROMPTS.md>) and [RUFLOW_PLUS_SKILL_MIRROR.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_SKILL_MIRROR.md>) for tracked mirrors of the local ignored files.
See [RUFLOW_PLUS_SETUP.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_SETUP.md>) for the reproducible bootstrap path and [RUFLOW_PLUS_AUTOMATION_PROMPTS.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_AUTOMATION_PROMPTS.md>) for ready automation prompts.

## Current Limits

This layer is intentionally honest about what is and is not automated today:

- the docs and skills are real and reusable
- the role prompts are real local working copies
- the `.Codex/config.toml` additions currently expose project-local shell environment defaults
- those env vars are not, by themselves, a hidden built-in Codex orchestration engine

In practice, the actual behavior comes from:
- the skill instructions
- the role prompts
- the tracked docs
- the operator choosing to use Ruflow+ mode
- the sync/bootstrap path that materializes local working copies from tracked templates
