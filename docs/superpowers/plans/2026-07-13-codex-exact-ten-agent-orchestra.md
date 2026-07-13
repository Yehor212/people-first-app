# Codex Exact-Ten Agent Orchestra Implementation Plan

> **For Codex:** Execute this plan on `main` in reviewable batches. Preserve the unrelated Settings work already present in the working tree. Apply test-first development to every checker, generator, or evidence-validator behavior.

**Goal:** Replace the false-green Claude/Ruflow role mesh with one canonical, Codex-native set of exactly ten project custom roles whose structure is deterministic, whose permissions are not self-attested, and whose semantic or human claims remain bounded by independently checkable evidence.

**Architecture:** A hand-reviewed JSON registry is the only role-prompt source. A Node generator validates it and renders `.codex/config.toml`, ten `.codex/agents/*.toml` profiles, and one operational reference. Deterministic CI proves only existence, identity, schema, generation drift, scenario coverage, and artifact hashes. Semantic outputs, runtime permissions, and human acceptance use separate statuses and receipts; none can be promoted to `PASS` by text inside an agent answer.

**Technology:** Node.js ESM and built-ins, Vitest, JSON, TOML generated as deterministic text, existing npm/CI/RAG/governance infrastructure. No new runtime dependency and no application data.

## Evidence and design decisions

- Fresh baseline on 2026-07-12: the registry, evaluator, `.codex/config.toml`, and all ten profiles are absent, while the five legacy governance checks used by the repository return success.
- `scripts/sync-ruflow-plus.mjs:125-154` skips missing targets in check mode; `scripts/check-subagent-teamlead-governance.mjs:7-46` substitutes templates for absent live files. These are fail-open root causes.
- Official Codex project agents live in `.codex/agents/*.toml`; TOML `name` is runtime identity. Built-in agents still coexist, so the invariant is exactly ten **project custom roles**, not ten total runtime agents.
- A profile's `sandbox_mode` is an intent, not proof of effective permissions, because parent/runtime policy may override it. Permission status therefore remains `UNVERIFIED` until an external launch probe records the effective surface.
- OpenAI eval guidance requires versioned prompts, representative and negative fixtures, captured outputs/traces, deterministic and rubric checks, and continuous evaluation. OWASP/NIST require least privilege, trust separation, adversarial testing, and independent review proportional to risk.
- W3C and WHO guidance means neither one participant nor an LLM council can establish broad user preference, accessibility acceptance, cultural acceptance, or mental-health safety. The profiles must escalate and scope such claims.
- The existing Dopamine/ADHD implementation is only one negative feature-existence scenario. The governance defect is self-approval and fail-open evidence, not those product labels.

## Task 1: Lock the false-green behavior with failing tests

**Files:**

- Create: `scripts/__tests__/persistent-agent-orchestra-registry.test.mjs`
- Create: `scripts/__tests__/persistent-agent-orchestra-evidence.test.mjs`

**Steps:**

1. Write registry tests that import the planned core module and use real temporary directories. Cover missing registry, 9/11 roles, duplicate slot/ID/runtime name, missing role 10, extra profile, missing generated file, modified TOML, invalid exact-calendar date, stale normative source, and a generated file edited by hand.
2. Write evidence tests for the reproduced candidate bypasses: exact `trusted` enum, impossible dates, agent-authored `HUMAN_REVIEWED`, agent-authored permission PASS, generic duplicate answers, fenced JSON, unsupported locale generalization, high/critical risk marked resolved without an external receipt, and completed handoff without a receipt.
3. Run `npx vitest run scripts/__tests__/persistent-agent-orchestra-registry.test.mjs scripts/__tests__/persistent-agent-orchestra-evidence.test.mjs --no-file-parallelism --maxWorkers=1` and retain the expected module-not-found/failing assertions as RED evidence.

## Task 2: Implement the canonical registry core and deterministic generator

**Files:**

- Create: `config/persistent-agent-orchestra.json`
- Create: `config/persistent-agent-orchestra.source-waivers.json`
- Create: `scripts/persistent-agent-orchestra/registry-core.mjs`
- Create: `scripts/sync-persistent-agent-orchestra.mjs`
- Generate: `.codex/config.toml`
- Generate: `.codex/agents/01-coordinator-teamlead.toml`
- Generate: `.codex/agents/02-psychology-human-factors-emotional-safety.toml`
- Generate: `.codex/agents/03-logic-causality-state-coherence.toml`
- Generate: `.codex/agents/04-interaction-accessibility-readability-localization-culture.toml`
- Generate: `.codex/agents/05-technical-architecture-data-cross-platform.toml`
- Generate: `.codex/agents/06-security-privacy-agent-trust.toml`
- Generate: `.codex/agents/07-performance-reliability-operations.toml`
- Generate: `.codex/agents/08-qa-evidence-release-verification.toml`
- Generate: `.codex/agents/09-product-discovery-visual-craft-experience-quality.toml`
- Generate: `.codex/agents/10-independent-blind-spot-sentinel.toml`
- Generate: `docs/ai/PERSISTENT_AGENT_ORCHESTRA.md`

