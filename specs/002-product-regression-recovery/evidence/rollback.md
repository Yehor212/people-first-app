# Non-Destructive Rollback: Epic 002

## General rule

Rollback uses a normal reviewed `git revert` of the exact wave commit. Do not reset, force-push, restore the 898-file stash, delete IndexedDB, clear a user's journal, remove the Supabase vault row manually, or replace unreadable data with empty/demo records.

## Journal password-removal wave

- Before local commit, every blocker is no-change; retry after unlock/reload/account recovery.
- After local commit, native/cloud failure is a durable partial success. Keep the operation intent and retry cleanup; do not restore the password metadata over plaintext rows.
- Before the Supabase migration is applied, a normal code revert is available. After schema deployment, rollback is forward-only: retain the added nullable epoch columns/functions, leave existing owners in `legacy`, set an affected in-flight owner to `paused`, disable new removal starts, and use the owner-bound recovery/finalization path.
- Do not drop the migration, downgrade an already promoted `strict` owner blindly, or remove v2 intent readers while old and new clients may coexist. Production application, mode changes, and recovery RPC execution require a separately authorized target and receipt; none was performed in this worktree.
- Version-2 removal intents are fail-closed. A pre-Epic client does not understand that schema, so rolling clients back while any v2 intent may exist is unsafe. Retain the v2 reader/resume compatibility code through rollback, or wait for exact owner-bound intents to converge before removing it. Absence of live convergence proof is a rollback `STOP`.
- Remote vault deletion occurs only after granular objects, media replacements, and journal-only backup CAS are acknowledged. A failed/stale CAS retains the intent and vault.

## Feature-availability wave

- Revert the structured adapter and its consumers together; never restore the literal `journalEntries: 0`.
- If a consumer cannot evaluate authoritative local truth, expose its temporary-unavailable reason or keep the experimental feature hidden. Do not default a missing flag to enabled.

## Save-ceremony wave

- Immediate rollback is the tracked policy: `requestedCapabilities.journalSaveCeremony=false` and `killSwitches.journalSaveCeremony=true`.
- Release jobs must still require an exact-SHA capability receipt. Removing the receipt gate is not a valid rollback.
- The current production-equivalent bundle contains no ceremony chunk; no data migration is required to keep it disabled.

## Verification after rollback

Rerun the same focused tests, TypeScript, full Vitest, PDI source/diff/build/bundle, sync contract, target build contracts, and exact-SHA CI. Public or native recovery remains `UNVERIFIED` until the reverted exact build is observed on that platform.
