# Feature Specification: Product Regression Recovery

**Feature Branch**: `codex/002-product-regression-recovery`

**Feature ID**: `002-product-regression-recovery`

**Created**: 2026-08-03

**Status**: Draft

**Input**: Restore journal visibility and reliable password-protection removal, classify missing product functions from authoritative state, and admit the journal save ceremony only after its platform, accessibility, performance, visual, and user gates pass. Preserve every existing user record; never substitute production data or infer success from missing evidence.

## Confirmed Baseline and Evidence Boundary

- The branch starts from commit `13ca51a80d23220574deba762851fe5a32372e46`, which matched `origin/main` when the isolated worktree was created.
- The current public application reproduces a generic “nothing changed” failure while removing journal protection. The exact failing object and real-data root cause are **UNVERIFIED** because no user journal contents, keys, or production-derived records were inspected.
- Current source shows that password removal and journal-page loading both depend on all requested protected objects being readable. This is local source evidence for a failure class, not proof that it is the user’s exact production failure.
- Existing focused journal-security tests are baseline evidence only. New regression tests MUST fail against the current implementation before product code changes and MUST exercise isolated fixtures, never production-derived data.
- The Spec Kit constitution is `PROPOSED`; `AGENTS.md` and its referenced policies remain binding.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remove Journal Protection Without Losing Data (Priority: P1)

As a person who can unlock a protected journal, I can remove password protection only when every protected local object can be safely converted, so that a failure never deletes, resets, replaces, or makes my journal inaccessible.

**Why this priority**: The current public failure blocks a security-sensitive action and can leave the person unable to understand whether protection changed. A wrong recovery action risks irreversible loss of private journal content.

**Independent Test**: Starting with an isolated protected journal fixture, exercise removal across healthy, locked, revision-mismatch, unreadable-object, account-switch, concurrent-tab, offline-cleanup, and retry states. The slice delivers value when healthy data becomes readable without a password, blockers leave all protected data unchanged, and post-local cleanup failures are reported as partial success.

**Acceptance Scenarios**:

1. **Given** an unlocked journal whose protected entries, media, drafts, spaces, and captures all belong to the active owner and expected vault revision, **When** the person confirms removal, **Then** local protection is removed atomically and the journal remains readable after reload and a new session.
2. **Given** any protected object cannot be decrypted, **When** removal is requested, **Then** no journal row, password verifier, or vault metadata is destructively changed; an owner-bound operation record may retain only the privacy-safe blocker and retry state, and the dialog names an applicable recovery action.
3. **Given** the active account or vault revision changes after the initial check, **When** the local transaction is about to begin, **Then** the operation stops before mutation and reports the specific blocker.
4. **Given** local protection has been removed successfully but native biometric cleanup or cloud cleanup is pending, **When** the operation completes, **Then** the person sees that protection on this device was removed and that additional cleanup will retry; the interface MUST NOT claim that nothing changed.
5. **Given** a prior removal attempt was interrupted, **When** the same owner retries after restart, **Then** the resumable operation continues idempotently without duplicating destructive work or crossing account boundaries.
6. **Given** the journal is locked, activation is pending, or a migration intent is unresolved, **When** removal is requested, **Then** the operation produces the corresponding typed blocker and offers only an applicable next action.

---

### User Story 2 - Read Every Recoverable Journal Entry (Priority: P1)

As a person opening the journal, I can still see every entry that is safely readable even when another object is unavailable, so that a single damaged or incompatible object does not make the whole journal appear empty or broken.

**Why this priority**: Hiding all readable entries converts a localized failure into apparent data loss and can undermine trust in the journal.

**Independent Test**: Load a page containing readable and intentionally unreadable isolated records. The page must return and render all readable records plus only a privacy-safe unavailable count; it must not expose encrypted content, raw identifiers, fake cards, or private content in diagnostics.

**Acceptance Scenarios**:

