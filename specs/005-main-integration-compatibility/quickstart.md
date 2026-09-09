# Verification Runbook

Work only in the existing locked codex/android-103ms-20260904 lane; preserve source working copies.

1. Confirm branch/status and current doctor/RAG; retain the executed full-suite RED and twelve-cycle baseline.
2. Run added inert and writer-identity tests RED before their production edits; rerun the same tests plus existing owner, retry, idempotency, deletion, settings and journal recovery coverage afterward.
3. Run npm run typecheck, npm run lint, npm run check:circular, npm test -- --maxWorkers=2, npm run check:sync-contract and production-data-integrity modes. Typecheck and Vitest remain separate.
4. Run applicable full repository/build/bundle, architecture, context, no-template and best-practices checks. Inspect failures rather than relabeling a partial pipeline PASS.
5. Verify production-equivalent local browser open/cover/close/reopen, keyboard focus, mobile/desktop, RTL and reduced motion; run inline visual critic. Keep native/installed/live-account boundaries explicit.
6. Run scoped Snyk/security checks; inspect diff/status for unexpected source, secrets and production-reachable fixtures. Missing scanner proof stays unverified.
7. Record current counts for normal commit hooks, push the existing branch, update PR #112 truthfully, require exact-head CI and merge normally. Fetch main and verify all original ancestors. No force, hook bypass, ref deletion, history squash or store submission.

Record current five-platform results in verification.md. The separate Android latency gate is not closed by this compatibility run.
