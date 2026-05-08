# Ruflow+ Repo Integration

This file is the tracked reference for the live local integration under `.Codex/` and `.agents/`.

Why this exists:
- `.Codex/` is local-first in this repo and currently matched by a local ignore rule on this machine
- `.agents/` is ignored by git in this repo
- the live working copies are useful locally, but the team needs a tracked record
- the full prompt and skill bodies are mirrored in tracked docs
- machine-readable tracked templates now exist for reproducible bootstrap

Evidence:
- `.git/info/exclude:8` contains `/.codex/`, which matches `.Codex/` on this Windows machine
- `.git/info/exclude:7` ignores `/.agents/`

## Live Local Files

Local working copies currently exist at:
- `.Codex/config.toml`
- `.Codex/agents/README.md`
- `.Codex/agents/ruflow-plus-coordinator.md`
- `.Codex/agents/ruflow-plus-researcher.md`
- `.Codex/agents/ruflow-plus-reviewer.md`
- `.Codex/agents/ruflow-plus-memory-keeper.md`
- `.agents/skills/ruflow-plus-orchestration/SKILL.md`

## Tracked Mirrors

These tracked files now mirror the ignored local content:
- [RUFLOW_PLUS_ROLE_PROMPTS.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_ROLE_PROMPTS.md>)
- [RUFLOW_PLUS_SKILL_MIRROR.md](</C:/project/people-first-app/docs/ai/RUFLOW_PLUS_SKILL_MIRROR.md>)
- [AGENT_CONTEXT_PERSISTENCE.md](</C:/project/people-first-app/docs/ai/AGENT_CONTEXT_PERSISTENCE.md>)

Tracked operator contract:
- [PREFLIGHT_OPERATOR_TEMPLATE.md](</C:/project/people-first-app/docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md>)

## Tracked Templates

Machine-readable tracked templates live here:
- [tools/ruflow-plus/templates](</C:/project/people-first-app/tools/ruflow-plus/templates>)

Bootstrap and verification commands:
- `npm run ai:ruflow-plus:sync`
- `npm run ai:ruflow-plus:check`

## Shell Environment Defaults

These values were merged into the live local `.Codex/config.toml` as project-local shell environment defaults:

| Variable | Value | Purpose |
| --- | --- | --- |
| `RUFLOW_PLUS_DEFAULT_MODE` | `hierarchical` | anti-drift default |
| `RUFLOW_PLUS_MAX_WORKERS_MEDIUM` | `3` | medium-task team limit |
| `RUFLOW_PLUS_MAX_WORKERS_LARGE` | `5` | large-task team limit |
| `RUFLOW_PLUS_REQUIRE_WRITTEN_PLAN` | `1` | forces preflight discipline |
| `RUFLOW_PLUS_REQUIRE_VERIFICATION` | `1` | completion gate |
| `RUFLOW_PLUS_REQUIRE_LEARNING_WRITEBACK` | `1` | explicit memory loop |
| `RUFLOW_PLUS_PREFLIGHT_TEMPLATE` | `docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md` | operator contract location |
| `RUFLOW_PLUS_MIN_PREFLIGHT_DEPTH` | `L2` | repo-touching work must not fall below L2 |
| `RUFLOW_PLUS_REQUIRE_PLATFORM_MATRIX` | `1` | force platform/domain impact scan |
| `RUFLOW_PLUS_REQUIRE_ANTI_PATTERN_SCAN` | `1` | force law / anti-pattern awareness |
| `RUFLOW_PLUS_REQUIRE_GO_STOP_ASK` | `1` | explicit gate verdict required |
| `RUFLOW_PLUS_VERIFY_TIME_SENSITIVE_EXTERNALS` | `1` | external/time-sensitive facts need source verification |
| `RUFLOW_PLUS_ROLE_DIR` | `.Codex/agents` | role prompt location |
| `RUFLOW_PLUS_LEARNING_RECORD` | `docs/ai/RUFLOW_PLUS_LEARNING_RECORD.md` | tracked template |

Important:
- these defaults are useful shared conventions for prompts, scripts, and shell tasks
- they do not, by themselves, make Codex automatically adopt Ruflow+ behavior
- the actual orchestration still depends on using the skill, docs, role prompts, and pre-flight template deliberately

## Persistent Agent Context

Local MCP memory is configured through the ignored `.mcp.json` file and should store graph memory at:

```text
C:\project\people-first-app\.Codex\memory\mcp-memory.jsonl
```

Tracked protocol:
- [AGENT_CONTEXT_PERSISTENCE.md](</C:/project/people-first-app/docs/ai/AGENT_CONTEXT_PERSISTENCE.md>)
- [ZenFlow Context MCP](</C:/project/people-first-app/tools/zenflow-context/README.md>)

Startup rule:
- resolve a task with ZenFlow Context MCP before planning substantial work
- in Claude Code, this is automatic through `SessionStart`, `UserPromptSubmit`, and `SubagentStart` hooks
- search MCP memory for `ZenFlow`, `RuflowPlus`, `Verification_Discipline`, and task keywords when historical lessons matter
- treat memory as routing context, not fresh proof
- verify drift-prone claims from current repo files, commands, or official sources

Writeback rule:
- after non-trivial runs, store only durable decisions, reusable failures, successful patterns, and dated environment facts
- never store secrets, raw transcripts, tokens, or speculative conclusions

## Role Prompt Summary

### Coordinator
- owns scope, sequencing, anti-drift, integration, final verdict

### Researcher
- gathers repo and web evidence before edits

### Reviewer
- prioritizes regressions, missing tests, and policy violations

### Memory Keeper
- distills lessons into reusable routing hints

## Sharing Guidance

If you want this orchestration layer to be portable across teammates and machines:

1. Keep `docs/ai/` as the tracked source of truth.
2. Treat `.Codex/` and `.agents/` as local working copies.
3. Recreate or sync local files from the tracked docs when a new environment is set up.
4. Do not assume local ignored files exist on another machine.
5. If you need cross-platform ignore behavior, add an explicit `/.Codex/` ignore rule rather than relying on Windows case-insensitive matching.
