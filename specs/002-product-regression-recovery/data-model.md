# Data Model: Product Regression Recovery

**Baseline**: `13ca51a80d23220574deba762851fe5a32372e46`
**Authority**: Existing Dexie tables and account-boundary coordinator remain authoritative. No new table or production dependency is introduced.
**Delivery note**: Journal, `FeatureAvailability`, and the schema-v1 build-capability receipt are implemented in the integrated local candidate. The receipt is deliberately non-enabling; exact-commit release and human visual gates remain open.

## 1. Journal Protection Blocker

```ts
export type JournalProtectionBlockerCode =
  | "unlock-required"
  | "activation-pending"
  | "removal-pending"
  | "vault-revision-mismatch"
  | "decrypt-entry"
  | "decrypt-media"
  | "decrypt-draft"
  | "decrypt-space"
  | "decrypt-capture"
  | "owner-adoption-pending"
  | "owner-changed"
  | "fresh-auth-required"
  | "storage-failed";
```

- `removal-pending` is an additional fail-closed state required when another tab, restart, or earlier attempt already owns the durable operation. A same-owner/same-revision retry resumes that operation rather than creating another.
- `owner-adoption-pending` distinguishes an authenticated account whose local IndexedDB realm has not yet been adopted. It is checked before an intent or remote fence is created; journal removal never performs owner adoption itself.
- `fresh-auth-required` retains an exact existing remote fence when present and routes the user through the repository's recent-authentication flow.
- A blocker never contains a row identifier, ciphertext, content, key, filename, user identifier, or raw exception.
- Internal diagnostics may record only blocker code, operation stage, coarse platform class, attempt count, and an ephemeral operation correlation value.

## 2. Read-Only Preflight

```ts
export type JournalPasswordRemovalPreflight =
  | {
      status: "ready";
      expectedVaultRevision: number;
      coverage: {
        entries: number;
        media: number;
        drafts: number;
        spaces: number;
        captures: number;
      };
    }
  | {
      status: Exclude<JournalProtectionBlockerCode, "removal-pending">;
      recoveryAction:
        | "unlock"
        | "wait-for-activation"
        | "reload"
        | "retry"
        | "reauthenticate"
        | "stay-signed-in";
    };
```

- The persisted attempt is created before preflight, but preflight itself performs no destructive write, queue delivery, native credential change, remote mutation, or local journal-row mutation.
- Remote media bytes may be read into operation-scoped memory when the local row contains only remote metadata. Failure to retrieve and decrypt them is `decrypt-media`; an absent local byte payload is never interpreted as an empty file.
- Prepared plaintext and row fingerprints exist only in memory for the current operation. They are never persisted, logged, included in receipts, or sent to analytics.
- Immediately before the Dexie transaction writes, every raw protected row and relevant setting is re-read and compared with the in-memory snapshot. Any difference aborts as `vault-revision-mismatch` or `storage-failed` without mutation.

## 3. Durable Removal Operation

The existing `settings[SK.JOURNAL_SECURITY_REMOVAL]` record is upgraded reader-first to version 2. A version-1 intent is normalized without dropping its existing media cleanup paths. Unsupported future versions and malformed values are represented as an explicit parse failure, never `null`.

```ts
export interface JournalPasswordRemovalOperationV2 {
  version: 2;
  operationRevision: string;
  expectedVaultRevision: number;
  ownerUserId: string;
  createdAt: number;
  updatedAt: number;
  phase:
    | "preflight-pending"
    | "blocked"
    | "local-committed"
    | "cleanup-pending";
  blocker?: JournalProtectionBlockerCode;
  attemptCount: number;
  nativeCleanup: NativeCredentialCleanupState;
  cloudCleanup: JournalCloudCleanupState;
}

export type NativeCredentialCleanupState =
  | { status: "not-started" }
  | { status: "not-applicable" }
  | { status: "pending"; attemptCount: number }
  | { status: "complete" }
  | { status: "failed" | "owner-changed"; attemptCount: number };

export interface JournalCloudCleanupState {
  status: "not-started" | "pending" | "complete" | "blocked";
  stage:
    | "entries"
    | "photos"
    | "audio"
    | "backup"
    | "verify-protected-objects"
    | "delete-vault"
    | "complete";
  entryIds: string[];
  photos: JournalMediaCleanupItem[];
  audios: JournalMediaCleanupItem[];
  backupPending: boolean;
  attemptCount: number;
  blocker?: "offline" | "remote-state-changed" | "remote-protected-data" | "storage-failed";
}

export interface JournalMediaCleanupItem {
  id: string;
  previousStoragePath?: string;
  replacementUploaded: boolean;
  metadataCommitted: boolean;
  previousBlobDeleted: boolean;
}
```

