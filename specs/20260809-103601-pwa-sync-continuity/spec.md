# Feature Specification: PWA Sync Continuity

**Feature Directory**: `specs/20260809-103601-pwa-sync-continuity`
**Created**: 2026-08-09
**Status**: Ready for scoped local implementation under the user's 2026-08-09 authorization; security/runtime/release gates remain open
**Input hash (SHA-256)**: `01e314478fd5b6c08b19d71655d2165c42a720878f4184f532ed778d04b41a08`

## Context and User Failure

ZenFlow currently has durable ordered sync, but the Web/PWA experience can blur four different truths: a change saved on this device, an outbound change still waiting, a change confirmed online, and an inbound account update applied locally. A person can therefore close or reopen the installed app without knowing whether their latest action is safe, waiting, or blocked. Storage exhaustion is especially dangerous because the cursor must not advance past an unapplied update, and a content-bearing fallback must not silently move private data into browser key-value storage.

Current local evidence anchors this feature in:

- `src/hooks/useDeltaSyncEffects.ts`: current owner-scoped queue drain occurs before delta fetch and blocks the pull while same-owner actions remain.
- `src/lib/offlineQueue.ts`: IndexedDB is primary, but failed writes can still create a content-bearing `localStorage` fallback journal.
- `src/storage/eventSync.ts`: inbound events and the cursor commit in one transaction; quota failure emits `zenflow:storage-full` and rethrows.
- `src/observability/syncHealthRecorder.ts`: diagnostics retain route strings, queue counts, cursor, and coarse receipts.
- `src/components/sync/SyncHealthCard.tsx` and `src/components/StorageErrorBanner.tsx`: the existing user surfaces show sync and storage state but do not yet express the complete four-state truth or a dedicated storage-full recovery contract.

## Clarifications

### Session 2026-08-09

- Q: Which runtime is the delivery target? → A: Installed PWA is primary; Web/Vite gets the same safe fallback; Android, iOS, and Desktop behavior must not change.
- Q: What ordering owns reopen synchronization? → A: Durable same-account outbound work drains before any delta pull; a remaining outbound action blocks the pull.
- Q: May new user content fall back to `localStorage`? → A: No on Web/PWA; the existing legacy queue journal may be read only for atomic migration into IndexedDB and deleted only after commit.
- Q: What happens when storage is full? → A: Keep the inbound cursor unchanged, preserve already durable local work, stop misleading retries, and show a calm recoverable incident without claiming online confirmation.
- Q: What may support diagnostics expose? → A: Only sanitized route identifiers, coarse state/counts/timing, and bounded receipt categories; no content, entity or operation IDs, raw URLs, OAuth material, or backend payloads.
- Q: Are schema or native wrapper edits authorized? → A: No schema, migration, Android, iOS, or Tauri edits are in scope.

## User Scenarios and Testing

### User Story 1 - Know whether a change is safe (Priority: P1)

As a person using ZenFlow offline or on an unstable connection, I need status language that distinguishes saved on this device, waiting to update my account, confirmed online, and an account update applied here, so I can close or retry without being misled.

**Why this priority**: Misstating durability or convergence can cause avoidable data loss and destroys trust in a wellbeing journal.

**Independent Test**: Drive each authoritative local/queue/receipt state with isolated test data and assert that exactly one truthful, localized status is announced without exposing record content or identifiers.

**Acceptance Scenarios**:

1. **Given** a local mutation has committed but its outbound action remains durable, **when** the status surface updates, **then** it says the change is saved on this device and still waiting, not confirmed online.
2. **Given** the outbound action is acknowledged by the ordered event path, **when** the receipt updates, **then** it may say the change was saved online.
3. **Given** an inbound delta commits with its cursor, **when** the receipt updates, **then** it may say account updates were applied on this device.
4. **Given** no client is running, **when** the person reads product help or status copy after reopening, **then** ZenFlow does not imply that a browser service worker guaranteed convergence while closed.

---

### User Story 2 - Reopen without losing outbound intent (Priority: P1)

As a person returning to the installed app after making offline changes, I need ZenFlow to send my durable changes before applying newer account deltas, so my latest action is not overwritten or falsely reported as synchronized.

**Why this priority**: Reopen is the highest-risk transition between local truth and remote ordering.

**Independent Test**: Hydrate a same-owner queued action, trigger startup/auth/online/visibility/broadcast recovery, and prove queue initialization and drain occur before delta fetch; prove an undelivered action prevents cursor fetch/apply.

