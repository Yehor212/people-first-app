# Implementation Plan: Product Regression Recovery

**Branch**: `codex/002-product-regression-recovery` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-product-regression-recovery/spec.md`

## Summary

Recover the diary without touching real user content during development. The implementation extends ZenFlow’s existing owner-bound `DATA -> JOURNAL -> Dexie` serialization instead of introducing a second persistence path. It adds a durable removal-operation state, a read-only typed preflight over every protected object class, an atomic local commit, and separately retryable native/cloud cleanup. Cloud cleanup is journal-scoped and push-only after local vault removal: plaintext durability and remote protected-object absence are acknowledged before expected-revision vault deletion. Journal page reads become loss-tolerant for display only: readable entries remain visible and unavailable records contribute only to a privacy-safe count; export and mutation paths remain fail-closed.

The same epic replaces silent feature booleans with a structured, source-labelled availability decision and an auditable gate manifest. The existing boolean API stays as an adapter. The journal save ceremony remains production-disabled until its exact candidate has technical, accessibility, performance, visual-runtime, artistic/craft, and owner approval evidence. Each domain is delivered as a separate reviewable wave with exact-commit evidence and a non-destructive rollback.

## Technical Context

**Language/Version**: TypeScript 5.8.3 on Node.js 22.22.0; Rust/Tauri 2.11.3 only for existing Desktop packaging

**Primary Dependencies**: React 18.3.1, Vite 8.0.16, Dexie 4.4.2, Zustand 5.0.12, Capacitor 8, existing Web Crypto and native biometric bridge; no new production dependency

**Storage**: Dexie/IndexedDB `ZenFlowDB` remains local truth; journal records live in `journalEntries`, `journalPhotos`, `journalAudio`, `journalSpaces`, `journalSpaceCaptures`, and journal-draft `settings`; owner, password/vault, migration/removal intent, and offline-queue records remain in current stores. A forward-only Supabase expand/contract migration adds remote vault-epoch columns and owner-bound fence functions; it is authored here but is not applied to production by this worktree

**Testing**: Vitest 4.1.8 with fake-indexeddb and Testing Library; Playwright 1.58.1 for browser/PWA runtime; existing static/native build contract tests; security/PDI scripts

**Target Platform**: Web/PWA; Android 8+ (`minSdk 26`, `targetSdk 36`); iOS 15+; Desktop/Tauri 2.11.3. Physical Android/iOS and Windows runtime remain `UNVERIFIED` until run

**Project Type**: Cross-platform local-first React application with native wrappers and cloud synchronization

**Performance Goals**: Preserve the diary-route contract: no long task above 500 ms; investigate any task above 300 ms and long animation frame above 250 ms. Page decryption remains bounded to the existing 32-entry initial page and 100-entry maximum; preflight reports progress and yields between bounded object batches rather than launching unbounded crypto work. Bundle and Chrome budgets remain unchanged

**Constraints**: No production-data inspection or substitution; no destructive recovery; owner/revision fail closed; offline-capable; no raw record IDs/content/ciphertext in UI or diagnostics; eight locales including RTL; 44 px targets; exact local-versus-cloud status; no new paid service/API/dependency; no broad historical restore

**Scale/Scope**: Existing journal tables and feature surfaces only. Wave 1 changes the password-removal and display-read contracts; Wave 2 inventories existing gates and fixes authoritative journal-count eligibility; Wave 3 prepares but does not admit the save ceremony without missing human gates; later waves require a reproduced regression before code change

## Constitution Check

*GATE: Evaluated before Phase 0 and re-evaluated after Phase 1.*

The constitution status command returned `PROPOSAL_CRITERIA_ONLY`; therefore the constitution is advisory and nonblocking. The same obligations below are independently binding through `AGENTS.md`, `ARCHITECTURE.md`, and referenced policies.

| Binding gate | Pre-research result | Post-design result | Evidence / design response |
| --- | --- | --- | --- |
| Local truth and full lifecycle | PASS | PASS | Reuses existing Dexie tables, owner boundary, write barrier, journal lock, removal queue, and sync runner; lifecycle is specified in [data-model.md](./data-model.md) |
| No fabricated production behavior | PASS | PASS | Only isolated test fixtures are permitted; display degradation uses count/state rather than fake cards |
| Security/privacy and bounded authority | PASS | PASS | No real-account mutation, private-content diagnostics, secret access, paid API, or schema production write is authorized |
| Test-first behavior change | PASS | PASS | Every production task is preceded by a named red test; missing red evidence blocks that task |
| Cross-platform/accessibility/i18n | PASS | PASS | Platform matrix, dialog contract, eight-locale parity, RTL, Android Back, and native evidence gaps are explicit |
| Runtime/performance/visual integrity | PASS | PASS | Existing route/bundle thresholds stay fixed; ceremony admission separates technical, visual-runtime, artistic, and user gates |
| Sync/deletion/rollback safety | PASS | PASS | Local commit, native cleanup, cloud cleanup, retry, idempotency, stale-client behavior, and non-destructive rollback are separate states |
| Exact evidence and honest status | PASS | PASS | [traceability.md](./traceability.md) binds every claim to current command/artifact or `UNVERIFIED` |

No binding gate violation needs a Complexity Tracking exception.

## Project Structure

### Documentation (this feature)

```text
specs/002-product-regression-recovery/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── traceability.md
├── contracts/
│   ├── journal-password-removal.md
│   ├── journal-entry-page.md
│   ├── feature-availability.md
│   └── build-capability-receipt.md
├── checklists/
│   ├── requirements.md
│   └── recovery-release.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── contexts/
│   ├── FeatureFlagsContext.tsx
│   └── __tests__/FeatureFlagsContext.test.tsx
├── features/journal/
│   ├── journalSecurityMigration.ts
│   ├── journalSecurityErrors.ts
│   ├── journalStorage.ts
│   ├── useJournal.ts
│   ├── useJournalSecurity.ts
│   ├── RemovePasswordConfirmDialog.tsx
│   ├── JournalModule.tsx
│   ├── save-ceremony/
│   └── __tests__/
├── lib/
│   ├── featureAvailability.ts
│   ├── journalBiometricCredentials.ts
│   └── storageKeys.ts
├── i18n/
│   ├── types.ts
│   └── languages/{en,uk,es,de,fr,ja,ar,he}.ts
└── storage/
    ├── accountBoundaryRuntime.ts
    └── db.ts