**Steps:**

1. Define universal trust, evidence, output, activation, termination, human-escalation, and conflict rules once in the registry.
2. Define ten non-overlapping role missions with explicit ownership, non-ownership, activation triggers, required counter-hypotheses, failure modes, hard stops, platform/domain impact, and role-specific eval IDs.
3. Give every critic a read-only profile intent and no connector/tool expansion. Do not hard-code a model. Set project concurrency to root plus three specialists and depth one.
4. Make `--check` fail on any missing canonical input, any absent/extra project profile, any byte drift, and any stale normative source without a valid human-approved waiver. Empty waivers are valid; agent-created approvals are not.
5. Generate artifacts with `node scripts/sync-persistent-agent-orchestra.mjs --write`, then rerun the registry test GREEN and `node scripts/sync-persistent-agent-orchestra.mjs --check` GREEN.

## Task 3: Separate structural, semantic, runtime, and human evidence

**Files:**

- Create: `config/persistent-agent-orchestra.evals.json`
- Create: `config/persistent-agent-orchestra.eval-baseline.json`
- Create: `scripts/persistent-agent-orchestra/eval-core.mjs`
- Create: `scripts/run-persistent-agent-orchestra-evals.mjs`
- Create: `scripts/validate-persistent-agent-orchestra-eval-report.mjs`
- Create: `docs/ai/PERSISTENT_AGENT_ORCHESTRA_EVAL_PROTOCOL.md`

**Steps:**

1. Add at least 32 synthetic, isolated scenarios across explicit, implicit, contextual, edge, multilingual, prompt-conflict, tool-poisoning, duplicate-answer, feature-existence, and negative-control categories. Include every role and every hard-stop family.
2. Generate a runner-owned preparation receipt bound to SHA-256 hashes of the registry, profiles, fixtures, protocol, git commit, runtime version, exact scenario IDs, and raw-output files. Never copy permission or human-review claims from candidate output into this receipt.
3. Accept only plain JSON for semantic reports. Validate current hashes, all required scenarios, unique attempts, raw-output hashes, registry role identity, and deterministic forbidden outcomes.
4. Keep machine statuses distinct: `STRUCTURAL_PASS`, `SEMANTIC_UNVERIFIED`, `RUNTIME_UNVERIFIED`, and `HUMAN_UNVERIFIED`. Local strings cannot promote the last three. A future externally verified receipt may be referenced, but local validation must describe its authentication boundary.
5. Make high/critical open risk, locale acceptance, accessibility conformance, user delight, clinical safety, completed handoff, or resolved finding fail closed when the required external evidence is absent.
6. Rerun the adversarial evidence tests GREEN. Validate the tracked baseline as an honest all-`UNVERIFIED` starting point, not a fabricated semantic pass.

## Task 4: Wire exact-ten enforcement before retiring legacy sources

**Files:**

