# Wave 1 Evidence: Journal Recovery

> **CURRENT DISPOSITION (2026-08-04): `UNVERIFIED`; evidence invalidated by
> later edits.** The counts and `PASS` statements below are historical receipts.
> They do not cover the new reauthentication, recovery, privacy, or PDI
> fixed-point work. The PDI helper-DML/trigger reachability negative control is
> a current `FAIL`; recapture this entire packet only after that blocker and the
> frozen Wave 1 matrix are green.

**Captured**: 2026-08-04T06:31:01Z
**Baseline**: `13ca51a80d23220574deba762851fe5a32372e46`
**Scope**: password-removal recovery, partial reads, one owner-bound migration fence, eight-locale recovery copy, and minimum dependency/PDI prerequisites
**Data boundary**: isolated Vitest/Dexie fixtures only; no production journal, account, credential, ciphertext, password, or Supabase project was read or mutated

## Retained RED receipts

| Contract | Expected RED retained | Subsequent GREEN |
| --- | --- | --- |
| Remote cleanup pagination/cancellation | `journalPasswordRemoval.cloudCleanup.test.ts`: protected row after first page missed; reads lacked abort propagation | Bounded pagination and one signal per read |
| Durable diagnostic privacy | Privacy/migration pack accepted injected provider text | Closed diagnostic-code normalization and legacy sanitization |
| Destructive-dialog keyboard exit | Dialog pack did not close the idle topmost dialog on Escape | Stack-aware modal keyboard handling and submit lock |
| Server migration compatibility | Static migration pack skipped explicit `paused` conversion | `legacy → paused → strict` contracts |
| Migration cutover race | Ordering tests demonstrated a seed/write-trigger window, early trigger locks, and four `ALTER TABLE` scans whose locks could persist through most of the transaction | Heavy schema DDL commits before function install; checks use `NOT VALID` plus a separate lower-lock validation phase; all ten triggers attach only after one ordered five-table final-tail lock immediately before seed/NOTIFY/COMMIT |
| Permanent account-deletion boundary | Migration tests allowed authenticated journal-security mutations to proceed without a fresh tombstone check after the owner lock | Private fail-closed guard takes the owner advisory lock, then checks `account_deletion_blocks` under `READ COMMITTED` before all six mutation paths |
| French singular recovery copy | The real plural subject `données` used singular agreement in the one-entry message | Exact localized sentence assertion and all eight-locale structural/deep/quality checks |

Exact pre-implementation terminal receipts were not retained for every consolidated task statement. Those red-task rows remain unchecked; missing process proof is `UNVERIFIED`, not reconstructed.

## Implemented contract

| Failure mode | Wave 1 change | Fresh local evidence | Remaining boundary |
| --- | --- | --- | --- |
| Later decrypt failure leaves earlier rows changed | Read-only owner/revision-bound preparation covers entries, photo/audio media, drafts, Spaces, and Captures; exact raw snapshots are rechecked in one Dexie transaction | 179-file Wave 1 matrix, race/rollback tests, full Vitest | Exact blocker in the user's journal `UNVERIFIED` |
| Account/revision changes between check and commit | Account, owner, vault epoch, and inventory are checked before preparation and immediately before local/remote commit | Lifecycle, vault-epoch, account-boundary, server-fence tests | Real multi-tab plus live Supabase timing `UNVERIFIED` |
| Native/cloud failure appears as total failure | Local removal commits first; result distinguishes `removed` from `removed-cleanup-pending`; durable owner-bound cleanup resumes | Dialog, lifecycle, sync, sign-out, cloud-cleanup tests | Physical Keychain/biometric and live replay `UNVERIFIED` |
| One unreadable object hides a page | Display-only reads settle per raw row and expose `ready`, `empty`, `degraded`, or `unavailable` plus only `unavailableCount` | Partial-read/hook/list/privacy/export negative controls | A real incompatible record was not opened |
| Diagnostics leak private material | Public blockers and durable metadata use closed stable codes; no content, ciphertext, owner/row ID, or provider message enters UI metadata | Privacy tests, PDI source/diff/bundle, scoped Snyk | External telemetry sinks not inspected |
| Stale clients or deleted accounts race password removal | One forward-only migration adds row/Storage fences, lifecycle state, three bounded lock phases, inventory/revision checks, and a permanent-deletion admission guard. Entry deletion first checks the fenced root row and returns a typed deferred outcome while paused; server pauses use capped 15s→60s→5m→15m backoff while connectivity retains its short retry | 19/19 migration ordering/admission tests; 148/148 migration/delete/PDI pack; 131/131 queue/handler/delete tests; stable operation identity and eventual acknowledgement; typecheck | PostgreSQL parser/apply, live-size timing, two-session lock behavior, RLS/Storage/coexistence, long-duration device load, and forward retry remain `UNVERIFIED` because no authorized non-production target or local Docker/PostgreSQL was available |
| Proposed permanent-ID registry can resurrect old unknown IDs | The experimental second migration/RPC was removed after a historical-delete counterexample; existing durable client tombstones and owner-scoped deletes remain | Source comparison and deletion tests | Global server-side deletion permanence is not claimed |
| Modal status/focus/hit-area is inconsistent | One live-region owner, inert underlying panels, connected focus fallback, topmost Escape/Back, and 48px recovery targets | DOM/static accessibility pack `23/23` | Physical AT/device input `UNVERIFIED` |

## Fresh automated evidence

- Separate `npm run typecheck`: exit `0`.
- Wave 1 broad matrix: `179/179` files, `2,137/2,137` tests.
- Full `npm test -- --maxWorkers=1 --reporter=dot`: `724/724` files,
  `9,236` passed, `7` todo; exit `0`.
- `npm run check:all`: exit `0`; eight locales × `3,606` keys and the
  bundled lint/translation/color/orb/logo/visual guards completed.
- `npm run check:sync-contract`: `409` invariants.
- PDI source/diff/bundle: errors `0`, warnings `0`.
- Production Web build, duplicate verification, and bundle budgets exited
  `0`; Android Gradle assembleDebug and iOS unsigned simulator builds
  succeeded. Desktop source contract `115` passed, but the full Tauri check
  exited `1` because Windows `link.exe`/MSVC is unavailable on macOS.
- Strict local Chrome smoke: 14/14 route/profile rows ready, no
  console/network/response diagnostics; largest raw boot long task `61 ms`
  and largest boot long animation frame `158.5 ms`.
- PWA/offline: `2 PASS`, `2 SKIP`.
- Direct Snyk Code: journal and storage scopes `0` findings; `npm audit --audit-level=high`: `0` vulnerabilities.

`ci:preflight` reached its final ratchet and exited `1` for inherited `inlineStyles 358 > 323`. Baseline and candidate both contain 358 and the Epic diff adds zero matching lines. The threshold was not weakened.

## Authority and rollout

- The migration is source/static-tested but was not applied. It requires an explicitly authorized non-production target, canonical type regeneration, concurrent-writer/RLS/Storage checks, and forward recovery before production rollout.
- The agent never invokes password removal in a real account. The user performs the just-in-time action only after an accepted deployment and warning.
- Wave 4+ historical regressions remain untouched unless separately reproduced; the 898-file snapshot was never restored.