**Acceptance Scenarios**:

1. **Given** a current-account action is durably queued, **when** the PWA reopens online, **then** queue hydration and processing complete before delta fetch begins.
2. **Given** processing leaves a current-account action pending or blocked, **when** reopen synchronization continues, **then** no delta is fetched or applied and the existing cursor is retained.
3. **Given** duplicate delivery of the same operation, **when** processing resumes, **then** the operation is acknowledged at most once and a newer durable operation is not deleted by an older completion.
4. **Given** a delta gap, **when** recovery runs after outbound work is clear, **then** the gap recovery path retains leader, sequence, idempotency, tombstone, and account-boundary rules.
5. **Given** the authenticated account changes during queue or delta work, **when** the old work settles, **then** it cannot acknowledge, apply, or advance state for the new account.

---

### User Story 3 - Recover honestly from storage exhaustion (Priority: P1)

As a person whose browser storage is full or unavailable, I need ZenFlow to stop before losing ordering evidence, retain recoverable data, and tell me what I can safely do next.

**Why this priority**: A false success or advanced cursor after a failed transaction can make remote data permanently invisible to that client.

**Independent Test**: Force quota failure during outbound persistence and inbound apply, then assert no new content-bearing browser key-value fallback is written, cursor remains unchanged, durable pre-existing rows remain, and one accessible storage incident is presented.

**Acceptance Scenarios**:

1. **Given** IndexedDB rejects a new Web/PWA outbound write, **when** ZenFlow cannot durably enqueue it, **then** it fails explicitly and does not copy its payload into `localStorage`.
2. **Given** quota failure occurs inside inbound apply, **when** the transaction rolls back, **then** entities and cursor both remain at their pre-transaction values.
3. **Given** storage-full is reported, **when** the incident surface appears, **then** it does not claim the change is online, identifies that saving is blocked, and offers only a retry that rechecks durable storage.
4. **Given** the same incident repeats, **when** UI state updates, **then** it is deduplicated rather than interrupting the person with repeated banners.

---

### User Story 4 - Migrate legacy fallback without resurrection (Priority: P2)

As a returning Web/PWA user with a legacy queue journal, I need ZenFlow to validate and atomically move valid pending actions into local truth before deleting the legacy copy, so interruption never drops or resurrects an action.

**Why this priority**: Removing the fallback writer without retaining safe one-way migration would strand real pending work from older builds.

**Independent Test**: Seed valid, conflicting, corrupt, and cleanup-failure legacy journals and prove the sequence validate → one IndexedDB transaction → confirm commit → delete exact legacy key.

**Acceptance Scenarios**:

1. **Given** a valid legacy journal, **when** migration runs, **then** every accepted row is owner-bound and committed before the legacy key is removed.
2. **Given** validation or the IndexedDB transaction fails, **when** initialization ends, **then** the legacy bytes remain unchanged and queue processing/delta pull do not proceed.
3. **Given** IndexedDB already contains a newer operation with the same logical identity, **when** migration runs, **then** the older fallback cannot erase or replace it.
4. **Given** commit succeeds but legacy deletion cannot be confirmed, **when** the next startup retries, **then** migration is idempotent and cannot duplicate or resurrect acknowledged work.

---

### User Story 5 - Share safe support details (Priority: P2)

As a person or release operator diagnosing sync, I need useful support details that show coarse continuity state without revealing my journal, habits, identifiers, raw route parameters, or sign-in secrets.

**Why this priority**: Diagnostics are useful only if they are safe to inspect in a public-page session or support workflow.

**Independent Test**: Inject canary values into content, IDs, operation IDs, raw query/hash, OAuth-style parameters, and error messages; assert none appear in the diagnostic snapshot, receipts, events, DOM, logs captured by the test, or serialized support output.

**Acceptance Scenarios**:

1. **Given** an opt-in diagnostics session on a route containing query and hash canaries, **when** a snapshot is read, **then** it contains only an allowlisted route identifier.
2. **Given** queue and delta events contain private canaries, **when** receipts are recorded, **then** only allowlisted category, count, timing, and coarse error class fields remain.
3. **Given** diagnostics are not explicitly enabled outside development, **when** runtime starts, **then** no global diagnostic recorder is installed.

## Edge Cases

