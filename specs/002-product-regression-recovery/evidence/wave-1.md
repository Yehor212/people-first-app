# Wave 1 Evidence: Journal Recovery

**Captured**: 2026-08-03T18:56:24Z
**Source state**: dirty feature worktree based on `13ca51a80d23220574deba762851fe5a32372e46`; exact delivery SHA does not exist yet
**Data boundary**: isolated Vitest/Dexie fixtures only; no production journal, account, credential, ciphertext, or real password was read or mutated

## Retained RED receipts

| Contract | Command scope | Expected RED | Subsequent GREEN |
| --- | --- | --- | --- |
| Remote cleanup pagination and cancellation | `journalPasswordRemoval.cloudCleanup.test.ts` | `2/4` failed: a protected row after the first Supabase page was missed and verification reads had no abort signal | `4/4` passed after bounded pagination and one `AbortSignal` per read |
| Durable diagnostic privacy | `journalPasswordRemoval.privacy.test.ts` plus migration tests | `8/51` failed because an injected provider message could survive in durable intent metadata | `51/51` passed after closed diagnostic-code normalization and legacy sanitization |
| Destructive-dialog keyboard exit | `RemovePasswordConfirmDialog.test.tsx` | `1/6` failed because Escape did not close the idle dialog | `6/6` passed with capture-phase Escape handling disabled during submit |
| Server migration old-client compatibility | `journalPasswordRemovalServerFenceMigration.test.ts` | `2/11` failed because the migration defaulted owners directly to `strict` and did not enter `paused` before conversion | `11/11` passed with explicit `legacy → paused → strict` contracts; this is static source proof, not PostgreSQL runtime proof |

The other journal cases were implemented against existing failing behavior and consolidated regression files. No exact terminal receipt was retained for every originally proposed filename, so the absence of a separate RED transcript remains `UNVERIFIED`; it is not reconstructed from memory.

## Implemented contract

| Failure mode | ZenFlow change | Local proof | Remaining boundary |
| --- | --- | --- | --- |
| Removal mutates some local rows before a later decrypt failure | Read-only owner/revision-bound preparation covers entries, photo/audio, drafts, Spaces, and Captures; exact raw row snapshots are rechecked inside one Dexie transaction | `journalSecurityMigration.test.ts` blocker, metadata-only media, direct-row race, rollback, and verified-empty cases | Exact blocker in the user's current journal is `UNVERIFIED` |
| Native biometric cleanup happens before local commit | Native cleanup runs only after local plaintext and password/vault metadata commit; account is revalidated immediately before installation-wide deletion | vault-key and lifecycle tests | Physical Android/iOS keychain behavior is `UNVERIFIED` |
| Cloud work is reported as a total failure after local success | The result distinguishes local removal from native/cloud cleanup; durable owner-bound intent resumes at startup/resume without mounting the journal | lifecycle, sign-out, sync, and dialog tests | Live Supabase/RLS and offline replay are `UNVERIFIED` |
| Global backup merge can import protected data or touch unrelated domains | Cleanup uses journal-only CAS patching, required remote commit outcomes, paged protected-object verification, then vault deletion | cloud cleanup, `syncJournal.delete`, `syncSettings`, and `cloudSync` tests | Live backup row contention is `UNVERIFIED` |
| One unreadable entry hides a page or becomes a blank card | Display reads settle per raw row, preserve raw cursor order, return `ready`, `empty`, `degraded`, or `unavailable`, and expose only `unavailableCount` | `journalStorage.partialRead.test.ts`, `useJournal.test.ts`, list parity tests | Browser proof of a real incompatible record is `UNVERIFIED` |
| Error state leaks sensitive details | Blockers and durable diagnostics use closed stable codes; UI/log paths do not receive content, ciphertext, owner IDs, row IDs, or provider messages | privacy negative controls and production-data-integrity source/bundle scans | External telemetry dashboards were not queried |
| Schema deployment breaks old protected clients or blocks its own cleanup | The migration defaults to `legacy`, rejects protected/stamped writes while an owner is `paused`, admits only plaintext conversion, and exposes owner-scoped `strict` promotion after exact-epoch inventory | `journalPasswordRemovalServerFenceMigration.test.ts` `11/11`; generated TypeScript RPC shape; separate `npm run typecheck` pass | SQL could not be executed locally because PostgreSQL/Supabase/container tooling is unavailable; non-production RLS and coexistence run are `UNVERIFIED` |

## Fresh green evidence already completed

- Final focused journal/security/sync pack after clean `npm ci`: `12` files, `265/265` tests passed.
- Full Vitest before the dependency-only patch refresh: `727` files, `9,216` passed, `7` todo, `9,223` total, exit `0`.
- `npm run check:sync-contract`: `409` invariants.
- `npm run check:all`: typecheck, lint, eight-locale i18n (`3,595` keys), deep translation, RTL-relevant checks, colors, canonical orbs, logo and visual guards all exited `0`.
- Production Data Integrity source and diff: `0` errors, `0` warnings; bundle scan after production build: `0` errors, `0` warnings.

The final post-lockfile full Vitest and `ci:preflight` results belong in `final-local.md`; the earlier full run is not promoted to exact-final proof.

## User authority

No automated step invokes password removal in a real account. After an accepted exact build, the user must reopen the journal, review the just-in-time warning, and initiate removal. If preflight returns a blocker, every local protected row and password/vault metadata must remain unchanged.
