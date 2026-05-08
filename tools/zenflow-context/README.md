# ZenFlow Context MCP

This is a local Context7-style retrieval server for ZenFlow project context.

Context7 answers: "Which library docs should I retrieve, and what exact current docs matter?"

ZenFlow Context MCP answers: "Which ZenFlow repo context pack should I retrieve, and what exact project rules, files, scripts, and memories matter?"

## Tools

| Tool | Purpose |
| --- | --- |
| `resolve_zenflow_context` | Map a task to one or more context pack IDs. |
| `get_zenflow_context` | Return a compact, cited context pack from live repo files and local memory. |
| `record_zenflow_lesson` | Append a short reusable lesson after non-trivial work. |
| `list_zenflow_contexts` | List available context profiles. |

## Context Profiles

- `startup`: rules, architecture anchors, memory protocol, verification discipline.
- `memory`: cross-session memory, writeback, MCP context retrieval.
- `architecture`: app structure, state, storage, sync, Supabase boundaries.
- `ui`: visual, motion, accessibility, i18n/RTL, mobile parity.
- `verification`: CI, quality gates, evidence rules.
- `external_docs`: route framework/library questions to Context7 plus repo package versions.

## How Agents Should Use It

Automatic path:

1. Claude Code project hooks call `tools/zenflow-context/auto-context.mjs` on `SessionStart`, `UserPromptSubmit`, and `SubagentStart`.
2. The hook writes `.Codex/auto-context/current.md` and `.Codex/auto-context/current.json`.
3. The hook injects the current context pack through `additionalContext`.
4. Coordinator agents pass the same pack to specialists, and subagents receive it again through `SubagentStart`.

Manual/MCP path:

1. Call `resolve_zenflow_context` with the user task.
2. Call `get_zenflow_context` with the best context ID and a token budget.
3. Read the cited repo files before editing when the pack says a fact is drift-prone.
4. Use Context7 separately for current framework/library docs.
5. After meaningful work, call `record_zenflow_lesson` with one durable lesson.

Memory is routing context, not proof. Fresh command output still wins over stored observations.

## CLI Check

```bash
npm run ai:context:check
npm run ai:context:auto-check
```

Ad-hoc:

```bash
npm run ai:context -- --topic "audit modal Android back handling" --context auto --max-chars 12000
```

## MCP Setup

This repo's `.mcp.json` is local/ignored. Add the server entry from:

```text
tools/zenflow-context/mcp-server.example.json
```

Keep Context7 enabled alongside this server:

- Context7: external, current, version-specific library docs.
- ZenFlow Context: local project rules, architecture, scripts, memories, and verification routing.

The server speaks the current MCP stdio newline JSON-RPC transport and also accepts older `Content-Length` framed messages for compatibility with older clients.