- The current owner has no queued actions but other-owner or ownerless legacy rows remain quarantined.
- Queue hydration is slower than auth restoration or the first visible/online signal.
- A second tab wins the leader lock while the first tab receives the wake-up.
- Connectivity disappears during an outbound handler, or a handler ignores abort until after account switch.
- A newer operation reuses a logical entity while an older delivery completes late.
- Delta fetch succeeds but apply fails because storage becomes full.
- A delta batch contains only events from the current device; cursor update still must be atomic.
- A gap recovery or snapshot fallback begins only after the same-owner outbound barrier clears.
- A legacy journal is corrupt, incomplete, from another account, or conflicts at equal ordering time.
- Legacy migration commits but exact-key deletion throws or cannot be observed.
- Browser private mode denies IndexedDB, `localStorage`, or both.
- Diagnostics receive extremely long route, error, action, or receipt strings.
- Eight-locale copy expands on a narrow installed-PWA viewport; Arabic and Hebrew mix numbers with RTL text.
- The app closes with pending work; later language must state that delivery resumes when a client can run, not that closed-client convergence is guaranteed.

## Requirements

### Functional Requirements

- **FR-001**: The status experience MUST expose the exact read-only view contract `SyncContinuityState { phase, localSavedAt, outboundPendingCount, confirmedOnlineAt?, inboundAppliedAt?, degradedReason? }`, derived only from existing local commit receipts, durable outbound queue, confirmed ordered-event receipts, and committed inbound-delta/cursor evidence. It MUST NOT persist, mutate sync state, or become a new authority, and MUST NOT infer success from connectivity, animation, elapsed time, or an empty in-memory view.
- **FR-002**: The experience MUST distinguish the four states `saved_on_device`, `outbound_pending`, `confirmed_online`, and `inbound_applied` in accessible localized language.
- **FR-003**: Product copy MUST state that closed-client delivery is not guaranteed and that pending work resumes when a capable ZenFlow client runs with connectivity.
- **FR-004**: Every startup, sign-in, online, visible/resume, periodic, and broadcast-triggered delta path MUST await durable queue initialization and attempt current-owner outbound drain before delta fetch.
- **FR-005**: Any current-owner outbound action that remains after the drain attempt MUST block delta fetch/apply and MUST leave the cursor unchanged.
- **FR-006**: Queue and delta work MUST retain the existing leader-lock, operation identity, sequence/gap, duplicate-delivery, tombstone, and account-boundary contracts.
- **FR-007**: A failed or rolled-back inbound apply MUST leave both entity state and cursor unchanged.
- **FR-008**: A storage-full failure MUST create one deduplicated, accessible incident that distinguishes blocked local saving from online confirmation and exposes a bounded retry only when retry is safe.
- **FR-009**: Retry after storage-full MUST recheck durable storage and MUST NOT discard, overwrite, or mark pending work confirmed merely to clear the incident.
- **FR-010**: Web/PWA runtime MUST NOT create or update a content-bearing `localStorage` fallback or lifecycle snapshot when IndexedDB persistence fails or the document exits. This includes `savePendingQueueSnapshot({ includeQueueSnapshot: true })`, `SK.LAST_STATE`, and full offline-action payload fallback paths; current-session memory may remain, but the UI MUST say not saved, offer Retry/safe exit, and emit no successful durable receipt.
- **FR-011**: Existing non-content flags and preferences are outside this feature unless they are part of the exact legacy queue migration boundary; this feature MUST NOT broaden into a repository-wide storage rewrite.
- **FR-012**: The existing legacy offline-queue journal MUST remain readable only for one-way migration using the sequence validate complete shape and ownership → commit accepted changes atomically to IndexedDB → confirm committed result → remove the exact legacy key.
- **FR-013**: If any legacy validation, conflict-resolution, transaction, or cleanup confirmation step fails, initialization MUST fail closed, preserve recoverable legacy data, and block queue processing/delta pull until a later safe retry.
- **FR-014**: Repeated legacy migration MUST be idempotent and MUST preserve a newer durable operation over an older or ambiguous fallback record.
- **FR-015**: Diagnostics MUST use an explicit allowlist and MUST exclude user content, entity IDs, queue IDs, operation IDs, device IDs, raw URLs, query values, hash values, OAuth codes/tokens/state, backend payloads, and arbitrary error messages.
- **FR-016**: Diagnostic routes MUST be bounded symbolic route identifiers; no snapshot or receipt may retain `window.location.search` or `window.location.hash`.
- **FR-017**: Diagnostic receipts MUST be bounded by count and string length and limited to coarse event category, source category, safe counts, safe timing, and allowlisted error class.
- **FR-018**: Diagnostic opt-in MUST remain explicit outside development and MUST NOT create persistence containing user content.
- **FR-019**: All new visible strings MUST exist for en, uk, es, de, fr, ja, ar, and he, preserve placeholder parity, avoid implementation language, and remain safe for RTL/bidi rendering.
- **FR-020**: The change MUST use existing SyncHealth/StorageError surfaces, theme tokens, polite live regions, keyboard access, and at least 44px retry targets; it MUST NOT add a competing overlay owner.
- **FR-021**: The implementation MUST NOT add or modify a database schema, Supabase migration, Android/Capacitor source, iOS/WKWebView source, Tauri source, dependency, service, or production dataset.
- **FR-022**: No test fixture, canary, fake receipt, or synthetic history used for verification may be reachable from production runtime or a real-user sink.
- **FR-023**: UI text `Last sync` MUST be shown only when `confirmedOnlineAt` exists from an online receipt. Otherwise the surface MUST use `Last activity` based on safe local/inbound activity and MUST NOT imply remote confirmation.
- **FR-024**: This feature MUST NOT silently redesign the current JS-readable Supabase session architecture. The security/release status remains `STOP` until the security owner accepts the documented residual risk or opens a separately authorized auth-hardening feature.
- **FR-025**: PWA-to-Android/iOS/Desktop and reverse handoff parity MUST remain `UNVERIFIED` until each platform owner supplies a hash-bound result for the same contract/tree; local Web/PWA evidence cannot promote native parity.

