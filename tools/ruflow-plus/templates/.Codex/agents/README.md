# Ruflow+ Role Prompts

These files are repo-local role prompts for Codex-style multi-agent work.

They are intentionally plain Markdown so they remain usable even if your exact Codex agent configuration differs across environments.

Suggested roles:
- [ruflow-plus-coordinator.md](</C:/project/people-first-app/.Codex/agents/ruflow-plus-coordinator.md>)
- [ruflow-plus-researcher.md](</C:/project/people-first-app/.Codex/agents/ruflow-plus-researcher.md>)
- [ruflow-plus-reviewer.md](</C:/project/people-first-app/.Codex/agents/ruflow-plus-reviewer.md>)
- [ruflow-plus-memory-keeper.md](</C:/project/people-first-app/.Codex/agents/ruflow-plus-memory-keeper.md>)

Recommended usage:
- head agent auto-activates Ruflow+ coordinator discipline by default
- when `.Codex/auto-context/current.md` exists, treat it as the inherited task context before planning
- when the current pack is missing or stale, run `npm run ai:context:auto-check` before substantial work
- lightweight prompts stay `solo_lightweight`; repo-touching work routes to `guided`; cross-domain work routes to `ruflow_plus`
- substantial work starts with a visible evidence-backed PRE-FLIGHT ARTIFACT, not raw hidden chain-of-thought
- coordinator first
- researcher for evidence gathering
- reviewer before completion
- memory-keeper after completion or after a failed attempt
- all roles inherit `../../docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md`
- UI-touching work also inherits the visual-audit matrix and proof expectations from that template
- repo-touching work defaults to `L2`; cross-platform/stateful/prompt/config/governance work escalates to `L3` or `L4`
- install recommendations must state availability, benefit, risk, and whether the tool is required or optional

Default topology:
- hierarchical
- small teams
- disjoint write scopes
