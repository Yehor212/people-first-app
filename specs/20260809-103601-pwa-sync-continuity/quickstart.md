# Quickstart: Validate PWA Sync Continuity

This guide is an execution order for the authorized implementation phase. It does not claim any command has passed.

## Prerequisites

- Work in the locked `codex/` worktree with the intended baseline recorded.
- Confirm no other agent owns the same source files.
- Read `AGENTS.md`, `docs/ai/SYNC_CONTRACT.md`, `docs/ai/TEST_FIRST_AGENT_POLICY.md`, `docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md`, and this feature packet.
- Create fresh preflight evidence naming behavior, risk, RED source, GREEN rerun, and blast radius before production edits.
- Do not use real journal/habit content, production credentials, or an ordinary user account.

## 1. Baseline and RED

```bash
git status --short --branch
git rev-parse HEAD
npm run test -- --maxWorkers=1 src/hooks/__tests__/useDeltaSyncEffects.test.ts src/lib/__tests__/offlineQueue.accountBoundary.test.ts src/storage/__tests__/eventSync.test.ts src/observability/__tests__/syncHealthRecorder.test.ts src/components/sync/__tests__/SyncHealthCard.test.tsx src/components/__tests__/StorageErrorBanner.pushRevocation.test.tsx
```

Add the focused regression tests before production edits, then rerun the same command. New tests must fail for the intended behavior gap, not setup or fixture errors. Retain command, exit code, timestamp, failure names, and test counts.

Required RED groups:

1. New IndexedDB failure produces zero content-bearing `localStorage` writes.
2. Legacy migration failure injection preserves source and prevents processing/delta.
3. Every lifecycle trigger initializes/drains current-owner queue before fetch.
4. Remaining current-owner work prevents fetch/apply/cursor movement.
5. Quota failure rolls back entities and cursor.
6. Four truth states never infer confirmation from online/empty queue.
7. Storage-full incident is deduplicated and retries safely.
8. Diagnostic canaries never cross snapshot/event/DOM/log boundaries.

## 2. Focused GREEN

After the minimal implementation, run exactly the same focused command and record passing test counts. Then include the new i18n test:

```bash
npm run test -- --maxWorkers=1 src/hooks/__tests__/useDeltaSyncEffects.test.ts src/lib/__tests__/offlineQueue.accountBoundary.test.ts src/storage/__tests__/eventSync.test.ts src/observability/__tests__/syncHealthRecorder.test.ts src/components/sync/__tests__/SyncHealthCard.test.tsx src/components/__tests__/StorageErrorBanner.pushRevocation.test.tsx src/i18n/__tests__/syncContinuityTruthAndBidi.test.ts
```

## 3. Static and Contract Gates

Run sequentially so generated/bundle-sensitive checks do not race:

```bash
npm run typecheck
npm run lint
npm run check:sync-contract
npm run check:translation-quality
npm run i18n:check
npm run i18n:deep
npm run check:production-data-integrity:diff
npm run check:no-ai-templates
```

If first-party production code changed and the Snyk MCP is unavailable, use the repository-approved narrow local fallback without printing credentials:

```bash
snyk code test --json-file-output=output/snyk-code-pwa-sync-continuity.json src/lib src/hooks src/storage src/observability src/components
/Users/yehor/.codex/bin/codex-security-suite.sh diff
```

Scanner auth/network/tool absence is `UNVERIFIED`. Findings in changed code are `FAIL` until fixed and rescanned.

## 4. Build and Integrity

```bash
npm run build
npm run check:production-data-integrity:bundle
npm run check:all
```

Run broader sync coverage:

```bash
npm run test -- --maxWorkers=1 src/storage/__tests__/eventSync.test.ts src/lib/__tests__/syncStateMachine.test.ts src/lib/__tests__/syncGapDetector.test.ts src/storage/__tests__/deletionTracker.test.ts src/lib/__tests__/offlineQueueHandlers.test.ts
npm run smoke:telegram-sync-drill
```

Without live-account credentials, any account row reported by the drill remains `UNVERIFIED`; do not reinterpret partial local rows as a complete pass.

## 5. Production-Equivalent Browser Scenarios

Use a production build served locally and a fresh browser profile. Test Web/Vite and an installed Chrome/Edge PWA separately.

| Scenario | Required observation |
| --- | --- |
| Offline local save | Status says saved on this device/waiting, never confirmed online. |
| Full close and reopen online | Durable current-owner action is processed before any inbound delta; no closed-client promise. |
| Current-owner blocked action | Delta does not fetch; cursor remains unchanged; calm attention state appears. |
| Storage quota failure | One deduplicated accessible incident; no new content fallback; safe retry only. |
| Duplicate/late completion | Newer operation remains; no double acknowledgement. |
| Account switch during work | Old work does not apply/acknowledge under the new owner. |
| Gap/broadcast/multi-tab | One leader applies ordered deltas after outbound barrier. |
| Diagnostic canaries | Snapshot, receipts, custom events, DOM, and captured logs contain none of the canaries. |
| Narrow + RTL | 320 CSS px and desktop; ar/he counts/status/retry remain readable and keyboard reachable. |

Record screenshots/trace only if they contain no private content, IDs, raw URLs, or tokens. Browser success does not establish native or public deployment proof.

## 6. Final Scope and Hash Review

```bash
git diff --check
git status --short
git diff --name-only
git diff --stat
```

Reject the change if the diff includes `supabase/**`, `android/**`, `ios/**`, `src-tauri/**`, dependency manifests, service-worker files, production data, or unrelated specs. Review the full diff, then compute SHA-256 receipts for final feature artifacts and changed source/test files.

## Expected Evidence Status

| Evidence | Expected after local implementation |
| --- | --- |
| Focused RED/GREEN and local contracts | VERIFIED only with retained fresh receipts. |
| Web production build/browser | VERIFIED only after exact local run. |
| Installed PWA | VERIFIED only after installed runtime run. |
| Live same-account convergence | UNVERIFIED unless user-assisted marked-account smoke runs. |
| Android/iOS/Desktop | UNVERIFIED pending platform-owner receipts. |
| Public deployment/store | N/A in this scope; UNVERIFIED as release state. |
| Human translation acceptance | UNVERIFIED pending native-speaker review. |