### Key Entities

- **Sync truth state**: A derived, non-persisted presentation state with one of four evidence-backed user meanings plus offline, paused, blocked, and unavailable qualifiers.
- **Durable outbound action**: Existing account-bound queued intent identified by durable operation identity, priority, retry state, and safe domain category; payload and identifiers are never presentation/diagnostic data.
- **Inbound cursor**: Existing ordered sequence checkpoint committed atomically with applied inbound events.
- **Legacy queue journal**: Existing content-bearing browser key-value record accepted only as migration input; never a destination for new writes after this feature.
- **Storage incident**: Ephemeral UI state describing durable-storage failure category, recoverability, and a bounded retry action without private error detail.
- **Diagnostic receipt**: Ephemeral allowlisted support record containing only coarse category/source, bounded counts/timing, and sanitized route identity.

## Non-Goals

- No new sync entity, conflict algorithm, cursor, queue schema, Dexie version, Supabase table/function/policy, or server behavior.
- No guarantee that a service worker completes sync after every PWA window is closed.
- No repository-wide removal of non-content `localStorage` preferences or legacy migrations outside the offline-queue boundary.
- No Android, iOS, Tauri, native lifecycle, signing, store, deployment, or release publication work.
- No display of record titles, journal text, habit names, entity IDs, operation IDs, device IDs, or raw support URLs.
- No silent deletion, compaction, or substitution of pending user work to obtain a green status.
- No synthetic production history, demo data, or fabricated sync receipts.

## Assumptions and Dependencies