The owner identifier and internal record identifiers are required for local authority and idempotency. They stay inside local storage/authorized sync calls and are excluded from UI, logs, analytics, and the support-safe receipt.

### Operation transitions

| From | Event | To | Required invariant |
| --- | --- | --- | --- |
| absent | explicit user confirmation | `preflight-pending` | No unresolved supported or unknown intent exists |
| `preflight-pending` | non-ready preflight | `blocked` | Journal rows, password/vault, native credential, queue, and cloud unchanged |
| `preflight-pending` | ready + boundary/snapshot recheck + transaction commit | `local-committed` | All protected local objects are plaintext and local password/vault metadata is absent atomically |
| `local-committed` | native/cloud work remains | `cleanup-pending` | UI reports local success; operation counts as a durable pending owner write |
| `cleanup-pending` | restart/online/app resume | `cleanup-pending` | Retry is owner-bound and idempotent; progress only moves forward |
| `cleanup-pending` | all native/cloud stages acknowledged | absent | Remote vault was deleted with expected-revision CAS; intent deletion is the final local step |
| any supported phase | owner/revision/snapshot conflict | unchanged or `blocked` | No operation crosses an account boundary or overwrites a newer operation |
| malformed/future | any stale-client action | malformed/future retained | New mutation and purge fail closed as `storage-failed` |

A completed operation is represented by absence only after all required cleanup acknowledgements. A replay of an already-completed queue action is an idempotent obsolete success, not an exception.

## 4. Cloud Finalization Invariants

1. Never invoke the global backup merge/import path after the local vault is removed.
2. Each local plaintext entry must receive an acknowledged owner-bound remote commit. A queued, aborted, or stale/no-op result is not acknowledgement.
3. For media, upload plaintext replacement, commit its metadata, and only then delete the superseded encrypted blob. Persist progress after each acknowledgement.
4. Patch only journal fields in the remote backup under its observed `updated_at`; preserve all unrelated remote domains. A CAS miss retries from a fresh remote read.
5. Verify there is no remaining protected remote journal row or encrypted media path. Extra protected data keeps the remote vault and leaves cleanup pending.
6. Delete remote vault metadata only when its value still carries `expectedVaultRevision`; condition deletion on both the selected row version and expected owner. Abort, timeout, or zero affected rows is pending, not success.

## 5. Removal Result

```ts
export type JournalPasswordRemovalResult =
  | { status: "removed" }
  | {
      status: "removed-cleanup-pending";
      pending: Array<"biometric" | "cloud">;
    }
  | {
      status: "blocked";
      blocker: JournalProtectionBlockerCode;
      recoveryAction: "unlock" | "wait-for-activation" | "reload" | "retry" | "stay-signed-in";
    };
```

Thrown exceptions are reserved for programmer errors or inability to read the operation state at all. Expected product outcomes use the typed result so the UI cannot collapse local success into “nothing changed.”

## 6. Journal Entry Page

```ts
export interface JournalEntryPageResult {
  entries: JournalEntry[];
  totalCount: number;
  requestedCount: number;
  unavailableCount: number;
  state: "ready" | "empty" | "degraded" | "unavailable";
  hasMore: boolean;
  nextCursor: JournalEntryPageCursor | null;
}
```

