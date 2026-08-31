# Research: Product Regression Recovery

**Baseline commit**: `13ca51a80d23220574deba762851fe5a32372e46`
**Research date**: 2026-08-03
**Evidence rule**: Local source establishes current behavior only. The user’s exact real-data failure remains `UNVERIFIED` until a privacy-safe fixed-build preflight is run by the user.

## Decision 1 — Extend the Existing Security Boundary

**Decision**: Keep password removal inside the existing `runWithJournalSecurityBoundary()` lock order (`DATA` barrier, then `JOURNAL` lock, with owner/generation checks) and extend the existing durable removal intent rather than adding a new database/table or independent queue.

**Rationale**: `journalSecurityMigration.ts`, `journalSecurityWriteLock.ts`, `useIndexedDB.ts`, and `accountBoundaryRuntime.ts` already serialize normal diary writes, account-boundary mutation, cross-realm writes, and the cloud migration runner. A second coordinator would create competing authorities and new lock-order risk.

**Alternatives considered**:

- New removal table/state machine: rejected because `settings` already owns migration/removal state and no indexed query is required.
- UI-only retry state: rejected because reload, another tab, or native lifecycle loss would erase it.
- Cloud-first removal: rejected because local truth and offline use would be blocked by network state.

**Verification path**: Cross-tab lock tests, account-switch tests, restart tests, existing sync migration tests, and exact intent compatibility tests.

## Decision 2 — Separate Prepare, Atomic Commit, and External Cleanup

**Decision**: Persist an owner/revision-bound attempt, perform a read-only preparation pass over every protected object, recheck owner/revision under the existing locks, commit all local plaintext/password/vault changes in one Dexie transaction, then handle native credential cleanup and cloud delivery as independent idempotent cleanup states.