- IndexedDB/Dexie remains local truth and the current offline queue table remains available without a schema change.
- Existing owner validation, origin-exclusive locks, leader lock, ordered event log, tombstones, and `applyDelta()` transaction semantics remain authoritative.
- Existing `SyncHealthCard`, `StorageErrorBanner`, and eight-locale i18n system are the intended presentation owners.
- Existing valid legacy queue rows can be represented in the current offline queue table; incompatible or ambiguous rows fail closed rather than being guessed.
- Native wrappers consume shared web assets, so shared-module compatibility must be checked even though native behavior changes are forbidden.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In automated state-table coverage, 100% of the four sync truths render distinct user meaning and no state claims online confirmation without a confirmed ordered receipt.
- **SC-002**: Across startup, sign-in, online, visible/resume, periodic, and broadcast triggers, 100% of tested delta fetches occur after queue initialization and a successful current-owner drain.
- **SC-003**: In every tested remaining-pending or blocked-current-owner case, delta fetch count is zero and the persisted cursor is byte-for-byte unchanged.
- **SC-004**: In quota-failure tests, entity rows, cursor, and pre-existing durable outbound rows retain their pre-attempt values, and new content-bearing `localStorage` writes equal zero.
- **SC-005**: Valid legacy migration produces one durable copy of each accepted operation and removes the exact legacy key only after commit; each injected failure point retains a recoverable source and produces no duplicate.
- **SC-006**: Diagnostic canary tests find zero occurrences of content, IDs, raw query/hash values, OAuth-style secrets, payloads, or arbitrary error messages in snapshots, receipts, emitted events, visible DOM, and captured logs within the tested scope.
- **SC-007**: The storage-full incident is announced once per active incident, offers a keyboard-accessible retry target of at least 44px, and does not use color as its only meaning.
- **SC-008**: All new translation keys have exact parity across eight locales and pass bidi/placeholder checks; human native-speaker quality remains `UNVERIFIED` until reviewed.
- **SC-009**: Focused regression tests, typecheck, lint, sync contract, translation checks, production-data-integrity checks, security scan, production build, and installed-PWA browser scenarios complete with no feature-attributable failure before release consideration.
- **SC-010**: Git diff contains no schema, migration, Android, iOS, Tauri, dependency, production-data, or generated architecture-count changes.
- **SC-011**: Focused tests prove zero content-bearing `SK.LAST_STATE`/offline-queue `localStorage` writes across beforeunload, IndexedDB failure, journal/mood/habit canaries, and A→B account switch; failed durability produces no success receipt.
- **SC-012**: State-table tests prove `Last sync` appears only with `confirmedOnlineAt`; security stays `STOP` for JS-readable session risk, and native handoff rows remain `UNVERIFIED` without hash-bound owner receipts.

## Platform and Domain Matrix

| Surface | Intended impact | Pre-implementation status |
| --- | --- | --- |
| Web/Vite | Same truthful sync states, no new content fallback, legacy migration, storage incident, sanitized diagnostics. | SPECIFIED; runtime UNVERIFIED |
| Installed PWA | Primary reopen/offline/storage-full user journey; no closed-client guarantee. | SPECIFIED; installed runtime UNVERIFIED |
| Android/Capacitor | No behavior or native-file change; shared-module compatibility must remain. | NO INTENDED IMPACT; compatibility UNVERIFIED |
| iOS/WKWebView | No behavior or native-file change; shared-module compatibility must remain. | NO INTENDED IMPACT; compatibility UNVERIFIED |
| Desktop/Tauri | No behavior or native-file change; shared-module compatibility must remain. | NO INTENDED IMPACT; compatibility UNVERIFIED |
| Store/Release | No publish, deploy, metadata, signing, or rollout authorized. | N/A for implementation; release UNVERIFIED |
| Accessibility | Polite status announcements, non-color meaning, keyboard retry, 44px target, RTL/bidi. | SPECIFIED; rendered proof UNVERIFIED |
| Performance | No extra startup network request; queue/migration work remains bounded and receipt history capped. | SPECIFIED; measured proof UNVERIFIED |
| Security/Privacy | Content/ID/URL/OAuth exclusion; no new content-bearing fallback or logs. | SPECIFIED; scanner/runtime proof UNVERIFIED |
| Testing/Operations | RED/GREEN, failure injection, artifact hashes, rollback and incident evidence. | PLANNED; execution UNVERIFIED |

## Acceptance and Kill Criteria

Implementation may proceed only after cross-artifact analysis maps every FR/SC and reports zero unresolved active-policy CRITICAL or STOP findings. Release remains stopped if any current-owner pending action permits delta pull, any quota path advances the cursor, any new content reaches `localStorage`, any diagnostic canary leaks, or any native/schema path changes. Live same-account, multi-device, public deployment, native compatibility, and human translation approval remain separate evidence gates and cannot be inferred from local tests.

## UNVERIFIED Ledger

| Item | Why not proved in specification phase | Required proof |
| --- | --- | --- |
| Installed Chrome/Edge PWA reopen | No runtime implementation or browser session was executed. | Production-equivalent build installed and reopen/offline scenarios captured. |
| Safari installed web app | No macOS/iOS Home Screen runtime was exercised. | Manual lifecycle/storage check on exact target. |
| Live same-account convergence | No credentials or production write are authorized. | User-assisted `smoke:sync-account` against dedicated marked account. |
| Android/iOS/Desktop compatibility | Native owners have not supplied receipts. | Platform-owner build/runtime receipts after shared changes. |
| Human translation quality | No native-speaker review occurred. | Review of all new strings, especially ar/he bidi. |
| Public deployment | Deploy is outside authorization. | Cache-busted public URL verified after separate deploy decision. |