1. **Given** a page contains nine readable entries and one entry that cannot be decrypted, **When** the journal loads, **Then** the nine readable entries appear in stable order and the interface reports one unavailable entry without creating a placeholder entry.
2. **Given** an unavailable record contains encrypted text and private identifiers, **When** the failure is reported, **Then** neither value appears in the screen, analytics, console, logs, error messages, or support-safe receipt.
3. **Given** every requested entry is unavailable, **When** the page loads, **Then** the interface presents an unavailable state and exact safe count, not a verified-empty journal state.
4. **Given** the journal is confirmed empty, **When** it loads, **Then** the normal empty experience remains distinct from degraded or unavailable data.

---

### User Story 3 - Understand Why a Product Function Is or Is Not Available (Priority: P2)

As a person using ZenFlow on any supported surface, I see functions that I am actually eligible to use and a clear, safe explanation for functions that are temporarily unavailable, while experiments and security-blocked functions remain intentionally controlled.

**Why this priority**: Current gates combine local preferences, onboarding unlocks, remote rollouts, kill switches, compile-time capabilities, and at least one false journal count. Silent boolean hiding makes a real function look lost and makes deployment regressions difficult to diagnose.

**Independent Test**: Evaluate a manifest of gated functions against authoritative local state and controlled rollout inputs. Each function must resolve to one explicit availability state and source; the existing boolean consumer remains compatible.

**Acceptance Scenarios**:

1. **Given** a function depends on journal activity, **When** eligibility is evaluated, **Then** the real locally derived count is used instead of a constant zero.
2. **Given** a function is enabled and all release and user conditions are satisfied, **When** its surface renders, **Then** the function is visible and usable.
3. **Given** a function is temporarily unavailable, **When** its surface is appropriate for disclosure, **Then** the interface can provide a natural-language reason without exposing internal flag names.
4. **Given** a function is experimental, killed for safety, or lacks required API, billing, privacy, native, or release proof, **When** availability is evaluated, **Then** it remains intentionally hidden or blocked and the support-safe receipt records the reason class without user data.
5. **Given** an existing consumer calls the compatibility visibility API, **When** availability is evaluated, **Then** it receives the same boolean projection as the structured result.

---

### User Story 4 - Experience a Safe Journal Save Ceremony (Priority: P3)

As a person saving a journal entry, I may receive a calm visual confirmation near the saved entry only when that experience is demonstrably safe, accessible, performant, and approved; otherwise I receive the existing static confirmation.

**Why this priority**: The ceremony is enhancement, not data integrity. It must never obscure save state, trap navigation, increase pressure, or ship merely because assets render in tests.

**Independent Test**: Exercise the ceremony behind one explicit release capability across web/PWA and build configurations for Android, iOS, and Desktop. Confirm fallback behavior for reduced motion, low battery/runtime strain, repeated save, navigation, background/foreground, offline queue, and sync failure. Production enablement is rejected until independent visual critique and user visual approval are recorded.

**Acceptance Scenarios**:

1. **Given** save succeeds and the ceremony is admitted, **When** confirmation appears, **Then** it is visually associated with the saved entry, uses a non-opaque focus veil, announces save state accessibly, and never delays or blocks navigation.
2. **Given** reduced motion, low-battery policy, or runtime strain applies, **When** save succeeds, **Then** the static confirmation is shown without loss of information.
3. **Given** save is queued offline or sync later fails, **When** local save completes, **Then** the ceremony does not misrepresent cloud synchronization as complete.
4. **Given** technical gates pass but artistic critique or user visual approval is missing, **When** a production build is created, **Then** the ceremony remains disabled by the release capability.
5. **Given** the capability is rolled back, **When** the next build is produced, **Then** all supported release entry points return to the static confirmation without a data migration.

---

### User Story 5 - Verify and Roll Back Each Recovery Wave (Priority: P2)

As the product owner, I can review each regression-recovery wave independently, see what is proven on each platform, and roll it back without restoring an unreviewed historical snapshot.

