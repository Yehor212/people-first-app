# Quickstart: Verify the Bounded Governance Change

Run these commands from the isolated worktree
`/Users/yehor/Projects/ZenFlow/worktrees/codex-agent-routing-ab-eval`.

1. Run focused regressions:

   ```sh
   npx vitest run --configLoader runner \
     scripts/__tests__/skill-routing-hook-payload.test.ts \
     scripts/__tests__/production-data-integrity-hook.test.ts \
     scripts/__tests__/agent-routing-ab-eval.test.mjs \
     scripts/__tests__/agent-governance-observation.test.mjs
   ```

2. Inspect an explicit local observation without writing a file:

   ```sh
   npm run ai:agent-governance:observe-local
   ```

   Expected boundary: JSON reports `LOCAL_PROCESS_OBSERVED`; every host-runtime
   field is `UNVERIFIED`.

3. Only if a retained local artifact is required, choose a new ignored path:

   ```sh
   npm run ai:agent-governance:observe-local -- \
     --output output/agent-orchestra/manual-local-observation.json
   ```

   A second command with the same path must fail rather than replace the receipt.

4. Verify governance and integrity boundaries:

   ```sh
   npm run test:agent-orchestra
   npm run check:agent-orchestra
   npm run check:agent-orchestra:eval
   npm run enforcement:check
   npm run check:production-data-integrity:diff
   ```

Do not infer actual Codex host profile loading, effective permissions, token/cost,
or Windows/Linux behavior from these local checks. Those remain `UNVERIFIED` until
an authorized launcher-owned evidence path exists.

If an A/B comparison is cancelled, retain it only as `PILOT_INTERRUPTED`: at
least one arm must be `INTERRUPTED`, its interruption count must be positive, and
it must not carry partial outputs or a final review. The decision remains
`PILOT_NONPROMOTABLE`; never relabel the partial run as `PILOT_COMPLETED`.
