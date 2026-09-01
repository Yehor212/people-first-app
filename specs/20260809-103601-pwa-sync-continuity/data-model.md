# Data Model: PWA Sync Continuity

This feature adds no persisted schema. The model below formalizes derived UI/diagnostic state and narrows the lifecycle of existing offline-queue and cursor records.

## Existing Durable Entities

### DurableOutboundAction

Existing record in the Dexie offline queue.

| Field | Constraint for this feature |
| --- | --- |
| `id` | Existing internal identity; never exposed in UI or diagnostics. |
| `operationId` | Stable per attempted logical operation; required for acknowledgement and late-completion quarantine. |
| `ownerUserId` | Required for process/migration eligibility; other-owner and ownerless rows stay quarantined. |
| `type` | Existing allowlisted action type; UI/diagnostics may map it only to a coarse domain label. |
| `entityId` | Existing internal entity identity; never exposed in UI or diagnostics. |
| `payload` | Existing user/business payload; remains only in IndexedDB and authorized network request, never diagnostic or `localStorage` output. |
| `timestamp`, `retries`, `maxRetries`, `priority`, `lastError` | Used for ordering/retry decisions; raw `lastError` is not displayed or recorded. |

**Validation**: Complete shape; supported action type; nonempty stable operation and owner; finite bounded numeric fields; payload handled by the existing action handler contract.

**States**: `durable_pending` → `processing` → `acknowledged_removed`; exception transitions return to `durable_pending` or `blocked`. Account switch transitions active processing to `quarantined`, never acknowledged.

### InboundCursor

Existing numeric ordered-event checkpoint stored with inbound mutations.

**Invariant**: The cursor changes only in the same successful transaction as the corresponding accepted inbound effects. Fetch success alone does not change it. Storage, validation, account, or apply failure preserves the previous value.

### LegacyQueueJournal

Existing `localStorage` value under the exact offline-queue key.

| State | Allowed action |
| --- | --- |
| `absent` | Continue from IndexedDB. |
| `present_unvalidated` | Read only; do not process or delete. |
| `invalid_or_ambiguous` | Fail initialization closed; retain exact bytes. |
| `validated` | Build bounded migration set; no network processing. |
| `committing` | Apply accepted upserts/removals inside one Dexie transaction. |
| `committed_cleanup_pending` | Confirm durable result, then remove exact legacy key. |
| `complete` | Continue from IndexedDB; no new legacy writes. |

**Idempotency**: A repeated migration recognizes already committed operation identities. A newer durable operation wins. Equal-order different-operation ambiguity fails closed. Failed cleanup retains the legacy input and repeats safely.

## Derived Ephemeral Entities

### SyncContinuityState

| Field | Values | Derivation |
| --- | --- | --- |
| `phase` | `idle`, `local_saved`, `outbound_pending`, `confirmed_online`, `inbound_applied`, `degraded` | Only from local commit evidence, durable current-owner queue, ordered confirmation receipt, committed inbound receipt, or an allowlisted degradation. |
| `localSavedAt` | Finite timestamp or null | Existing local durable-commit receipt only; never UI optimism. |
| `outboundPendingCount` | Nonnegative bounded integer | Count of current-owner durable actions; no IDs/content. |
| `confirmedOnlineAt?` | Finite timestamp | Ordered outbound acknowledgement only; sole authority for `Last sync`. |
| `inboundAppliedAt?` | Finite timestamp | Post-commit inbound apply/cursor receipt only. |
| `degradedReason?` | `offline`, `paused`, `storage_full`, `durable_write_failed`, `durable_read_failed`, `blocked` | Coarse condition only; no raw error or identifier. |

**Precedence**:

1. `storage_full` or durable blocked state sets `degraded` and overrides a success badge.
2. Offline/paused qualifies pending/local truth but does not erase the underlying timestamps/count.
3. A positive current-owner durable count yields `outbound_pending` even if an older confirmation receipt exists.
4. `confirmed_online` and `confirmedOnlineAt` require an acknowledgement receipt for an outbound action.
5. `inbound_applied` and `inboundAppliedAt` require a committed delta/snapshot receipt.
6. Empty queue plus online connectivity alone yields `idle` unless an authoritative receipt exists.
7. The structure is a read-only projection and is never stored, synced, or used to advance a cursor/acknowledge an action.

### StorageIncident

| Field | Constraint |
| --- | --- |
| `kind` | `quota_exceeded`, `durable_write_failed`, `durable_read_failed`, or existing bounded incident categories. |
| `priority` | Existing incident priority; storage-full is high enough to replace low-priority informational incidents, not account/security recovery. |
| `recoverable` | True only when retry rechecks the exact durable operation without deletion. |
| `retry` | Optional in-memory callback; never serialized. |
| `messageKey` | Localized key only; no raw exception message. |

**Deduplication key**: Stable per incident kind, not per payload or entity.

### DiagnosticReceipt

| Field | Allowed values/bounds |
| --- | --- |
| `kind` | Existing coarse sync lifecycle enumeration plus storage-full if required by the contract. |
| `source` | `runtime`, `delta`, `queue`, `resume`, or `storage`. |
| `at` | Finite timestamp. |
| `routeId` | `home`, `orb`, `diary`, `planning`, `progress`, `settings`, `auth`, `unknown`. |
| `seq`, `fetched`, `applied` | Optional nonnegative safe integers; no event IDs. |
| `domain`, `priority`, `errorClass` | Optional allowlisted enum values only. |

**Bounds**: Maximum 30 receipts; enum strings only; no arbitrary strings from payloads, URLs, IDs, or exceptions.

## Relationships

- One `DurableOutboundAction` may produce coarse `queued`, `queue-draining`, `queue-blocked`, and `processed` receipts, but the receipt cannot identify the action.
- One successful inbound transaction advances `InboundCursor` and may emit one `inbound_applied` receipt after commit.
- `SyncContinuityState` derives from current durable entities and ephemeral receipts; it is not persisted as a new authority.
- One active `StorageIncident` can qualify `SyncTruthPresentation`; dismissing the UI does not change durable state.
- `LegacyQueueJournal` is a temporary migration source for `DurableOutboundAction` and has no ongoing write relationship after migration.

## Failure Invariants

- No storage failure creates a second content-bearing authority.
- No UI dismissal, diagnostic emission, or receipt creation acknowledges a queue action.
- No failed inbound transaction advances the cursor.
- No migration cleanup occurs before the IndexedDB transaction commits and its result is observed.
- No account transition adopts, deletes, or exposes another owner's queue rows.