**Why this priority**: The repository contains a large historical snapshot and multiple platform/release gates. A mass restore could reintroduce stale architecture, data risks, or unrelated behavior.

**Independent Test**: For each reviewable wave, bind the symptom, diagnosed cause, changed contract, regression test, platforms, commit, CI run, and runtime evidence. The wave is rejected if evidence belongs to a different commit or if required scanners/tests were weakened.

**Acceptance Scenarios**:

1. **Given** a suspected historical regression, **When** no current reproduction and causal link exist, **Then** no product code is restored for that symptom.
2. **Given** a wave is ready for review, **When** its evidence packet is inspected, **Then** every claim points to fresh local, CI, browser, build, or device evidence or is explicitly `UNVERIFIED`.
3. **Given** a merged wave causes harm, **When** rollback is invoked, **Then** the wave can be reverted or disabled without deleting or rewriting user data.

### Edge Cases

- A protected journal is genuinely empty versus appearing empty because its objects are unreadable.
- The person enters a correct password but the in-memory vault key is absent, stale, or belongs to another revision.
- A migration or earlier removal intent is pending, stale, partially applied, or owned by another account.
- Exactly one entry, media item, draft, space, or capture cannot be decrypted while all other objects are readable.
- The account changes in another tab between preflight and mutation; the same account changes vault revision concurrently.
- Two tabs start removal at nearly the same time; a second click occurs while an operation is in progress.
- The application closes after local commit but before biometric cleanup or cloud removal is queued.
- The device is offline after local removal, the queue is replayed twice, or cloud removal is already complete.
- A newer protected journal row appears remotely after local preflight, an older client still uploads encrypted data, or the remote vault revision changes before cleanup.
- Sign-out or account switch starts while a local-success/cloud-cleanup-pending removal intent is the only durable copy of unfinished work.
- A stale tab writes with an older journal bundle, a future client leaves a newer intent version, or malformed intent data is present.
- A plaintext replacement for encrypted media uploads successfully but its metadata commit fails, or metadata commits while deletion of the superseded encrypted blob fails.
- The remote full-account backup still contains encrypted journal fields after local protection is removed; non-journal backup domains must remain untouched.
- Native biometric storage reports failure or is unavailable on Web, Android, iOS, or Desktop.
- A journal page contains duplicate timestamps, pagination boundaries, or all-unreadable records.
- RTL copy expands, system font size increases, screen reader focus moves through the dialog, or the viewport is narrow with keyboard visible.
- Escape or Android Back is pressed while confirmation is idle, while preflight is running, and after partial local success.
- A rollout is stale or unreachable, a compile-time capability differs among release entry points, or a kill switch is active.
- A save is repeated, cancelled by navigation, backgrounded, resumed, queued offline, or followed by sync failure.
- A browser supports the animation runtime but reduced motion, low battery, constrained memory, or runtime strain requires the static path.
- A historical snapshot contains code that no longer matches current storage, sync, localization, or platform contracts.

## Requirements *(mandatory)*

### Explicit Requirements

