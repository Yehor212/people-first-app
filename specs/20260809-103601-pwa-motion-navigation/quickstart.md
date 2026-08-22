# Quickstart: Verification-First Implementation

Run from `/Users/yehor/Projects/ZenFlow/worktrees/codex-pwa-quality-20260809` only after explicit implementation authorization.

1. Confirm the assigned worktree/branch and preserve unrelated changes with `git status --short` and the project edit doctor.
2. Re-run `npm run rag:preflight -- 'PWA motion navigation implementation'`, read the current source/test owners named in `plan.md`, and record the precise baseline/red result for each requested behavior.
3. Implement in task order in [tasks.md](tasks.md). Do not make production edits before its corresponding TDD task has an executed baseline or expected red failure.
4. Run the targeted test file immediately after its source change. Use one worker if Vitest parallelism gives unrelated output.
5. For copy keys run `npm run i18n:check`, `npm run i18n:deep`, and `npm run check:translation-quality`; for icon-source changes run `npm run assets:logos`, `npm run assets:logos:check`, and `npm run assets:logos:proof`, then inspect `tmp/logo-quality-proof-sheet.png`.
6. Run the appropriate production-data-integrity diff/full/bundle checks; no test fixture may be reachable from runtime.
7. Perform a browser check for Web/Vite and installed PWA with keyboard, RTL, reduced motion, network, console, and 96-card DOM assertions. Do not claim native/device/store/public proof unless directly obtained.
8. Review `git diff --check`, the scoped diff, and `git status --short`. Fill the evidence ledger with executed commands/results, remaining `UNVERIFIED` platform/visual/human rows, and rollback readiness.

Expected result: a reviewable local change with honest proof boundaries, not publication or release.
