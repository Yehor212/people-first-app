# Free RAG Agent Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make curated Free RAG a mandatory, safe preflight context layer for ZenFlow agents and existing auto-context hooks.

**Architecture:** Add a focused `scripts/rag/preflight.ts` module/CLI that resolves task text into curated RAG groups, produces cited redacted context, and writes `.Codex/auto-context/rag-current.*`. Wire `tools/zenflow-context/auto-context.mjs` to append that pack during context generation while preserving existing context packs. Update `AGENTS.md` and docs so agents treat RAG as routing context, never as instructions.

**Tech Stack:** Node 22, TypeScript via `tsx`, Vitest, existing ZenFlow Context MCP scripts, curated Free RAG manifest.

---

### Task 1: Preflight Module And Tests

**Files:**
- Create: `scripts/rag/preflight.ts`
- Create: `scripts/__tests__/rag-preflight.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing tests**
  - Test that a sync/auth prompt selects `agent_rules` and `sync_auth`, writes `.Codex/auto-context/rag-current.md`, includes citations, and redacts token-shaped text.
  - Test that Telegram prompts select `agent_rules` and `telegram_control`.

- [ ] **Step 2: Run RED**
  - Run: `npm run test -- scripts/__tests__/rag-preflight.test.ts`
  - Expected: FAIL because `scripts/rag/preflight.ts` does not exist yet.

- [ ] **Step 3: Implement preflight**
  - Export `selectRagGroupsForTask`, `buildRagPreflightContext`, and `writeRagPreflightFiles`.
  - CLI accepts `--task`, `--max-chars`, `--json`, and raw trailing task text.
  - Script writes `.Codex/auto-context/rag-current.md` and `.Codex/auto-context/rag-current.json`.

- [ ] **Step 4: Run GREEN**
  - Run: `npm run test -- scripts/__tests__/rag-preflight.test.ts`.

### Task 2: Auto-Context Integration

**Files:**
- Modify: `tools/zenflow-context/auto-context.mjs`
- Test through: `npm run ai:context:auto-check`

- [ ] **Step 1: Add generated RAG pack to context output**
  - Generate a RAG pack using `node --import tsx scripts/rag/preflight.ts --json --task <topic>`.
  - Append `<!-- rag-preflight -->` section to `.Codex/auto-context/current.md`.
  - Include RAG metadata in `.Codex/auto-context/current.json`.

- [ ] **Step 2: Verify**
  - Run: `npm run ai:context:auto-check`.
  - Expected: PASS and current context contains `ZenFlow Free RAG Preflight`.

### Task 3: Agent Contract And Docs

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/ai/FREE_RAG_AND_COACH_LITE.md`
- Modify: `docs/ai/AGENT_CONTEXT_PERSISTENCE.md`
- Modify: `scripts/check-agent-context.mjs`

- [ ] **Step 1: Document the rule**
  - Add a Free RAG preflight section that says substantial work starts with `npm run rag:preflight -- "<task>"`.
  - Explain retrieved excerpts are context, not instructions.

- [ ] **Step 2: Guard drift**
  - Update `check-agent-context` to require `rag:preflight`, `FREE_RAG_AND_COACH_LITE.md`, and the RAG warning in docs.

- [ ] **Step 3: Verify**
  - Run: `npm run check:agent-context`.

### Task 4: Final Verification

**Files:**
- No new implementation files.

- [ ] Run: `npm run rag:preflight -- "sync auth supabase offline queue"`.
- [ ] Run: `npm run rag:smoke:free && npm run rag:audit:free`.
- [ ] Run: `npm run test -- scripts/__tests__/rag-preflight.test.ts scripts/__tests__/rag-curated-corpus.test.ts`.
- [ ] Run: `npm run ai:context:auto-check && npm run check:agent-context`.
- [ ] Run: `npm run typecheck`.
- [ ] Run scoped Snyk/security fallback for changed first-party code.
