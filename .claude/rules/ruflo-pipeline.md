# Ruflo Pipeline Rules (Auto-loaded)

## Mandatory Pipeline — Every Session

BEFORE first edit, run BOTH (commit-gate Layer 5h blocks without these):

1. `mcp__ruflo__memory_search` — find prior patterns for this task
2. `mcp__ruflo__agentdb_pattern-search` — BM25+semantic hybrid search

AFTER completing work, BEFORE commit:

3. `mcp__ruflo__memory_store` — save solution pattern for future sessions

Then create state file via Bash:

```bash
node -e "require('fs').writeFileSync('.ruflo-last-action',JSON.stringify({phases:{memory_search:{done:true,tool:'mcp__ruflo__memory_search',time:Date.now()},pattern_search:{done:true,tool:'mcp__ruflo__agentdb_pattern-search',time:Date.now()},store_result:{done:true,tool:'mcp__ruflo__memory_store',time:Date.now()}},lastAction:Date.now(),toolLog:[]},null,2))"
```

## What NOT to use (FACADE — GitHub #653, #1397)

- `agent_spawn` — JSON record, no subprocess
- `swarm_init` — config record, no execution
- `hive-mind_consensus` — self-voting, not real BFT
- `coordination_*` — metadata only
- `terminal_execute` — echo, use Bash
- `wasm_agent_prompt` — echo, use Agent tool

## Enforcement

- `ruflo-enforcer.cjs` (PreToolUse:Edit) — advisory warning if no state file
- `commit-gate.cjs` Layer 5h — **BLOCKING** commit without all 3 phases
- `independent-verifier.cjs` (Stop) — checks ruflo freshness
