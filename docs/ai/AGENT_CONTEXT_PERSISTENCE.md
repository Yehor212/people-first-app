# Agent Context Persistence

Purpose: make ZenFlow agents recover the right project context across fresh sessions without relying on chat history, stale summaries, or one oversized prompt.

This is an operator protocol, not application runtime code. It applies to Codex, Claude Code, Ruflow+, and any MCP-capable coding agent working in this repository.

## Research-Backed Decision

Use a Context7-style layered memory model:

1. Always-loaded rules: tracked `AGENTS.md`, `ARCHITECTURE.md`, and the Ruflow+ docs under `docs/ai/`.
2. Task-scoped retrieval: a local ZenFlow Context MCP resolves the task to a context profile and returns a compact pack from live repo files.
3. Durable knowledge graph: the official MCP memory server remains the long-term observation store, backed by a repo-local JSONL file.
4. Explicit writeback: store only distilled, reusable facts after meaningful work.

Why this shape:

- OpenAI Agents SDK sessions fetch prior conversation items, persist new turns, and can use custom storage, but process-local memory resets when the process exits. Durable storage must be explicit.
- LangChain separates thread-scoped short-term memory from long-term stores; production short-term memory should use a database-backed checkpointer, and long-term memories are JSON documents organized by namespace and key.
- LlamaIndex chat stores preserve ordered chat history and can persist to disk, which reinforces that conversation history needs a real storage layer.
- The official MCP memory server provides a local knowledge graph with entities, relations, observations, and `MEMORY_FILE_PATH` for custom persistent storage.
- Claude Code documents the same split between persistent instructions and auto memory; concise startup memory is more reliable than dumping large notes into every session.

## Context7-Style Retrieval

ZenFlow uses a local project equivalent of Context7:

```text
tools/zenflow-context/server.mjs
```

The retrieval pattern is:

1. `resolve_zenflow_context`: map the user task to a context profile.
2. `get_zenflow_context`: return a compact, cited context pack from live repo files, package scripts, and local memory.
3. Context7 remains the right tool for external library/framework documentation.
4. ZenFlow Context MCP is the right tool for project-specific rules, architecture, verification, and historical lessons.

Available local context profiles:

| Profile | Use for |
| --- | --- |
| `startup` | session start, default repo rules, architecture anchors |
| `memory` | memory/writeback/orchestration continuity |
| `architecture` | Zustand/Dexie/Supabase/state/sync boundaries and the `docs/ai/SYNC_CONTRACT.md` invariants |
| `ui` | visual, motion, i18n/RTL, accessibility, platform parity |
| `verification` | CI gates, test routing, evidence discipline |
| `external_docs` | routing to Context7 plus installed package awareness |

CLI proof:

```bash
npm run ai:context:check
```

## Automatic Context Injection

For Claude Code, project hooks run the context resolver automatically:

| Event | Purpose |
| --- | --- |
| `SessionStart` | Create a startup context pack before the first prompt. |
| `UserPromptSubmit` | Resolve the actual user task and inject the matching context pack. |
| `SubagentStart` | Re-inject the current task context into spawned agents. |

The hook command is:

```bash
node tools/zenflow-context/auto-context.mjs --hook --event <EventName>
```

It writes:

```text
.Codex/auto-context/current.md
.Codex/auto-context/current.json
```

Verification:

```bash
npm run ai:context:auto-check
```

This does not remove the need for explicit MCP calls. It gives every new turn and subagent a fresh default context pack; agents can still call `get_zenflow_context` when they need a different pack or a larger budget.

## Local MCP Memory Setup

The project-local `.mcp.json` should point the `memory` server at:

```text
C:\project\people-first-app\.Codex\memory\mcp-memory.jsonl
```

Expected memory server shape:

```json
{
  "memory": {
    "type": "stdio",
    "command": "cmd",
    "args": ["/c", "npx", "-y", "@modelcontextprotocol/server-memory"],
    "env": {
      "MEMORY_FILE_PATH": "C:\\project\\people-first-app\\.Codex\\memory\\mcp-memory.jsonl"
    }
  }
}
```

Do not store secrets, raw environment files, access tokens, private user data, or speculative conclusions in MCP memory.

## Session Start Protocol

At the start of non-trivial work:

1. Read `AGENTS.md` and `ARCHITECTURE.md`.
2. Read this file when the task involves agents, memory, orchestration, audits, or multi-session continuity.
3. Read `docs/ai/SYNC_CONTRACT.md` before any sync, state hydration, backup, offline queue, lifecycle, or Supabase data-sync change.
4. Read `docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md` before cross-platform UI, public deploy, sync, CI, or repeated-regression work.
5. Search MCP memory before planning:
   - `ZenFlow`
   - `RuflowPlus`
   - `Verification_Discipline`
   - task-specific keywords
6. Treat memory as routing context, not fresh proof. Re-verify drift-prone facts with repo files, current commands, browser evidence, CI logs, or official web docs.
7. Include memory-derived assumptions in the visible pre-flight artifact when Ruflow+ mode applies.
8. If the task follows a repeated regression, explicitly add an incident-derived gate to the plan: original failure reproduction, adjacent state/platform coverage, and a public artifact check when the bug was seen on GitHub Pages.

If MCP memory tools are unavailable, fall back to:

- `docs/ai/RUFLOW_PLUS_BLUEPRINT.md`
- `docs/ai/RUFLOW_PLUS_REPO_INTEGRATION.md`
- `docs/ai/RUFLOW_PLUS_LEARNING_RECORD.md`
- this file

## Writeback Protocol

After any non-trivial run, write back only distilled knowledge:

- Durable decisions: architecture, workflow, verification routing, known unsafe paths.
- Reusable failures: command blockers, environment quirks, false starts, risky assumptions.
- Successful patterns: commands, file clusters, review heuristics, low-regression repair paths.
- Time-sensitive facts only when dated and labeled as potentially stale.
- Repeated regression lessons must become either a `docs/ai/` rule, a focused test,
  or a dated memory observation. Do not leave them only in chat history.

Use atomic observations. One observation should contain one reusable fact.

Good observation:

```text
2026-05-06: For ZenFlow memory/orchestration work, keep MCP memory as routing context and verify drift-prone repo facts from AGENTS.md, ARCHITECTURE.md, and live commands before editing.
```

Bad observation:

```text
Everything is fixed and all tests pass.
```

## Memory Taxonomy

Use these entity types when adding memories:

| Entity type | Use for |
| --- | --- |
| `project` | Stable ZenFlow architecture and repo identity |
| `operator_protocol` | Startup, pre-flight, verification, writeback rules |
| `quality_rule` | Rules that prevent repeated regressions |
| `environment_fact` | Shell, MCP, Windows/WSL, npm, CI blockers |
| `decision` | ADR-like outcomes that should outlive the chat |
| `source_set` | Pointers to canonical docs and official references |

Prefer `add_observations` on existing entities over creating near-duplicate entities.

## Context Budget Rules

- Keep startup memory short enough to scan.
- Retrieve by keyword rather than loading the whole graph.
- Keep stable instructions before volatile task context in prompts.
- Compact or move verbose historical detail into topic docs or learning records.
- Never let memory override current repo evidence.

## Verification

For this repo, context persistence is considered usable when:

- `AGENTS.md` is the tracked canonical agent entrypoint.
- `CLAUDE.md` is tracked and imports `AGENTS.md` instead of duplicating stale guidance.
- `npm run check:agent-context` passes.
- `.mcp.json` contains the `memory` server with `MEMORY_FILE_PATH` pointing to `.Codex\memory\mcp-memory.jsonl`.
- `.Codex\memory\mcp-memory.jsonl` exists and contains seed entities for ZenFlow, Ruflow+, session start, writeback, and verification discipline.
- `npm run ai:ruflow-plus:check` still passes after any Ruflow+ template changes.
- Future agents can recover the startup protocol from this file even if MCP tools are unavailable.

## Source Links

- [OpenAI Agents SDK sessions](https://openai.github.io/openai-agents-js/guides/sessions/)
- [LangChain short-term memory](https://docs.langchain.com/oss/python/langchain/short-term-memory)
- [LangChain long-term memory](https://docs.langchain.com/oss/python/langchain/long-term-memory)
- [LlamaIndex chat stores](https://developers.llamaindex.ai/python/framework/module_guides/storing/chat_stores/)
- [Model Context Protocol example servers](https://modelcontextprotocol.io/examples)
- [MCP memory server README](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)
- [Claude Code memory](https://code.claude.com/docs/en/memory)