The cursor derives from the final raw requested row, not the final readable row, so an unavailable boundary record cannot cause a loop or duplicate page. `empty` requires `totalCount === 0`; an all-unreadable non-empty page is `unavailable`. Display reads settle per entry; export, edit, migration, and security conversion remain fail-closed.

## 7. Feature Availability

```ts
export type FeatureAvailabilityState =
  | "available"
  | "temporarily-unavailable"
  | "experimental-hidden"
  | "blocked";

export interface FeatureAvailability {
  manifestVersion: 1;
  key: string;
  visible: boolean;
  state: FeatureAvailabilityState;
  reason:
    | "available"
    | "disabled-by-user"
    | "unlock-required"
    | "journal-count-loading"
    | "journal-count-unavailable"
    | "rollout-disabled"
    | "kill-switch"
    | "build-capability-missing"
    | "security-proof-missing"
    | "service-not-approved"
    | "consumer-missing"
    | "configuration-missing"
    | "unknown-feature";
  source: "user-setting" | "onboarding" | "local-truth" | "remote-rollout" | "kill-switch" | "build" | "release-policy";
  disclosure: "user-safe-reason" | "silent";
}
```

`isFeatureVisible(feature)` returns `getFeatureAvailability(feature).visible`. Loading or failed journal count is never coerced to zero. Unknown keys, missing manifest rows, missing consumers, and absent persisted values fail closed unless the manifest explicitly defines a safe default. Internal reason/source codes are mapped to natural user copy only where `disclosure` permits it.

## 8. Build Capability Receipt

```ts
export interface BuildCapabilityReceipt {
  schemaVersion: 1;
  sourceCommit: string;
  platform: "web-pages" | "android" | "ios" | "tauri";
  capabilities: {
    journalSaveCeremony: boolean;
  };
  killSwitches: {
    journalSaveCeremony: boolean;
  };
  admission: {
    technical: "pass" | "fail" | "unverified";
    accessibility: "pass" | "fail" | "unverified";
    performance: "pass" | "fail" | "unverified";
    visualRuntime: "pass" | "fail" | "unverified";
    artisticCraft: "pass" | "fail" | "unverified";
    userApproval: "pass" | "fail" | "unverified";
  };
}
```

The receipt is deterministic for a source commit/platform/input set and contains no account, journal, activity, device, credential, or production-derived data. Schema v1 is non-enabling: `journalSaveCeremony` remains false even when every admission string is `pass`, because those strings are not authenticated proof. A later schema must bind evidence hashes and explicit owner authorization before any true receipt is valid.

## 9. Compatibility and Deletion Rules

- Reader-first: all readers understand version 1 before any writer stores version 2.
- Old-client writes may not erase a version-2 or unknown intent; compare the stored operation revision before every update/delete.
- No Dexie table deletion, Dexie schema bump, or bulk client-side rewrite is required.
- One forward-only Supabase schema migration is required before the remote removal fence can be used. This repository change only defines it; it does not apply it to production.
- No permanent remote journal-entry ID registry or deletion RPC is introduced. The rejected cutover could not classify IDs deleted before migration from authoritative retained history; client tombstones and idempotent owner-scoped deletes remain the bounded compatibility path.
- The server rollout is expand/contract: existing owners start in `legacy`, removal temporarily moves the exact owner to `paused` (protected writes blocked, plaintext conversion admitted), and `strict` is enabled only by an owner-scoped RPC after every protected row, backup item, and Storage object proves the exact active vault revision.
- Deployment order is migration in compatibility mode, dual-writing client, observation/repair of legacy rows, optional per-owner strict activation, then password-removal availability. A missing phase or live migration receipt remains `UNVERIFIED`.
- Removing the operation record is authorized only after acknowledged completion; sign-out discard requires the repository's existing separate explicit pending-change authorization and must not masquerade as cleanup success.
- Rollback leaves version-2 intent intact and fail-closed for older builds; it never rewrites journal rows or resurrects a password.
