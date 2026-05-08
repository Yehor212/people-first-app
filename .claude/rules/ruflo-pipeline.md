---
description: Ruflo pipeline enforcement rules, required areas, and shared hook logic
---

# Ruflo Pipeline Rules (Auto-loaded) — v3 ALL 16 Areas

## Mandatory Pipeline — Every Session

BEFORE first edit, call tools from ≥3 areas (Edit gate). BEFORE stopping/committing, ALL 16 must be covered.

### Phase 1: Before work (BLOCKING at Edit)

1. `mcp__ruflo__guidance_workflow` — guidance area
2. `mcp__ruflo__memory_search` — memory-knowledge area
3. `mcp__ruflo__agentdb_pattern-search` — memory-knowledge area

### Phase 2: During work (call remaining areas progressively)

4-16. Call 1 tool from each missing area (see table below)

### Phase 3: After work (BLOCKING at commit)

17. `mcp__ruflo__memory_store` — save solution pattern

State file `.ruflo-last-action` is AUTO-CREATED by `ruflo-enforcer.cjs` via PreToolUse:mcp**ruflo**.\*
DO NOT create or modify it manually via Bash — it is a PROTECTED FILE.

## ALL 16 Mandatory Areas — 1 Tool Each

| #   | Area                  | Fastest Tool          |
| --- | --------------------- | --------------------- |
| 1   | memory-knowledge      | `memory_search`       |
| 2   | intelligence-learning | `neural_status`       |
| 3   | guidance              | `guidance_workflow`   |
| 4   | code-analysis         | `analyze_diff-risk`   |
| 5   | security              | `aidefence_stats`     |
| 6   | performance           | `performance_metrics` |
| 7   | embeddings-vectors    | `embeddings_status`   |
| 8   | config-system         | `config_list`         |
| 9   | hooks-automation      | `hooks_list`          |
| 10  | session-workflow      | `session_list`        |
| 11  | agent-management      | `agent_list`          |
| 12  | swarm-orchestration   | `swarm_status`        |
| 13  | hive-mind             | `hive-mind_status`    |
| 14  | wasm-agents           | `wasm_agent_list`     |
| 15  | ruvllm-inference      | `ruvllm_status`       |
| 16  | github-integration    | `github_metrics`      |

Note: `sparc-methodology` has 0 MCP tools. Replaced by `guidance` as #16.

## Enforcement (v3 — ALL BLOCKING, ZERO SKIPS)

| Hook                         | Event                       | Blocks When                             |
| ---------------------------- | --------------------------- | --------------------------------------- |
| `ruflo-enforcer.cjs`         | PreToolUse:Edit/Write       | No state file, missing phases, <3 areas |
| `anti-skip-gate.cjs` CHECK 7 | Stop                        | **<16 areas**                           |
| `stop-tsc-gate.cjs`          | Stop                        | **<16 areas**, stale >1h                |
| `independent-verifier.cjs`   | Stop                        | **<16 areas** (ALL sessions)            |
| `commit-gate.cjs` Layer 5h   | PreToolUse:Bash(git commit) | **<16 areas** + missing phases          |
| `commit-gate.cjs` Layer 0    | PreToolUse:Bash             | `.ruflo-last-action` write = BLOCKED    |

## Shared Logic

`hook-utils.cjs` exports: `countRufloAreas(state)`, `ALL_16_AREAS`, `ALL_16_NAMES`, `TOTAL_AREAS`
All hooks use this single source of truth — no duplicated area lists.
