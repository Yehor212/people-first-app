# Quickstart: Epic 002 Recovery Verification

This guide runs only against the isolated worktree and isolated test fixtures. It does not remove protection from a real account, read real journal content, deploy, merge, or alter production data.

## 1. Confirm the lane

```bash
cd /Users/yehor/Projects/ZenFlow/worktrees/codex-product-regression-recovery
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
SPECIFY_FEATURE=002-product-regression-recovery .specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
```

Expected branch: `codex/002-product-regression-recovery`. Before the first commit, divergence from the recorded base must be reviewed; do not reset, mass-restore, or reuse another agent's branch.

## 2. Install exact repository dependencies

```bash
npm ci
```

Do not add a production dependency for this epic. A failed install is `FAIL` or `UNVERIFIED` with its actual cause, never a reason to copy dependencies from another checkout.

## 3. Capture red evidence

Run the smallest named tests before product edits. The initial set is defined in `tasks.md`; representative commands are:

```bash
npx vitest run --configLoader runner src/features/journal/__tests__/journalSecurityMigration.test.ts
npx vitest run --configLoader runner src/features/journal/__tests__/journalStorage.pagination.test.ts
npx vitest run --configLoader runner src/contexts/__tests__/FeatureFlagsContext.test.tsx
```

A valid red receipt identifies the expected contract failure. Import/configuration/test-fixture errors do not count. Preserve failing output in the task evidence ledger; do not weaken an existing assertion.

## 4. Run focused green checks

```bash
npx vitest run --configLoader runner src/features/journal/__tests__/journalSecurityMigration.test.ts
npx vitest run --configLoader runner src/features/journal/__tests__/useJournalSecurity.vaultKey.test.tsx
npx vitest run --configLoader runner src/features/journal/__tests__/RemovePasswordConfirmDialog.test.tsx
npx vitest run --configLoader runner src/features/journal/__tests__/journalStorage.pagination.test.ts
npx vitest run --configLoader runner src/contexts/__tests__/FeatureFlagsContext.test.tsx
npm run check:sync-contract
npm run i18n:check
npm run i18n:deep
npm run check:translation-quality
```

Exact test paths may be added by the task packet. Every command reported as passing must have been executed in this worktree after the relevant edit.

## 5. Run TypeScript and Vitest separately

```bash
npm run typecheck
npm test
```

This separation is required by the repository commit pipeline and provides distinct receipts.

## 6. Run product and safety gates

```bash
npm run check:production-data-integrity:diff
npm run check:all
npm run check:sync-contract
npm run check:production-data-integrity
npm run ci:preflight
npm audit --audit-level=high
```

When new TypeScript security/data code exists and the Snyk MCP is unavailable, run the local scoped Snyk CLI fallback and `/Users/yehor/.codex/bin/codex-security-suite.sh` with the narrowest applicable profile. Authentication or network failure remains `UNVERIFIED`.

## 7. Build and inspect artifacts sequentially

Do not run artifact-sensitive checks concurrently because `dist` inventory must remain stable.

```bash
npm run build
npm run check:production-data-integrity:bundle
npm run check:release-artifacts
npm run bundle:report:strict
npm run smoke:chrome-performance
npm run cap:sync:android
npm run cap:sync:ios
```

Run the available Tauri build using the repository's existing command after confirming its current script. Physical Android/iOS, native assistive technologies, and Windows/Tauri runtime are `UNVERIFIED` unless they are actually exercised on the exact build.

## 8. Browser and accessibility evidence

Use a production-equivalent local build with isolated test state to verify:

- each dialog blocker, partial success, focus cycle, Escape, Android Back contract, 44 px targets, narrow viewport, increased text, and Arabic/Hebrew RTL;
- verified-empty, degraded, and all-unavailable journal states without private content in console/network;
- feature availability loading, unavailable, enabled, intentionally hidden, and kill-switch states;
- ceremony static fallback for reduced motion/runtime strain. The production ceremony remains disabled until separate artistic/craft review and explicit owner approval.

A successful local browser run is not native-device, public-deploy, artistic, or user-acceptance proof.

## 9. Stage and release evidence

```bash
git diff --check
git diff --stat
git status --short
npm run check:production-data-integrity:staged
```

After an authorized commit and push, wait for CI for that exact commit. After merge/deploy, verify the cache-busted public route and build capability receipt. The user performs the real-account password-removal confirmation without sharing credentials, keys, IDs, or journal content.

## Expected remaining evidence gaps

Until fresh direct evidence exists, retain `UNVERIFIED` for the exact real-journal root cause, physical Android/iOS, TalkBack/VoiceOver, Windows/Tauri runtime, ceremony artistic/craft quality, and explicit user visual approval.