- Modify: `package.json`
- Modify: `scripts/check-agent-context.mjs`
- Modify: `scripts/check-subagent-teamlead-governance.mjs`
- Modify: `scripts/check-enforcement-health.ts`
- Modify: `scripts/check-ratchet.ts`
- Modify: `scripts/rag/corpus-manifest.json`
- Modify: `tools/zenflow-context/server.mjs`
- Modify: `.github/workflows/drift-checks.yml`
- Modify: `.github/CODEOWNERS`
- Modify: `.codex/hooks/skill-router-gate.cjs`
- Modify: `.codex/hooks.json` only if a tested Codex-native protected/test-first gate is added
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md` only to keep its required thin bridge and state that it is not an active role source
- Modify: `docs/ai/AGENT_CHANGE_GOVERNANCE.md`
- Modify: `docs/ai/AGENT_CONTEXT_PERSISTENCE.md`
- Modify: `docs/ai/TEST_FIRST_AGENT_POLICY.md`
- Modify: `docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md` only where the active Codex gate path changes
- Modify: `docs/ai/SUBAGENT_TEAMLEAD_RESEARCH_AUDIT.md`
- Modify: `ARCHITECTURE.md` only outside generated count blocks and without disturbing the current Settings edits

**Steps:**

1. Add `ai:agent-orchestra:sync`, `check:agent-orchestra`, `ai:agent-orchestra:eval:prepare`, and `check:agent-orchestra:eval` scripts; replace Ruflow script wiring.
2. Make context, governance, enforcement, ratchet, RAG, CODEOWNERS, and drift CI require the canonical registry, ten generated profiles, and exact-ten checker. Remove all fallbacks that turn absence into success.
3. Preserve shared no-AI-template, production-data-integrity, security, test-first, context, and protected-surface principles. Port only mechanisms that Codex actually invokes; do not call dormant Claude hooks enforcement.
4. Run focused checker tests, `npm run check:agent-orchestra`, `npm run check:agent-context`, `npm run check:subagent-governance`, `npm run check:no-ai-templates`, `npm run check:best-practices`, and `npm run enforcement:check` before deleting any legacy source.

## Task 5: Retire the competing Claude/Ruflow role system

**Files:**

- Delete after green replacement: `.claude/agents/**`
- Delete after green replacement: `.claude/skills/**`
- Delete after green replacement: `.claude/rules/**`
- Delete after tested Codex-native replacement or explicit retirement: `.claude/hooks/**`
- Delete after wiring removal: `.claude/settings.json`
- Delete: `tools/ruflow-plus/**`
- Delete: `scripts/sync-ruflow-plus.mjs`
- Delete or supersede: `docs/ai/RUFLOW_PLUS_*.md`
- Supersede rather than erase historical decision context: `docs/adr/0003-ruflow-plus-repository-orchestration.md` when present
- Replace stale false-complete plan: `docs/superpowers/plans/2026-07-08-persistent-agent-orchestra.md`

**Steps:**

1. Salvage only revalidated ZenFlow constraints: bounded fan-out, untrusted subagent output, test-first, protected surfaces, i18n/RTL, offline/data ownership, native/back/safe-area, visual-proof separation, least privilege, and fresh evidence.
2. Remove old tool names, fake self-training/performance claims, generic role catalogs, duplicated prompts, and fallbacks to nonexistent local targets.
3. Keep `CLAUDE.md` as the repository-mandated thin import bridge only; it must not contain or link to a second role roster.
4. Run `rg` over tracked files and require zero live operational references to `.claude/agents`, Ruflow role templates, `ai:ruflow-plus`, or `RUFLOW_PLUS_*`, excluding explicitly labelled historical ADR text.

## Task 6: Verification, independent closure, and honest handoff

**Steps:**

1. Run focused Vitest tests separately from TypeScript/static checks.
2. Run `node scripts/sync-persistent-agent-orchestra.mjs --check`, semantic report validation, `npm run check:agent-context`, `npm run check:subagent-governance`, `npm run check:no-ai-templates`, `npm run check:best-practices`, `npm run check:production-data-integrity`, `npm run constitution:check`, and the applicable parts of `npm run check:all`.
3. Run `bash /Users/yehor/.codex/bin/codex-security-suite.sh --profile auto --path /Users/yehor/Documents/Codex/2026-06-10/new-chat/people-first-app`. Run local Snyk fallback only against a safe tracked-file scan path; record auth/network/tool absence as `UNVERIFIED`.
4. Ask independent reviewers to inspect the exact final diff and hashes. Run role 10 Pass B only after the candidate manifest is frozen. Verify every reported issue locally before changing code.
5. Attempt a supported Codex profile enumeration/invocation probe without inventing a command. If the runtime cannot expose it, report `RUNTIME_LOADING` and effective permissions as `UNVERIFIED`.
6. Produce a claims ledger separating structural, semantic, runtime, qualified-human, and real-user evidence. No number of green structural checks may promote another category.

## Acceptance criteria

- Exactly ten tracked project custom profiles are generated from one registry; missing, extra, renamed, or drifted artifacts fail closed.
- Every role is narrow, ZenFlow-specific, evidence-bound, and tested by positive plus negative scenarios; role 10 has independent Pass A and hash-bound Pass B contracts.
- Agent output cannot self-assert trusted project state, effective permissions, human research/review, resolved risk, completed handoff, locale acceptance, accessibility conformance, clinical safety, or user delight.
- Old Claude/Ruflow role prompts and active wiring no longer form a second source of truth.
- No product fixture, demo user history, mock research, production fallback, or application runtime behavior is added.
- Fresh command evidence and independent review cover all modified governance surfaces; every unsupported claim is explicitly `UNVERIFIED`.