scripts/
├── check-feature-capability-receipt.cjs
└── run-shared-dist-build.mjs

.github/workflows/
├── deploy.yml
├── deploy-v2-preview.yml
└── visual-regression.yml

android/   # existing Capacitor wrapper/build evidence only unless a native defect is reproduced
ios/       # existing Capacitor wrapper/build evidence only unless a native defect is reproduced
src-tauri/ # existing Tauri wrapper/build evidence only unless a Desktop defect is reproduced
```

**Structure Decision**: Keep journal security in its current migration/security modules so the existing lock order and offline migration runner remain authoritative. Add only one pure feature-availability module and one build-receipt checker where an explicit contract does not already exist. Do not add a second database, state store, modal owner, or sync channel.

## Delivery Waves

### Wave 1 — P0 journal recovery

1. Capture baseline fingerprints and run existing focused journal tests.
2. Add failing behavior tests for typed preflight, each protected-object failure class, revision/account races, restart/idempotency, post-local cleanup failures, and partial page reads.
3. Extend the existing removal intent compatibly and implement prepare/revalidate/commit/cleanup stages under the current lock order.
4. Make the pending operation a global account-boundary obligation and resume it from the existing app-level lifecycle owner before the journal route mounts.
5. Add the server fence in compatibility mode: deploy `legacy`, dual-write exact epochs, use `paused` only for plaintext removal conversion, and activate `strict` per owner only after a complete exact-epoch inventory.
6. Replace post-removal global merge with acknowledged journal-only entry/media/backup finalization and expected-vault-revision compare-and-set deletion.
7. Return typed results through `useJournalSecurity`; keep the dialog open for blockers or partial cleanup and provide mapped recovery copy in all locales.
8. Add partial display-read results to `journalStorage`/`useJournal`/journal list UI without weakening export or single-record failure behavior.
9. Run focused through broad local checks, security/PDI scans, browser verification, then create a reviewable batch commit and PR.

**Rollback**: Before the Supabase migration is applied, revert the wave commit. After it is applied, use forward recovery: leave schema/legacy compatibility in place, keep affected owners `paused`, retain the v2 intent reader/resumer, and disable the removal UI until exact intents converge. Never drop the added columns/functions or restore password metadata over plaintext rows as an emergency rollback.

### Wave 2 — feature availability and real state

1. Create a reviewed versioned, fail-closed manifest for the known local preference, onboarding, behavioral, remote rollout, kill-switch, and build-capability gates, including every consumer or an explicit missing-consumer disposition.
2. Add failing tests proving journal eligibility uses authoritative current count and reports loading/unavailable state rather than zero.
3. Introduce `FeatureAvailability` and keep `isFeatureVisible()` as a boolean projection.
4. Audit every named route/surface and record available, temporarily unavailable, experimental-hidden, or release/security-blocked disposition.
5. Keep AI Coach, rewards, Lottie, and unproven services disabled.

**Rollback**: Revert the wave; the adapter preserves current consumer shape. No persisted user data is migrated.

### Wave 3 — save-ceremony release gate

1. Bind one capability and kill switch to Web/Pages, Android, iOS, and Desktop build receipts.
2. Verify the actual saved-entry anchor, veil, navigation, repeat/background/offline states, distinct local-save/cloud-pending/cloud-failed semantics, and static downgrade paths.
3. Run independent visual critic on the exact candidate and request owner visual approval.
4. Keep the production capability `false` while either human gate is missing. A later explicit approval may flip the single release input in a separately reviewed commit.

**Rollback**: Set the capability false or revert its isolated release-config commit; static save confirmation requires no migration.

### Wave 4+ — reproduced regressions only

Compare current source, exact history, the saved snapshot, and public runtime per symptom. Open a separate domain branch only after a current reproduction and causal diff. Never restore the 898-file snapshot wholesale.

## Root-Cause and Test-First Strategy

| Hypothesis | Current local evidence | Red proof required before edit | Rejection condition |
| --- | --- | --- | --- |
| One unreadable protected object aborts password removal | `removeJournalPasswordProtectionAtomically()` prepares six object groups with nested `Promise.all` | Each entry/media/draft/space/capture failure yields its typed blocker and preserves all fingerprints | Reject if the test fails because of setup/mocking rather than the production contract |
| One unreadable entry hides an entire page | `decryptEntriesForDisplay()` uses `Promise.all` and `getEntriesPage()` has no unavailable count | Mixed page returns readable rows plus exact unavailable count | Reject any implementation that creates blank/fake entries or changes export to best effort |
| Native cleanup ordering produces misleading status | `useJournalSecurity.removePassword()` clears native credential before local atomic removal | Local commit followed by native failure returns local-success/cleanup-pending; preflight failure never touches native state | Reject any generic exception that cannot distinguish local commit |
| Post-local global merge cannot import older encrypted backup | Removal runner calls the global merge after deleting the local vault; backup import requires the missing key for protected rows | Global merge negative control plus journal-only remote finalization with encrypted backup fixture | Reject any path that imports or replaces unrelated remote domains after local removal |
| Remote vault can be deleted by stale or aborted cleanup | Setting deletion lacks expected remote revision CAS and abort acknowledgement | CAS mismatch, abort, zero-row, extra protected row, and stale-client fixtures retain vault and intent | Reject client-only precheck or fire-and-forget deletion |
| Pending removal can be purged or never resumed | Account cleanup omits unqueued removal intent; retry effect is journal-route-owned | Queue-empty intent blocks account purge and app startup resumes without journal mount | Reject component-memory-only ownership |
| Stale writer can overwrite prepared rows or newer intent | Prepared rows are not fingerprint-rechecked; malformed or future intent is treated as absent | Direct row mutation, duplicate tab, malformed/future intent, and completed replay cases | Reject count-only snapshots or fail-open parsing |
| False journal count hides garden-stage functions | `FeatureFlagsContext` passes `journalEntries: 0` | Real count unlocks expected stage; loading/failure is not treated as verified zero | Reject a cached, sampled, or fallback count presented as authoritative |
| Missing flag or consumer can fail open | Enabled lookup has a permissive missing-value default and gate consumers are not inventoried | Unknown key, absent value, missing consumer, and design-rollout authority tests | Reject permissive defaults for unreviewed gates or visual bucketing as a release authority |
| Ceremony can diverge by release entry point | Build flag exists in Vite/env but workflows do not declare one shared release decision | Capability receipt is identical across produced target builds | Reject enablement while artistic or owner approval is missing |

## Verification Order

1. Run the exact red test and retain its expected failure.
2. Implement the smallest behavior change; rerun the same test green.
3. Run focused journal/feature/i18n/accessibility tests.
4. Run TypeScript and Vitest as separate commands.
5. Run `check:all`, sync/auth and PWA/offline contracts, production-data-integrity `diff`, then `all`.
6. Run Snyk MCP if callable; otherwise the scoped local Snyk CLI fallback, the narrow local security suite, and `npm audit --audit-level=high`.
7. Build once, then sequentially run bundle PDI, release-artifact, bundle-size, and Chrome performance checks to avoid concurrent `dist` mutation.
8. Run available Android/iOS/Tauri builds and smokes; unavailable physical/Windows evidence remains `UNVERIFIED`.
9. Review final diff/status, stage, run staged PDI, commit, push, and wait for exact-commit CI.
10. After merge/deploy, verify a cache-busted public URL and build receipt. The owner performs the real-account removal; the agent does not handle credentials or journal content.

## Complexity Tracking

No exception. The feature is complex because the existing product spans local storage, sync, native credentials, UI, and release gates; the design reuses each existing owner rather than adding another abstraction or service.
