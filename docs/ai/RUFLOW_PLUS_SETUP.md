# Ruflow+ Setup

This is the shortest reliable way to bootstrap the local Ruflow+ layer on a new machine.

## What This Does

The setup syncs tracked templates into local working copies under:
- `.Codex/`
- `.agents/`

It also ensures the project-local Ruflow+ shell defaults exist in:
- `.Codex/config.toml`

## One-Time Setup

```bash
npm run ai:ruflow-plus:sync
```

## Verification

```bash
npm run ai:ruflow-plus:check
```

Expected result:
- the command exits successfully
- local role prompts match tracked templates
- the local skill matches the tracked template
- `.Codex/config.toml` contains the Ruflow+ shell defaults

## Why This Exists

This repo keeps `.Codex/` and `.agents/` as local-first working areas on this machine.
That is useful, but it creates a portability problem unless we provide:
- tracked templates
- a sync command
- a check command

Ruflow+ setup closes that gap.

## Source Of Truth

Human-readable reference:
- [PREFLIGHT_OPERATOR_TEMPLATE.md](</C:/project/people-first-app/docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md>)
- [RUFLOW_PLUS_BLUEPRINT.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_BLUEPRINT.md>)
- [RUFLOW_PLUS_REPO_INTEGRATION.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_REPO_INTEGRATION.md>)
- [AGENT_CONTEXT_PERSISTENCE.md](</C:/project/people-first-app/docs/ai/AGENT_CONTEXT_PERSISTENCE.md>)

Machine-readable templates:
- [tools/ruflow-plus/templates](</C:/project/people-first-app/tools/ruflow-plus/templates>)

Context retrieval:
- [ZenFlow Context MCP](</C:/project/people-first-app/tools/zenflow-context/README.md>)
- `npm run ai:context:check`
- `npm run ai:context:auto-check`

## Notes

- The sync is intentionally repo-local and does not change application runtime code.
- The config defaults help standardize prompts and workflow, but they do not magically replace deliberate orchestration.
- The pre-flight template is the operator contract that coordinator and specialist prompts inherit.
- Persistent cross-session context is handled through MCP memory plus explicit learning writeback. See `AGENT_CONTEXT_PERSISTENCE.md` before changing memory behavior.
- Project-specific retrieval is handled through ZenFlow Context MCP; external library documentation still belongs to Context7.
- Automatic project-context injection is handled by Claude Code `SessionStart`, `UserPromptSubmit`, and `SubagentStart` hooks. MCP remains available for explicit retrieval.
