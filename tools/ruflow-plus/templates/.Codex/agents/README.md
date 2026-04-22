# Ruflow+ Role Prompts

These files are repo-local role prompts for Codex-style multi-agent work.

They are intentionally plain Markdown so they remain usable even if your exact Codex agent configuration differs across environments.

Suggested roles:
- [ruflow-plus-coordinator.md](</C:/project/people-first-app/.Codex/agents/ruflow-plus-coordinator.md>)
- [ruflow-plus-researcher.md](</C:/project/people-first-app/.Codex/agents/ruflow-plus-researcher.md>)
- [ruflow-plus-reviewer.md](</C:/project/people-first-app/.Codex/agents/ruflow-plus-reviewer.md>)
- [ruflow-plus-memory-keeper.md](</C:/project/people-first-app/.Codex/agents/ruflow-plus-memory-keeper.md>)

Recommended usage:
- coordinator first
- researcher for evidence gathering
- reviewer before completion
- memory-keeper after completion or after a failed attempt
- all roles inherit `../../docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md`
- repo-touching work defaults to `L2`; cross-platform/stateful/prompt/config/governance work escalates to `L3` or `L4`

Default topology:
- hierarchical
- small teams
- disjoint write scopes
