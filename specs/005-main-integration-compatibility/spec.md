# Feature Specification: Main Integration Compatibility

**Feature Branch**: `codex/android-103ms-20260904` (existing locked lane)

**Created**: 2026-09-09

**Status**: Approved scope; implementation evidence pending

**Input**: The owner requested all pending work from all branches in main, including other authors, then approved the necessary React 19 adaptation and twelve import-cycle repairs with “да разрешаю” on 2026-09-09 at 13:08 UTC. PR #112 already preserves the original branch heads.

## User Scenarios & Testing

### User Story 1 - Existing controls keep their interaction boundaries (Priority: P1)

A person opens and closes the drawer, a Settings panel, a habit form, a diary surface, or a nested sharing dialog. Only the current surface accepts input; a retained closing or covered surface must not receive focus or clicks.

**Why this priority**: The integrated dependency update currently breaks hidden-surface interaction protection, even though most tests still pass.

**Independent Test**: Exercise opening, covering, closing and reopening each affected surface; inspect the actual interaction-blocking attribute and keyboard focus before final removal.

**Acceptance Scenarios**:

1. **Given** an open drawer, **when** it starts closing, **then** its retained content becomes noninteractive immediately and focus returns through the existing path.
2. **Given** a habit sheet or nested sharing dialog, **when** it owns interaction, **then** covered controls cannot regain focus, and closing the top surface restores the prior interaction boundary.
3. **Given** a diary or Settings transition, **when** the old surface remains for its exit animation, **then** only the current surface is interactive without changing the existing animation or layout.
4. **Given** an element or timer is not mounted or initialized, **when** the shared UI code runs, **then** it preserves existing null/undefined handling rather than inventing an object or coercing away the absent state.

### User Story 2 - Existing records and protection survive internal separation (Priority: P1)

A person saves while offline, resumes, or changes accounts. Internal dependency cleanup must not change when work is durable, the account that owns it, how deletes resist resurrection, or how diary protection recovery is recorded.

**Why this priority**: The demonstrated cycles pass through data ownership, deletion markers and protected diary recovery.

**Independent Test**: Run isolated owner-change, failed-write, durable retry, idempotency, deletion, local-only setting, and diary recovery regressions before and after the separation.

**Acceptance Scenarios**:

1. **Given** a domain save succeeds but its ordered notification cannot be committed, **when** the call resolves, **then** the existing retry intent has been durably saved and no premature cross-client notification has been sent.
2. **Given** a changed account or pending account-ownership choice, **when** an old operation attempts a write, **then** the unchanged owner boundary rejects it without transferring content.
3. **Given** a deleted record or device-local setting, **when** stale data arrives, **then** the existing deletion and local-only rules remain authoritative.
4. **Given** a remote diary-protection removal wake-up, **when** recovery runs, **then** the authoritative recovery result is recorded under the existing owner and revision rules before progress is acknowledged.
5. **Given** old and new internal import entry points, **when** a cached device identity is cleared or reused, **then** they share one implementation and one cache.

### User Story 3 - The owner receives all preserved work in main (Priority: P2)

The owner receives one history-preserving integration of the already inventoried working changes and fifteen branch heads, with truthful current verification and no silent loss of another author's work.

**Why this priority**: Safe publication is the original requested outcome and depends on the two compatibility stories.

**Independent Test**: Inspect current required checks for the exact integration head, perform a normal protected merge, fetch main and verify every original head and the preserved local batch is in its ancestry.

**Acceptance Scenarios**:

1. **Given** the integration branch and original input manifest, **when** it is merged normally, **then** every original commit remains reachable from main and no branch or source working copy is deleted.
2. **Given** any failed mandatory check, **when** publication is evaluated, **then** the failure remains visible and the check is not weakened or bypassed.
3. **Given** missing device, live-account, store or installed-app proof, **when** the result is reported, **then** each missing scope remains explicitly unverified rather than inheriting a local-test pass.

### Edge Cases

- Closing surfaces may remain mounted for animation but must lose interaction immediately, including reduced-motion and RTL states.
- Absent refs and cleared timer handles retain their existing null/undefined states.
- Event-write failures, duplicate operation keys and queue-persistence failures retain existing outcomes and rejection paths.
- Logout must clear the one device-identity cache regardless of the import entry point.
- Device-local deletion markers, diary drafts and security records must never become account settings.
- Protected diary recovery remains blocked by stale/newer revisions and mismatched account ownership.
- Unavailable native or live-account verification is a named proof gap, not permission to use personal account data.
- Concurrent remote main movement requires revalidation of the resulting exact head, never a force push.

## Requirements

### Functional Requirements

- **FR-001**: The integration MUST preserve the current layout, copy, theme, canonical visuals, motion timings and navigation ownership while restoring hidden-surface interaction protection.
- **FR-002**: All affected retained or covered surfaces MUST become noninteractive during the same states as before the dependency update; their existing focus/escape/back paths MUST remain intact.
- **FR-003**: Absent DOM elements and not-yet-created or cleared timers MUST preserve their existing lifecycle behavior.
- **FR-004**: Internal dependency separation MUST preserve event ordering, durable retry before return, UUID-compatible operation identity, account ownership and one shared device-identity cache.
- **FR-005**: Permanent deletion markers, local-only setting classification, unsaved diary privacy and protected diary recovery MUST retain their existing semantics and storage representation.
- **FR-006**: Every original inventoried branch head and preserved working-change commit MUST remain reachable from main after a normal merge, with original source working copies and refs retained.
- **FR-007**: Publication MUST use current required checks without force, skipped hooks, relaxed assertions, scanner exclusions, invented evidence or agent-created waivers.
- **FR-008**: Verification MUST state Web, installed PWA, Android, iOS and Desktop separately and distinguish code/build proof from public, device, live-account and artistic proof.

### Key Entities

- **Integration input**: An existing commit or inventoried local file whose identity and provenance must survive publication.
- **Retained surface**: A closing or covered UI region that remains mounted but must not own interaction.
- **Ordered event and retry intent**: Existing durable user-operation records; this work creates no new record format or event type.
- **Device identity, ownership and deletion marker**: Existing installation/account boundaries and permanent anti-resurrection state; their keys and values are unchanged.
- **Diary recovery intent**: Existing owner- and revision-bound protection-recovery state; the recovery algorithm is not redesigned.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All four reproduced hidden-surface regressions pass with the original assertions, and every other affected interaction boundary has direct regression or browser coverage.
- **SC-002**: Compatibility checks report zero type errors and zero import cycles without removing dependency edges from analysis; existing behavioral coverage has no unexplained regressions.
- **SC-003**: All fifteen original branch heads and the preserved local batch are reachable from the verified main head after merge.
- **SC-004**: The final report contains five explicit platform rows and every unavailable proof remains named; the separate Android 103 ms goal is not relabeled as complete.

## Assumptions

- The two direct owner instructions authorize compatibility repairs and normal PR #112 publication, not new product behavior, production-data mutation, store submission, branch deletion or history rewriting.
- The existing locked editing lane remains the sole writer. Original working copies remain untouched.
- The same existing services, persistence formats and visual system are retained; no new paid service or production dependency is introduced.
- The previous Android performance work remains separately tracked in `specs/004-android-interaction-budget/`.

## Clarifications

### Session 2026-09-09

No new questions: the direct approval resolves the material scope expansion. Functional scope, entities/lifecycle, UX, quality attributes, integrations, failure paths, constraints, terminology and completion signals are clear. Native/live-account/public proof is a verification boundary, not an unanswered product decision.
