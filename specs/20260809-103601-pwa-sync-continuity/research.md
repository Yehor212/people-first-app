# Research Decisions: PWA Sync Continuity

**Date**: 2026-08-09
**Scope**: Repository-grounded design decisions only; no production mutation or live-account proof.
**Source baseline**: Git `13ca51a80d23220574deba762851fe5a32372e46`.

## R1. Derive user-visible truth from existing authoritative signals

**Decision**: Build one derived presentation model from local commit evidence, the durable current-owner offline queue, ordered-event confirmation receipts, and committed inbound-delta receipts. Network state and the legacy orchestrator may qualify the presentation, but cannot manufacture confirmation.

**Rationale**: `SyncHealthCard` currently combines offline queue state and orchestrator state, while `SyncHealthCardParts` already distinguishes `queued`, `processed`, and `delta-applied` receipts. Tightening this existing owner avoids a second sync state machine and directly supports FR-001–FR-003.

**Alternatives considered**:

- Treat `navigator.onLine` plus an empty queue as synchronized: rejected because connectivity is not an ordered-event receipt.
- Add a persisted sync-status table: rejected because the feature forbids schema change and would create a competing truth source.
- Report only a binary online/offline state: rejected because it hides the user's main failure mode.

## R2. Keep the outbound barrier inside the existing delta owner

**Decision**: Retain `useDeltaSyncEffects()` as the single delta owner. Every trigger enters the same leader-locked run, awaits offline-queue hydration, drains only current-owner work, and exits before fetch when current-owner work remains.

**Rationale**: The current hook already implements the required order and has focused tests for startup, cold hydration, blocked rows, owner quarantine, and account switching. The safe plan is to characterize and close trigger/failure gaps rather than create a new reopen coordinator.

**Alternatives considered**:

- Drain from each lifecycle event separately: rejected because it duplicates ownership and increases races.
- Let inbound deltas apply before blocked outbound work: rejected by the requested queue-before-delta contract.
- Treat other-owner/ownerless rows as a global barrier: rejected because current code quarantines them and blocking the current account would create cross-account denial of service.

## R3. Remove new content-bearing fallback writes, retain a one-way migration reader

**Decision**: On Web/PWA, IndexedDB failure for new or updated outbound actions becomes an explicit persistence failure. `localStorage` remains readable only for the existing offline-queue legacy key; validated rows migrate in one IndexedDB transaction and the exact key is removed only after committed-state confirmation.

**Rationale**: `offlineQueue.ts` currently falls back to a v3 content-bearing journal after IndexedDB persistence or deletion errors. That contradicts the explicit new boundary. Its existing reconciliation code provides the basis for a one-way, idempotent migration without a Dexie schema change.

**Alternatives considered**:

- Keep dual writes temporarily: rejected because every new fallback write extends the privacy/data-loss window.
- Delete the legacy key without migration: rejected because it can destroy real pending work.
- Migrate row-by-row outside a transaction: rejected because interruption can create partial, ambiguous ownership.
- Rewrite all application `localStorage`: rejected as unrelated and materially broader.

## R4. Treat storage exhaustion as a durable-state incident

**Decision**: Normalize quota/storage access failures into a bounded incident category, preserve the original exception for control flow, keep cursor/entity transaction atomicity, and surface a deduplicated existing `StorageErrorBanner` incident with safe retry. Retry re-runs the durable operation; it never clears data or changes status by itself.

**Rationale**: `applyDelta()` already rethrows quota failure after a rolled-back Dexie transaction, but emits `zenflow:storage-full`, while the banner currently listens to `zenflow:storage-error`. A unified typed incident closes the UI gap without a new overlay.

**Alternatives considered**:

- Automatically delete caches or user data: rejected as destructive and outside authorization.
- Retry indefinitely: rejected because full storage is not transient and repeated attempts increase interruption.
- Show the raw exception: rejected because it can expose implementation details or user-derived values.

## R5. Replace raw diagnostic routes with symbolic identifiers

**Decision**: Diagnostic snapshots and receipts use a bounded route identifier from an allowlist such as `home`, `orb`, `diary`, `planning`, `progress`, `settings`, `auth`, and `unknown`. They never persist or emit raw search/hash. Receipt fields are allowlisted and bounded; error detail is reduced to a small technical class.

**Rationale**: `currentRoute()` currently includes `window.location.search`, which can carry OAuth or user-provided values. Existing receipt history is already capped at 30, so applying field and length bounds extends the current privacy design.

**Alternatives considered**:

- Redact known sensitive parameter names: rejected because an unknown key or value can still leak.
- Hash raw URLs or IDs: rejected because stable hashes remain correlatable and are unnecessary for this diagnostic purpose.
- Remove diagnostics entirely: rejected because current release/support workflows depend on privacy-safe coarse proof.

## R6. Preserve shared architecture while excluding native behavior changes

**Decision**: Make changes only in shared TypeScript/React and eight-locale resources needed by Web/PWA, behind the existing runtime behavior. Do not edit native projects, schemas, dependencies, service-worker guarantees, or Supabase contracts. Require native compatibility receipts before release because shared bundles are consumed there.

**Rationale**: The user explicitly excludes schema/native changes, while `AGENTS.md` requires impact to be stated for every platform.

**Alternatives considered**:

- Add platform-specific queue stores: rejected as native behavior and architecture expansion.
- Modify Background Sync to promise closed-client delivery: rejected because service-worker execution is not guaranteed.

## R7. Test at the closest risk boundary before production edits

**Decision**: Add focused RED tests first: queue fallback prohibition/migration failure injection, delta trigger ordering/cursor non-advance, derived truth-state table, storage incident behavior, and diagnostic canaries. Then implement minimal GREEN changes and run contract, i18n, integrity, security, build, and browser blast-radius checks.

**Rationale**: These test locations already exist and match the repository test-first policy. No test threshold, assertion, or scanner exclusion needs weakening.

**Alternatives considered**:

- Start with full E2E only: rejected because it diagnoses storage and ordering failures poorly.
- Use only static source assertions: rejected for asynchronous ordering, atomicity, and user-visible state.
- Claim native/public/live account behavior from unit tests: rejected as evidence overreach.

## Resolved Unknowns

No implementation-blocking unknown remains. Exact localized wording may be refined during implementation, but it is bounded by FR-002, FR-003, FR-008, FR-019, the translation policy, and eight-locale parity; human native-speaker approval remains `UNVERIFIED` rather than a planning blocker.
