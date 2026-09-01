# Sync Continuity Contract

**Audience**: Shared Web/PWA implementation and test owners.
**Authority**: `AGENTS.md`, `docs/ai/SYNC_CONTRACT.md`, `docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md`, and the explicit feature scope.
**Persistence impact**: No schema change.

## 1. OutboundBeforeDelta

Every delta trigger MUST execute this logical sequence under the existing sync leader lock:

1. Capture authenticated owner and account-boundary generation.
2. Await durable offline-queue initialization.
3. Revalidate owner.
4. Read current-owner pending actions from durable-backed queue state.
5. If present, process the queue and revalidate owner.
6. Re-read current-owner pending actions.
7. If any remain, emit coarse `queue_blocked`, leave cursor untouched, and return without fetching.
8. Only then read cursor, fetch ordered deltas, apply them transactionally, and emit a post-commit receipt.

Other-owner and ownerless actions remain quarantined and do not block the current owner's pull. Any account-generation change aborts or discards the old result. Broadcast is a wake-up only.

## 2. TruthPresentation

The UI consumes the exact read-only contract:

```ts
type SyncContinuityPhase =
  | "idle"
  | "local_saved"
  | "outbound_pending"
  | "confirmed_online"
  | "inbound_applied"
  | "degraded";

type SyncContinuityState = Readonly<{
  phase: SyncContinuityPhase;
  localSavedAt: number | null;
  outboundPendingCount: number;
  confirmedOnlineAt?: number;
  inboundAppliedAt?: number;
  degradedReason?: "offline" | "paused" | "storage_full" | "durable_write_failed" | "durable_read_failed" | "blocked";
}>;
```

Normative rules:

- The view is derived from existing receipts/queue/cursor and is never persisted or used as a second sync authority.
- `confirmedOnlineAt` requires an ordered outbound acknowledgement receipt; only then may UI say `Last sync`.
- `inboundAppliedAt` requires a receipt emitted after a committed inbound transaction.
- A durable current-owner action forces `outbound_pending` even if an older success receipt exists.
- Network availability, empty in-memory arrays, timer expiry, and animation completion are not confirmation.
- Copy must describe delivery resuming when ZenFlow can run; it cannot promise closed-client convergence.
- Without `confirmedOnlineAt`, the UI uses `Last activity`, never `Last sync`.

## 3. WebPwaDurableWrite

For new or modified queue content on Web/PWA:

- Destination is the existing Dexie offline queue only.
- IndexedDB failure rejects the operation and emits a sanitized storage incident.
- Production code MUST NOT call a content-bearing `localStorage` writer as a fallback.
- Page lifecycle code MUST NOT snapshot raw queue actions or user content to `SK.LAST_STATE` or any other browser key-value key on `beforeunload`, `pagehide`, storage error, or account switch.
- Existing durable rows are retained; no emergency compaction, deletion, or fake acknowledgement is allowed.
- Non-content flags outside the queue contract are unchanged by this feature.

## 4. LegacyQueueMigration

The exact existing offline-queue `localStorage` key is migration input only.

```text
read exact key
  → parse bounded JSON
  → validate complete row/journal shape and owner boundary
  → resolve only unambiguous operation ordering
  → one Dexie transaction for accepted upserts/removals
  → read committed result / complete transaction
  → remove exact legacy key
```

Failure at parse, validation, ownership, conflict resolution, transaction, durable confirmation, or key removal fails initialization closed. No queue processing or delta pull may pass an unresolved migration. Re-entry is idempotent; a newer durable operation wins and an equal-order ambiguous conflict is retained for recovery.

## 5. CursorAtomicity

- Inbound entity effects and cursor update commit in one transaction.
- Quota, validation, owner, tombstone, or write failure rolls back the entire transaction.
- A caught failure is rethrown to the trigger owner after emitting only a sanitized incident.
- Retry begins from the unchanged cursor.
- A batch containing only current-device events may advance the cursor only in its own successful settings transaction.

## 6. StorageIncident

Allowed event detail is bounded and non-content-bearing:

```text
kind: quota_exceeded | durable_write_failed | durable_read_failed
recoverable: boolean
retry: optional in-memory function
```

The event MUST NOT include table keys, entity/action/operation IDs, payload, user text, raw exception message, stack, URL, OAuth fields, or storage contents. The existing incident owner deduplicates by `kind`. Retry re-runs a safe durable operation and dismisses the incident only after success.

## 7. DiagnosticReceipt

Allowed snapshot/receipt fields:

```text
kind: bounded sync lifecycle enum
source: runtime | delta | queue | resume | storage
at: finite timestamp
routeId: home | orb | diary | planning | progress | settings | auth | unknown
seq/fetched/applied: optional nonnegative safe integers
domain/priority/errorClass: optional allowlisted enums
```

Forbidden everywhere in the diagnostic surface:

- raw pathname/search/hash or full URL;
- query parameter names/values not represented by the symbolic route;
- OAuth code, access/refresh token, state, verifier, or error description;
- journal, habit, mood, focus, gratitude, settings value, attachment metadata, or other content;
- entity, queue, operation, event, device, account, or session identifiers;
- payloads, raw user-agent/IP, arbitrary action types, arbitrary exception messages, or stacks.

Receipts remain capped at 30. Outside development, installation requires explicit opt-in; an explicit disable wins. Diagnostic enablement may use a non-content preference but may not persist snapshots or receipts.

## 8. Accessibility and Localization

- All visible status/incident strings are complete localized thoughts for en, uk, es, de, fr, ja, ar, and he.
- Placeholders have exact parity and are never concatenated into translated sentences.
- Arabic/Hebrew numeric counts remain readable without left/right directional wording.
- Status uses a polite live region and non-color icon/text meaning.
- Retry is keyboard operable, focus-visible, and at least 44px.
- Storage incident remains owned by `StorageErrorBanner`/`OverlayLayer`; no competing modal is introduced.

## 9. Platform Boundary

Web/Vite and installed PWA receive the behavior. No Android, iOS, Tauri, service-worker guarantee, Supabase schema, dependency, or production-data change is authorized. Shared TypeScript compatibility and PWA↔native handoff on Android/iOS/Desktop require hash-bound same-tree owner receipts before release and remain `UNVERIFIED` until obtained. The existing JS-readable Supabase session architecture is not redesigned here; its residual risk keeps the security/release verdict `STOP` pending owner acceptance or a separate auth-hardening feature.

## 10. Negative Controls

The feature is rejected if any focused test demonstrates:

- delta fetch before queue initialization/drain;
- delta fetch while current-owner work remains;
- cursor change after failed apply;
- a new content-bearing `localStorage` write;
- a raw queue/content snapshot in `SK.LAST_STATE` or any lifecycle key;
- legacy deletion before committed migration;
- duplicate/resurrected operation after migration or late acknowledgement;
- diagnostic canary in snapshot, receipt event, DOM, or captured log;
- raw exception content in a storage incident;
- schema/native/dependency path change.
- `Last sync` rendered without `confirmedOnlineAt`, or a native parity claim without hash-bound owner evidence.