- **FR-001**: The system MUST perform a read-only password-removal preflight before any journal protection data is changed.
- **FR-002**: The preflight MUST validate active-owner boundary, expected vault revision, unresolved migration/removal intent, lock/activation state, and decryptability of protected entries, media, drafts, spaces, and captures.
- **FR-003**: The password-removal contract MUST distinguish `ready`, `unlock-required`, `activation-pending`, `vault-revision-mismatch`, `decrypt-entry`, `decrypt-media`, `decrypt-draft`, `decrypt-space`, `decrypt-capture`, `owner-changed`, and `storage-failed` outcomes.
- **FR-004**: A non-ready preflight MUST leave journal rows, password verifier, vault metadata, biometric credentials, and cloud-removal delivery unchanged. Its owner-bound operation record MAY retain only the privacy-safe blocker and retry state.
- **FR-005**: The operation MUST bind its durable intent to the active owner and expected vault revision.
- **FR-006**: The system MUST revalidate owner and vault revision immediately before the local protection-removal transaction.
- **FR-007**: The local mutation MUST atomically convert all protected local objects and remove local password/vault metadata, or change none of them.
- **FR-008**: Native biometric cleanup and cloud-removal delivery MUST be resumable and idempotent after local success.
- **FR-009**: A biometric or cloud-cleanup failure after local success MUST be reported as partial success and MUST NOT claim that nothing changed.
- **FR-010**: Retrying or restarting a removal operation MUST NOT duplicate destructive work, resurrect protection, or cross an account boundary.
- **FR-011**: The system MUST NOT automatically delete, reset, replace, fabricate, or silently skip protected user data to make removal succeed.
- **FR-012**: A real-user password-removal action MUST be performed by the user or require separate just-in-time confirmation; implementation and automated verification MUST NOT execute that production action.
- **FR-013**: Journal page reads MUST return every safely readable entry even when another requested entry is unavailable.
- **FR-014**: A journal page result MUST distinguish a confirmed empty page from a degraded page and include an exact `unavailableCount` for requested records that cannot be safely read.
- **FR-015**: The UI MUST NOT create fake or empty entry cards for unavailable records.
- **FR-016**: Screens, diagnostics, logs, analytics, receipts, and errors MUST NOT reveal ciphertext, raw record identifiers, journal text, media, drafts, spaces, captures, or keys.
- **FR-017**: The removal dialog MUST remain open for actionable blockers and present a recovery action specific to the blocker class.
- **FR-018**: The dialog MUST preserve focus containment, predictable initial focus, screen-reader naming, Escape behavior, Android Back behavior, and touch targets of at least 44 by 44 CSS pixels.
- **FR-019**: Security and recovery messages MUST be natural and complete in `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, and `he`, with safe RTL layout for Arabic and Hebrew.
- **FR-020**: The application MUST maintain an inventory of runtime, remote-rollout, kill-switch, unlock-condition, and build-time gates that affect function availability.
- **FR-021**: Eligibility inputs MUST come from authoritative current state; journal-dependent eligibility MUST NOT use a hardcoded zero count.
- **FR-022**: Function availability MUST expose `visible`, a stable reason class, and a source class while preserving the existing boolean visibility interface as an adapter.
- **FR-023**: Every inventoried function MUST resolve to exactly one supported state: available, temporarily unavailable with a user-safe reason, experimental and intentionally hidden, or blocked by a demonstrated release/security condition.
- **FR-024**: Availability reasons shown to users MUST avoid internal flag names, implementation jargon, or unsupported promises.
- **FR-025**: The support-safe capability receipt MUST contain no user content, identifiers, credentials, precise activity history, or production-derived records.
- **FR-026**: AI Coach, rewards, animation runtimes, and services requiring unapproved APIs, paid dependencies, or missing security/platform proof MUST remain disabled.
- **FR-027**: Availability review MUST cover auth/onboarding/recovery; orb/mood; habits/garden/tasks/focus; diary; stats/achievements/friends/challenges; settings/sync/import/export/delete; PWA/offline/update; and Android/iOS/Desktop shells.
- **FR-028**: The journal save ceremony MUST be controlled by one explicit production capability consistently applied to Pages, Android, iOS, and Desktop release entry points.
- **FR-029**: The ceremony capability MUST have an explicit kill switch and reversible rollback that requires no user-data migration.
- **FR-030**: The ceremony MUST appear in relation to the saved entry, use a transparent focus veil, preserve navigation, and distinguish local save from pending or failed synchronization.
- **FR-031**: Repeated save, page close, background/foreground, offline queue, and sync-error behavior MUST not duplicate, strand, or falsely confirm the ceremony.
- **FR-032**: Reduced-motion, low-battery, and runtime-strain conditions MUST use the existing static confirmation without loss of save information.
- **FR-033**: Production enablement of the ceremony MUST remain off until technical, accessibility, performance, visual-runtime, independent artistic/craft, and explicit user visual-approval gates are each recorded for the exact candidate.
- **FR-034**: Other disabled animation flags MUST be inventoried and remain disabled unless their intended production use and the same applicable release gates are demonstrated.
- **FR-035**: Historical code or snapshots MUST be restored only after current reproduction, architecture comparison, causal evidence, and focused regression proof; mass restoration is forbidden.
- **FR-036**: Recovery work MUST be split into independently reviewable, rollback-capable waves and later waves MUST start from the updated accepted baseline.

### Implied Requirements

- **FR-037**: Removal decisions MUST be based on a single captured operation boundary and defend against time-of-check/time-of-use changes.
- **FR-038**: Cross-tab and restart behavior MUST converge through durable owner-bound operation state rather than relying only on component memory.
- **FR-039**: Cleanup delivery MUST tolerate duplicate execution and offline replay without changing the final intended state.
- **FR-040**: Privacy-safe diagnostics MUST identify stage, blocker class, platform class, and operation correlation without capturing private content or stable user identifiers.
- **FR-041**: The journal UI MUST distinguish loading, verified empty, partially available, unavailable, locked, activation-pending, removal-in-progress, removal-blocked, locally removed/cleanup-pending, and fully removed states.
- **FR-042**: Error recovery MUST never advise destructive reset as the default response to decryptability, revision, owner, or storage failures.
- **FR-043**: Existing encrypted data and prior supported vault revisions MUST remain readable or fail closed with a recovery path; silent format coercion is forbidden.
- **FR-044**: The release must preserve Indexed local truth, offline-first behavior, and existing cloud sync/deletion ordering; cloud state MUST NOT overwrite a newer local security decision.
- **FR-045**: The browser/PWA lifecycle MUST handle reload, stale service worker, offline transition, and background/foreground without losing a pending removal or save outcome.
- **FR-046**: Android, iOS, and Desktop adapters MUST explicitly classify unsupported or failed biometric cleanup instead of treating it as successful.
- **FR-047**: Keyboard-only, screen-reader, increased-text, narrow viewport, safe-area, LTR, and RTL states MUST have testable expected behavior.
- **FR-048**: The implementation MUST avoid long main-thread blocking for page recovery, preflight, and ceremony playback and MUST respect existing startup, bundle, and runtime budgets.
- **FR-049**: New first-party code MUST pass applicable static security scanning, dependency audit, production-data-integrity scanning, type checking, linting, focused and blast-radius tests without weakened guards.
- **FR-050**: Build, CI, and public-runtime evidence MUST identify the exact source commit and capability receipt; evidence from another commit MUST be rejected.
- **FR-051**: Required platform or human proof that was not executed MUST remain explicitly `UNVERIFIED`; local web tests MUST NOT be generalized to native devices or assistive technologies.
- **FR-052**: Every symptom MUST be traceable to diagnosis, changed requirement/contract, regression test, affected platform, and retained evidence.
- **FR-053**: Rollback MUST preserve all user data and MUST not require force push, history rewrite, broad database mutation, or restoration of the 898-file snapshot.
- **FR-054**: No paid service, new production dependency, or production API permission MAY be added without separate explicit user approval.
- **FR-055**: Test fixtures MAY model failure states only inside isolated tests and MUST be unreachable from production runtime and bundles.
- **FR-056**: All user-facing status copy MUST describe what happened, what remains safe, and the next action without blame, pressure, diagnosis, or unsupported certainty.
- **FR-057**: The availability manifest and security-operation state MUST have versioned compatibility behavior so a prior release or stale tab fails safely.
- **FR-058**: Concurrent writes during preflight or conversion MUST either be included under the validated revision/transaction or cause a fail-closed retry; they MUST NOT be silently omitted.
- **FR-059**: A cleanup retry MUST be observable to the user where action is required and quietly resumable where no action is required.
- **FR-060**: Release decisions MUST keep technical rendering, visual-runtime correctness, artistic/craft judgment, and user approval as separate evidence gates.
- **FR-061**: After local protection is removed, cloud cleanup MUST NOT run the global merge/import path against a backup that can reintroduce or require the removed local vault; journal cleanup MUST use a journal-scoped, push-only, owner-bound path.
- **FR-062**: Remote plaintext journal entries and media replacements, and the journal segment of the remote backup, MUST be durably committed before remote vault metadata is deleted.
- **FR-063**: Remote vault deletion MUST compare-and-set the expected remote vault revision and treat abort, timeout, network failure, or a zero-row delete as pending cleanup rather than success.
- **FR-064**: A superseded encrypted media blob MUST be deleted only after its plaintext replacement upload and metadata commit succeed; retry MUST tolerate either blob already being present or absent.
- **FR-065**: If cloud verification finds a new, extra, stale-client, or otherwise still-protected remote journal object, the system MUST retain the remote vault and report cleanup pending without deleting or fabricating any object.
- **FR-066**: Biometric cleanup MUST revalidate the captured owner boundary immediately before acting on the installation-wide native credential, and an owner change MUST leave that credential untouched for an explicit retry.
- **FR-067**: Any unresolved owner-bound removal operation MUST count as a durable pending owner write for sign-out, account-switch, and local-realm purge decisions until cleanup completes or the user separately authorizes a safe disposition.
- **FR-068**: Recovery and enqueue of unfinished removal operations MUST be owned by an application-lifecycle coordinator that runs without requiring the journal route or settings panel to mount.
- **FR-069**: A malformed or unsupported future-version removal intent MUST fail closed as `storage-failed`; it MUST NOT be treated as absent, overwritten, discarded, or silently downgraded.
- **FR-070**: Starting a removal MUST not overwrite another unresolved removal operation. A duplicate operation for the same owner/revision MUST resume idempotently; a conflicting owner/revision MUST stop with a typed blocker.
- **FR-071**: Immediately before the local transaction writes prepared rows, it MUST verify that the protected-row snapshot still matches the preflight snapshot; a change outside the normal lock path MUST abort without overwriting the newer row.
- **FR-072**: The feature-gate manifest MUST be versioned, identify each key and decisive source, define whether a hidden reason may be disclosed, and fail closed for an unknown key or missing consumer; missing persisted booleans MUST NOT default an unreviewed feature to visible.
- **FR-073**: Anonymous or stale design-rollout bucketing MAY control only reversible visual variants and MUST NOT be reused as a security, privacy, billing, data-migration, or release kill switch.
- **FR-074**: Rewards and every other release-blocked capability MUST have a fail-closed default at each consumer; a local hook default MUST NOT silently override the manifest or release decision.
- **FR-075**: Ceremony admission requirements MUST define an actual saved-entry anchor and distinct local-saved, cloud-pending, and cloud-failed presentation semantics; absence of either keeps production enablement blocked.

### Platform Matrix

| Surface | Required behavior | Required evidence before PASS |
| --- | --- | --- |
| Web/Vite | Safe preflight/removal, partial journal reads, availability states, keyboard and responsive dialog | Focused tests, type/lint/build, browser reproduction and post-fix trace on exact build |
| PWA | Offline cleanup retry, reload/update recovery, no stale-bundle misdiagnosis | Production-equivalent service-worker smoke and cache-busted public runtime after deploy |
| Android/Capacitor | Android Back, biometric cleanup classification, safe-area/touch targets, lifecycle retry | Android build plus emulator/device smoke; physical device remains `UNVERIFIED` unless run |
| iOS/WKWebView | Biometric cleanup classification, lifecycle/safe-area/text behavior | iOS build plus simulator/device smoke; physical device remains `UNVERIFIED` unless run |
| Desktop/Tauri | Explicit biometric capability behavior, keyboard/Escape, build flag parity | Tauri build and runtime smoke on tested OS; Windows remains `UNVERIFIED` unless run |
| Store/Release | One capability receipt, kill switch, exact commit, staged rollback | Exact-commit CI, signed/release configuration checks, deployment receipt |
| Accessibility | Focus, announcements, 44px targets, reduced motion, text reflow, RTL | Automated checks plus keyboard/screen-reader review; native assistive technology is separate proof |
| Performance | Bounded page/preflight work, static degraded motion, bundle/runtime budgets | Focused timings, production build budget, Chrome performance smoke on exact build |
| Security & Privacy | Fail-closed ownership/revision, no private diagnostics, no destructive recovery | Threat review, security suite/Snyk or documented fallback, dependency audit, PDI scans |
| Testing & Operations | Red-first matrix, idempotent retry, traceability, rollback | Retained red/green output, staged/bundle scans, CI links, public smoke |

### Key Entities *(include if feature involves data)*

- **Journal Password Removal Preflight**: Read-only assessment tied to an owner, expected vault revision, operation attempt, protected-object coverage, and one typed readiness/blocker outcome.
- **Journal Password Removal Operation**: Durable, resumable owner-bound intent with local conversion status, biometric-cleanup status, cloud-removal delivery status, retry metadata, and privacy-safe correlation.
- **Journal Cloud Cleanup Progress**: Durable privacy-safe per-stage progress for plaintext entry commits, media replacement/metadata commits, journal-backup patch, protected-object verification, and expected-revision vault deletion; it stores no content, keys, paths exposed to UI, or stable user identifier.
- **Journal Password Removal Result**: Consumer result distinguishing no change, full local success, and local success with additional cleanup pending.
- **Journal Protection Blocker Code**: Stable privacy-safe code that maps a failure class to a recovery action without identifying a record or exposing content.
- **Journal Entry Page Result**: Ordered readable entries plus exact unavailable count and a page-state distinction between verified empty and degraded/unavailable.
- **Feature Availability**: Structured decision containing visibility, stable reason class, and originating gate class for a named function.
- **Build Capability Receipt**: Non-user-data manifest binding release capabilities and kill switches to a source commit and platform build.
- **Regression Evidence Row**: Traceability record binding symptom, reproduction, cause status, requirement, change, test, platform, exact artifact, and residual risk.

## Decision Constraints and Rejection Criteria

- Reject any design that mutates protected rows before all required objects pass a read-only decryptability check.
- Reject a “best effort” password removal that skips or deletes unreadable objects.
- Reject an error contract that cannot distinguish no local change from local success with pending cleanup.
- Reject any availability fix based on constant, sample, demo, or inferred user counts.
- Reject a post-removal global backup merge/import, a remote vault delete without expected-revision compare-and-set, or deletion of an encrypted media blob before its replacement metadata is committed.
- Reject public enablement of AI Coach, rewards, Lottie/save ceremony, or another service solely because a source flag can be changed.
- Reject animation enablement without exact-candidate artistic/craft review and user visual approval, even if technical tests pass.
- Reject broad snapshot restoration, unrelated visual redesign, weakened tests/scanners, new paid services, or production-data fixtures.
- Reject release proof from a different commit, a stale CI run, an uncache-busted public URL, or a web-only check generalized to native platforms.

## Non-Goals

- Inspecting, exporting, decrypting, logging, or copying the user’s real journal contents for debugging.
- Automatically removing the user’s real password during implementation or testing.
- Resetting the journal, discarding unreadable records, or substituting fabricated records.
- Enabling every hidden or experimental product function.
- Redesigning the journal, orb, navigation shell, or visual language without a separately proven regression.
- Restoring the historical 898-file snapshot as a unit.
- Adding a paid provider, new production API, or broad data migration.
- Claiming physical-device, native assistive-technology, Windows, artistic, or user approval without fresh direct evidence.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All required healthy-removal scenarios complete with local protection absent and all original journal content readable after both reload and a new session.
- **SC-002**: Across every preflight blocker fixture, 100% of protected rows and password/vault metadata retain their pre-attempt fingerprints.
- **SC-003**: Biometric and cloud-cleanup failure fixtures report local success plus pending cleanup in 100% of runs and converge after idempotent retry.
- **SC-003a**: Remote cleanup tests prove that global backup merge/import is never invoked after local key removal, remote vault deletion affects exactly the expected revision, and any still-protected remote object retains the vault with cleanup pending.
- **SC-003b**: For every media failure boundary, at least one readable remote copy remains: the old encrypted blob is retained until plaintext upload plus metadata commit succeed, and retries converge without duplicate destructive effects.
- **SC-003c**: Pending-removal fixtures block unauthorized sign-out/account-switch purge, resume from app startup without opening the journal, reject malformed/future intents, and abort when a prepared row fingerprint changes before commit.
- **SC-004**: Mixed journal pages return 100% of readable entries in stable order and an exact unavailable count, with zero ciphertext, raw identifiers, private content, or fabricated cards exposed by tested UI and diagnostic surfaces.
- **SC-005**: The full required red-first matrix has retained failing-before/fixed-after evidence, and every realistic mutation named in the task packet is caught by at least one regression test.
- **SC-006**: Every inventoried function has exactly one availability state, reason class, source class, affected surfaces, and release decision; no known consumer receives a hardcoded journal count.
- **SC-007**: Existing boolean visibility consumers remain behaviorally compatible while structured consumers can distinguish all supported availability states.
- **SC-008**: The ceremony remains absent from production builds until every mandatory admission row passes; when admitted, all tested release entry points share the same receipt and kill-switch value.
- **SC-009**: The removal dialog passes the applicable automated accessibility, translation, RTL, text-reflow, keyboard, and Android Back checks with no unresolved critical or serious issue in the tested scope.
- **SC-010**: TypeScript, Vitest, focused domain tests, `check:all`, `ci:preflight`, production-data-integrity source/diff/staged/bundle, sync/auth, PWA/offline, performance/bundle, security scanning, and dependency audit complete without weakening criteria; any unavailable platform check is explicitly `UNVERIFIED`.
- **SC-011**: Each released wave has exact-commit local evidence, green remote CI, a rollback path, and cache-busted public-runtime proof before public behavior is called fixed.
- **SC-012**: Zero production code paths or bundles contain newly introduced mock, sample, demo, placeholder, synthetic, or production-derived user records.

## Assumptions

- Indexed local storage remains the authoritative journal source and existing sync/auth architecture remains in place; this epic repairs contracts rather than replacing the storage model.
- Existing supported encryption formats and migration intents are the compatibility boundary. Unsupported or corrupt data fails closed and remains untouched for explicit recovery.
- The user can perform a final real-account confirmation after a fixed build is deployed, without sharing credentials, keys, or journal content with the agent.
- Missing artistic or user approval keeps the save ceremony disabled; static save confirmation is an acceptable safe fallback.
- No new paid service or production dependency is required for the journal recovery or availability contract.

## Known Evidence Gaps

| Claim | Status | Closure path |
| --- | --- | --- |
| Exact cause of the current failure on the user’s real journal | UNVERIFIED | Privacy-safe typed preflight on the fixed build, followed by user-performed confirmation; no content collection |
| Physical Android behavior | UNVERIFIED | Exact-build physical-device biometric/lifecycle/accessibility smoke |
| Physical iOS behavior | UNVERIFIED | Exact-build physical-device biometric/lifecycle/accessibility smoke |
| Native assistive technologies | UNVERIFIED | TalkBack and VoiceOver review on exact candidate |
| Windows/Tauri runtime | UNVERIFIED | Windows build and runtime smoke on exact candidate |
| Artistic/craft quality of the save ceremony | UNVERIFIED | Independent visual critic reviews exact render packet |
| User visual approval of the save ceremony | UNVERIFIED | Product owner reviews exact candidate and explicitly approves or rejects it |
