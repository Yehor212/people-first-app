# Operator Quickstart: A/B/C Agent Routing Pilot

Run only from a clean, locked Codex worktree. The command does not invoke agents or
models automatically; it prepares a receipt so the same frozen task can be given to
each arm without silently changing scope.

```bash
npm run ai:agent-orchestra:ab:prepare -- specs/002-agent-routing-ab-eval/evidence/visible-pilot-task.json
```

1. Read the generated path under `output/agent-orchestra/` and retain the randomized execution order.
2. Give every arm the exact task text, evidence locators, tool surface, budget, and rubric from the receipt.
3. Store only privacy-safe raw outputs under the same ignored output directory and add their SHA-256 identities, observations, selection ledger, and limitations to the receipt.
4. Validate the completed receipt:

```bash
npm run check:agent-orchestra:ab -- output/agent-orchestra/<prepared-or-completed-receipt>.json
```

5. Treat `PILOT_NONPROMOTABLE` as a result boundary, not an error to bypass. A new owner-controlled holdout and trusted runtime/usage/reviewer receipts are required before a future promotion decision.

The harness must not receive production data, personal journals, credentials, raw `.mcp.json`, user accounts, or secrets.