**Rationale**: Current source clears native biometrics before the local atomic removal. Therefore a later local failure is truthfully “biometrics changed but the lock remains,” while the desired contract is “no external cleanup before local readiness; after local success, external cleanup may remain pending.” Dexie documents that a transaction resolves only after commit and rejects on abort, but IndexedDB auto-commits when no request remains in a tick. Dexie also warns that `waitFor()` keeps transactions alive by issuing dummy requests and can be CPU intensive. Crypto preparation therefore stays outside the write transaction while the existing origin-wide locks prevent accepted journal writes from racing it. Sources: [Dexie transaction scope and auto-commit](https://dexie.org/docs/Dexie/Dexie.transaction%28%29), [Dexie.waitFor caution](https://dexie.org/docs/Dexie/Dexie.waitFor%28%29).

**Alternatives considered**:

- Web Crypto inside the Dexie transaction: rejected because it relies on transaction keepalive and adds CPU/portability risk.
- Delete password first and convert rows later: rejected because interruption creates a mixed, possibly inaccessible state.
- Best-effort conversion: rejected because skipped data would become silent loss.

**Verification path**: Fingerprint assertions before/after every blocker; forced transaction abort; concurrent account/revision change; native failure after local commit; offline/enqueue failure; duplicate retry.

## Decision 3 — Typed Blockers Without Record Identity

**Decision**: Export stable blocker classes only: `unlock-required`, `activation-pending`, `vault-revision-mismatch`, the five decrypt categories, `owner-changed`, and `storage-failed`. Keep the failing record identifier, ciphertext, content, key, and raw exception out of consumer results and logs.

**Rationale**: The dialog currently distinguishes only locked/partial/generic errors, which routes incompatible data and storage/revision failures into “nothing changed.” A category is sufficient to choose a recovery action; record identity is private and unnecessary for the user flow.

**Alternatives considered**:

- Return raw errors: rejected for privacy, localization, and unstable browser/native wording.
- One generic failure: rejected because it cannot give a valid recovery step or distinguish local success.
- Auto-reset the failing record: rejected as destructive and explicitly out of scope.

**Verification path**: Table-driven mapping tests and log/UI assertions that failure fixtures never surface seeded content, ciphertext markers, or IDs.

## Decision 4 — Loss-Tolerant Display Reads, Fail-Closed Export and Mutation

**Decision**: Use per-record settlement for display page/date reads, returning readable entries plus `unavailableCount`. Preserve raw page ordering/cursor progression even when the cursor record is unavailable. Keep export, single-record editing, and security conversion fail-closed.

**Rationale**: The current `decryptEntriesForDisplay()` uses `Promise.all`; one failure rejects the page. Converting every read to best effort would silently omit content from export or editing, so tolerance is limited to an explicitly degraded display contract.

**Alternatives considered**:

- Empty string for unreadable content: rejected because it creates a fake blank entry.
- Skip failures everywhere: rejected because exports could be incomplete without warning.
- Block the whole journal: rejected because recoverable records disappear.

**Verification path**: Mixed/fully unavailable/verified-empty page tests; stable-tie cursor tests; export rejection test; UI privacy assertions.

## Decision 5 — Authoritative Journal Count Is Asynchronous State

**Decision**: Subscribe the feature-gate provider to the repository’s settled data-refresh contract and read `getEntryCount()` from local truth. Represent initial load/failure as unknown/unavailable, never as zero. Calendar/onboarding unlock may independently allow a feature; otherwise unknown state produces a structured temporary reason.

**Rationale**: `FeatureFlagsContext.tsx` currently passes literal `journalEntries: 0` even though `journalStorage.getEntryCount()` exists and the app already publishes settled data refreshes. Using the current refresh mechanism avoids a competing store.

**Alternatives considered**:

- Mirror count into Zustand: rejected as a second authority and hydration burden.
- Read once at startup: rejected because create/delete/import/account changes would stale it.
- Default unknown to zero: rejected because that reproduces the disappearance bug.

**Verification path**: Provider tests for load, change, failure, account refresh, real-count unlock, and boolean-adapter parity.

## Decision 6 — One Structured Availability Decision, Existing Boolean Adapter

**Decision**: Add a pure versioned gate manifest and `FeatureAvailability { manifestVersion, key, visible, state, reason, source, disclosure }`; derive `isFeatureVisible()` from `.visible`. The initial manifest covers all current toggleable features plus audited remote/build-only gates, records route, surface, and consumer disposition, and fails closed for an unknown key, missing consumer, or absent unreviewed persisted value. Anonymous design-rollout bucketing remains limited to reversible visual variants and cannot satisfy a security or release gate.

**Rationale**: Current local preferences, onboarding, behavioral gates, remote design rollouts, kill switches, and build capabilities are separate systems. Conflating them into one writable switch would erase ownership. A read-only manifest names the authority while preserving existing consumers.

**Alternatives considered**:

- Replace all gate systems with one store: rejected as an unrelated architecture rewrite.
- Keep boolean-only API and add logs: rejected because users/support cannot distinguish disabled, loading, locked, or experimental state.
- Turn every flag on: rejected because AI, rewards, Lottie, and services lack required evidence.
- Preserve `storedValue ?? true`: rejected because an absent value can silently enable an unreviewed consumer.
- Reuse design-rollout cache as a kill switch: rejected because stale anonymous visual bucketing is not an owner-bound release or security authority.

**Verification path**: Manifest uniqueness/exhaustiveness tests, availability table tests, unknown or missing-key and missing-consumer negative controls, route consumer inventory, rollout-authority tests, and no-enable diff review.

## Decision 7 — Keep Save Ceremony Disabled Until Human Gates Close

**Decision**: Add an exact build capability receipt and one explicit release input across target build paths, but make schema v1 non-enabling. Even `requested=true`, an inactive kill switch, and six literal `pass` values produce `false`. A later isolated release change may introduce an enabling schema only after it verifies technical, accessibility, performance, visual-runtime, artistic/craft, and explicit owner visual-approval evidence bound to the same artifact hashes and commit.

**Rationale**: The assets, lazy build guard, lifecycle token, static reduced-motion variant, and runtime circuit breaker already exist. What is missing is authenticated release admission, not another animation implementation. Technical rendering cannot prove visual quality or user acceptance. A fresh GitHub API check returned `main` as unprotected, so CODEOWNERS is only a notification backstop and tracked `pass` strings cannot be treated as independent approval authority.

**Alternatives considered**:

- Enable on Web first: rejected because the owner requested cross-platform release parity and exact rollback.
- Enable because prior tests exist: rejected because prior evidence is stale and human gates are missing.
- Treat all tracked `pass` strings as approval: rejected by an executable negative control because an editor could self-assert every row without supplying the evidence or owner decision the contract requires.
- Remove the ceremony: rejected because no defect or product decision justifies deleting approved existing work.

**Verification path**: Schema-v1 all-pass negative control, exact disabled build receipt checks for Web/Android/iOS/Desktop, lifecycle/strain tests, browser screenshots/traces, independent visual critic, explicit owner decision, and a separately reviewed evidence-bound schema before enablement.

## Decision 8 — Modal Behavior Uses Existing Focus Infrastructure

**Decision**: Keep the existing focus trap, least-destructive initial focus, `role="dialog"`, `aria-modal`, and Android back hook; raise the affected recovery/settings actions to a 48 px minimum. Add status-specific live messaging and ensure Escape/Back cannot close during a mutating stage but can close after a safe blocker or partial result.

**Rationale**: The current dialog already implements most of the project contract. The WAI-ARIA Authoring Practices modal pattern requires focus inside the dialog, cycling Tab/Shift+Tab, Escape close, an accessible name, and focus return; it also recommends initial focus on the least destructive action for hard-to-reverse operations. Source: [WAI-ARIA APG modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Capacitor documents that registering `backButton` replaces default Android behavior, so the existing central handler must remain the owner. Source: [Capacitor App API](https://capacitorjs.com/docs/apis/app).

**Alternatives considered**:

- New modal library/native dialog: rejected because `ModalLayer`/existing a11y utilities are canonical.
- Close on every error: rejected because it discards recovery context.
- Focus destructive action first: rejected because removal is hard to reverse.

**Verification path**: Testing Library keyboard/focus tests, Android back contract test, text reflow/RTL static checks, browser keyboard smoke, and native assistive technology marked `UNVERIFIED` until run.

## Decision 9 — Lifecycle Recovery Uses Current Platform Owners

**Decision**: Resume pending cleanup from the existing security-state refresh and queue runner; cancel or downgrade ceremony presentation on existing Web/Capacitor/Tauri lifecycle signals. Do not invent a background service.

**Rationale**: Capacitor’s `appStateChange`, `pause`, and `resume` map to iOS, Android, and Web lifecycle events, while Tauri exposes close/focus listeners that require cleanup when a component unmounts. Sources: [Capacitor App lifecycle](https://capacitorjs.com/docs/apis/app), [Tauri window events](https://v2.tauri.app/reference/javascript/api/namespacewindow/).

**Alternatives considered**:

- Keep critical cleanup only in component memory: rejected because close/background loses it.
- Add a native background worker: rejected as unnecessary scope and platform permission risk.

**Verification path**: Restart, visibility/background/resume, close, offline queue replay, listener cleanup tests; physical devices and Windows remain `UNVERIFIED`.

## Decision 10 — Journal-Scoped Cloud Finalization, Vault Last

**Decision**: Replace the removal runner's post-local `syncWithCloud("merge")` with a journal-scoped push-only finalizer. It must require acknowledged plaintext entry/media metadata commits, patch only the journal fields of the remote backup under compare-and-set, verify that no remote protected journal object remains, and only then compare-and-set delete the expected remote vault revision. Superseded encrypted media blobs are deleted after their plaintext replacement and metadata commit, never before.

**Rationale**: Current source calls the global merge/import path after local password and vault deletion. `importBackup()` rejects an encrypted remote journal when no local vault key remains, so an otherwise correct local removal can be permanently trapped. The current remote vault delete also has no expected-revision server condition and can treat an aborted request as a completed call. A narrow finalizer preserves non-journal backup domains, prevents an old client from racing vault deletion, and leaves a readable copy at each media step.

**Alternatives considered**:

- Global `merge` after local removal: rejected because importing the older encrypted backup requires the key that the local commit intentionally removed.
- Delete the remote vault first: rejected because another device or queued protected object would become unreadable.
- Delete old encrypted media immediately after upload: rejected because a failed metadata commit would point the remote row at an unavailable replacement.
- Replace the entire remote backup: rejected because journal removal does not authorize overwriting unrelated cloud domains.

**Verification path**: Red tests must prove the global merge is never called, stale/zero-row/aborted vault deletion remains pending, extra protected remote rows retain the vault, journal-only backup CAS preserves non-journal fields, and every media failure boundary retains at least one readable copy.

## Decision 11 — Pending Removal Is a Global Account-Boundary Obligation

**Decision**: Treat every unresolved removal intent as a durable owner write in the account cleanup coordinator, and resume/enqueue it from an app-level lifecycle owner rather than only from `useJournalSecurity()`. Parse intent storage into `absent`, `supported`, and `unsupported-or-malformed`; the last state blocks new mutation and account purge. Duplicate same-operation requests resume, while conflicting operations stop. Prepared row fingerprints are revalidated immediately before the local transaction writes.

**Rationale**: Current `hasDurableOwnerWrites()` counts offline queue rows and activation migration but not a removal intent whose enqueue failed. Current requeue logic is mounted by `JournalModule`, so opening another route after restart does not guarantee recovery. The version-1 parser maps future or malformed data to `null`, and the current transaction can overwrite an existing removal intent or prepared rows changed outside the canonical writer lock. These are observable source gaps, not evidence about the user's exact failing record.

**Alternatives considered**:

- Depend on the offline queue alone: rejected because enqueue itself can fail after local success.
- Resume only when the journal opens: rejected because sign-out/account switch can happen first.
- Treat unknown intent versions as absent: rejected because a stale client could erase newer recovery state.
- Rely solely on cooperative locks: rejected because stale tabs and legacy/non-cooperative writers are part of the required compatibility boundary.

**Verification path**: Sign-out/account-switch blocker tests with queue-empty removal intent, app-start resume without journal mount, malformed/future intent tests, duplicate/conflicting operation tests, and a row-fingerprint TOCTOU abort test.

## Decision 12 — Expand/Contract Server Fence for Old Clients

**Decision**: Ship the Supabase fence as a forward-only compatibility migration. Existing and newly seeded owners default to `journal_write_mode='legacy'`; this mode admits historical protected rows without a `vault_revision` only while the owner-bound vault setting still matches the locked server state. A removal preflight locks and inventories the exact owner, then changes the mode to `paused`: encrypted or revision-stamped stale-client writes are rejected, while only plaintext conversion writes are admitted. Successful finalization returns the now-unprotected owner to `legacy`. A separate owner-only `enable_journal_strict_write_fence(expectedRevision)` RPC changes an owner to `strict` only after entries, media rows, backup items, and Storage objects all prove the exact active epoch. Schema DDL commits before function installation; the four new checks are added `NOT VALID` and validated in a separate bounded phase; all ten write/delete triggers are attached only after one ordered final-tail lock immediately before seed/NOTIFY/COMMIT.

**Rationale**: Enabling strict row and object triggers in the schema migration itself would reject still-supported clients that cannot send `vault_revision` and would turn deployment into an outage. Leaving writes broadly open during removal would let a stale protected client recreate ciphertext after inventory. Blocking every write during removal would also block ZenFlow’s own journal-scoped plaintext conversion. The three-state contract preserves compatibility while making the irreversible removal window fail closed for protected data. PostgreSQL documents that most `ALTER TABLE` forms default to `ACCESS EXCLUSIVE`, `CREATE TRIGGER` takes `SHARE ROW EXCLUSIVE`, and locks normally last until transaction end; it also documents `NOT VALID` plus later `VALIDATE CONSTRAINT` as the lower-impact path because validation uses `SHARE UPDATE EXCLUSIVE` and does not lock out ordinary updates. Sources: [explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html), [ALTER TABLE / NOT VALID](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-NOTES), and [statement/lock timeouts](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-LOCK-TIMEOUT).

**Alternatives considered**:

- Default every owner to `strict`: rejected because schema deployment would precede full client adoption and break legacy protected writes.
- Keep `legacy` forever: rejected because explicit exact-epoch admission is required once an owner has fully migrated.
- Pause every journal mutation: rejected because the resumable cloud finalizer must upload plaintext replacements before deleting the vault.
- Revert the schema migration during an incident: rejected because clients and durable removal intents may already depend on the added columns/functions.
- Keep every DDL, function, trigger, and seed statement in one transaction: rejected because early table locks would persist across roughly 2,500 lines of unrelated function installation; `lock_timeout` bounds only lock acquisition, not total lock-hold or statement duration.

**Verification path**: Static migration contract tests cover default/allowed modes, explicit strict activation inventory, protected-write pause, plaintext conversion admission, grants, restoration after finalization, transaction boundaries, `NOT VALID`/validation phases, timeout bounds, and final-tail trigger placement. PostgreSQL syntax/execution, live table-size timing, RLS behavior, old/new-client coexistence, per-owner strict promotion, and forward-retry drills remain `UNVERIFIED` until run against an authorized non-production Supabase target; Docker/PostgreSQL was unavailable locally.

## Decision 13 — Reject an Incomplete Permanent-Deletion Cutover

**Decision**: Do not ship the experimental remote permanent journal-entry ID registry or `delete_journal_entry_permanently` RPC in this wave. Keep the existing durable client tombstone path and idempotent owner-scoped table deletes. The journal-entry row is deleted first so the password-removal trigger is the admission fence; the exact paused-trigger error becomes a typed deferred queue outcome without consuming the failure budget. Connectivity aborts retain the existing one-second retry, while a server password-removal pause uses a separate capped schedule (15 seconds, 60 seconds, 5 minutes, then 15 minutes) and keeps that cap for later attempts. A lifecycle/durable wake may retry sooner, and an acknowledged commit removes the same operation identity and resets the backoff.

**Rationale**: Current rows and retained tombstones cannot distinguish an ID created after the proposed cutover from an unknown ID deleted before cutover and later replayed by a stale client. Seeding only currently visible rows would therefore label some historical IDs as new and could admit resurrection. No authorized complete historical source was available, and inventing one would violate the production-data boundary. The direct delete path is retryable, owner-scoped, and already has durable local tombstones; it does not claim server-transaction atomicity or global permanence.

**Alternatives considered**:

- Seed from current rows only: rejected because it omits pre-cutover deletions.
- Treat every unknown ID as historical forever: rejected because it would block legitimate future inserts without a safe admission mechanism.
- Restore IDs from the 898-file snapshot or synthetic history: rejected because neither is an authoritative production deletion ledger.
- Keep the RPC but call it only from new clients: rejected because the unsafe admission decision is server-side and still affects old-client replay.

**Verification path**: Static source tests assert that the lifecycle migration and RPC are absent. Sync tests cover entry-first admission, exact paused-error deferral, unrelated `55000` rejection, durable tombstones, distinct connectivity/server-pause retry timing, stable operation identity, eventual acknowledgement, owner revalidation, and metadata cleanup. Live remote deletion, stale-client replay, long-duration scheduling, and long-term server-side deletion permanence remain `UNVERIFIED` and are not release claims for Epic 002.

## Unresolved Evidence, Not Design Ambiguity

| Item | Status | Why it does not block design | Closure |
| --- | --- | --- | --- |
| Exact real-journal blocker | UNVERIFIED | All supported blocker classes fail closed without content access | User runs fixed privacy-safe preflight |
| Physical Android/iOS | UNVERIFIED | Native adapters already have explicit result boundaries | Exact-build device smoke |
| Native screen readers | UNVERIFIED | Automated semantics can be implemented without claiming human/device proof | TalkBack/VoiceOver review |
| Windows/Tauri runtime | UNVERIFIED | Build receipt and Web/Desktop contracts can be prepared safely | Windows runtime smoke |
| Ceremony artistic/user approval | UNVERIFIED | Missing evidence deterministically keeps the capability off | Exact-candidate critic and owner decision |
| Supabase migration/runtime RLS | UNVERIFIED | Source and static contracts can be reviewed without touching production | Apply and exercise expand/contract flow on an authorized non-production project before production rollout |
