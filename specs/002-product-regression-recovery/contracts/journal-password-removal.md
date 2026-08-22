# Contract: Journal Password Removal

## Consumer API

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

export type JournalPasswordRemovalPreflight =
  | {
      status: "ready";
      expectedVaultRevision: number;
      coverage: Record<"entries" | "media" | "drafts" | "spaces" | "captures", number>;
    }
  | {
      status: JournalProtectionBlockerCode;
      recoveryAction: "unlock" | "wait-for-activation" | "reload" | "retry" | "reauthenticate" | "stay-signed-in";
    };

export type JournalPasswordRemovalResult =
  | { status: "removed" }
  | { status: "removed-cleanup-pending"; pending: Array<"biometric" | "cloud"> }
  | {
      status: "blocked";
      blocker: JournalProtectionBlockerCode;
      recoveryAction: "unlock" | "wait-for-activation" | "reload" | "retry" | "reauthenticate" | "stay-signed-in";
    };

export interface JournalPasswordRemovalService {
  preflight(vaultKey: string): Promise<JournalPasswordRemovalPreflight>;
  removeAfterUserConfirmation(vaultKey: string): Promise<JournalPasswordRemovalResult>;
  resumePendingCleanup(): Promise<"none" | "pending" | "completed">;
}
```

`removeAfterUserConfirmation()` may be called only from the existing explicit destructive confirmation flow. Automated tests use isolated fixtures. The implementation never invokes this against the user's production account.

## Required sequence

1. Capture the current account-boundary generation, session owner, local owner, and vault revision.
2. Fail closed before creating an intent when an authenticated owner has not yet been adopted locally, the signed-in owner differs from the local owner, or account-owned data is opened signed out.
3. Create or resume the exact owner/revision-bound durable operation without overwriting an unresolved or unknown-version intent.
4. Read and prepare entries, photos, audio, drafts, spaces, and captures. Metadata-only media is downloaded into operation-scoped memory; missing/decrypt-failed bytes block as `decrypt-media`.
5. Return a typed non-ready result without changing rows, password/vault metadata, native credential, queue, or cloud delivery.
6. Build a privacy-safe inventory of exact row hashes and Storage identities, then acquire the owner/revision/operation-bound server fence. A fence miss changes no local protected row.
7. Under the existing `DATA -> JOURNAL` lock order, revalidate owner, vault revision, operation revision, and raw row snapshots.
8. In one Dexie transaction, write every prepared local plaintext object, remove local password/vault/biometric-setting/cooldown metadata, and persist `local-committed`. Abort means none of these writes commit.
9. Revalidate owner immediately before clearing the installation-wide native biometric credential. A failure becomes pending cleanup; it does not reverse or misreport the local commit.
10. Enqueue/resume journal-scoped cloud finalization. Queue failure leaves the durable intent and reports `removed-cleanup-pending`.
11. App-level startup/resume processing retries cleanup without requiring the journal route to mount.

## Server fence and rollout

`journal_security_states.journal_write_mode` has three states:

| Mode | Protected write | Plaintext write | Entry condition |
| --- | --- | --- | --- |
| `legacy` | Allowed only for the authenticated owner with a matching durable vault setting; missing historical row epoch is tolerated | Rejected while protection is active | Default expand phase for old/new-client coexistence |
| `paused` | Rejected, including stale versioned blobs | Allowed only while `protection_state='removing'` so the journal-scoped finalizer can replace protected material | Exact inventory accepted for one owner-bound operation |
| `strict` | Requires the exact row/object/backup vault epoch | Rejected while protection is active | Explicit owner-only activation after a complete exact-epoch inventory |

The migration must not promote owners to `strict` automatically. `begin_journal_password_removal` locks and checks the exact remote inventory before setting `removing/paused`. `finalize_journal_password_removal` atomically verifies that no protected row, backup item, or Storage object remains before deleting the exact vault setting and returning the owner to `unprotected/legacy`. `recover_journal_password_removal` only completes a fully converted orphan or returns `manual-recovery-required`.

Schema application and live RLS behavior are not proven by source tests. They remain `UNVERIFIED` until the migration and old/new-client matrix run on an authorized non-production Supabase project.

## Cloud finalizer

The cleanup worker must never call the global `syncWithCloud("merge")` path after local vault removal.

```ts
interface RequiredRemoteCommitOptions {
  expectedOwnerUserId: string;
  requireRemoteCommit: true;
  signal?: AbortSignal;
}

interface RemoteVaultDeleteInput {
  expectedOwnerUserId: string;
  expectedVaultRevision: number;
  operationRevision: string;
  signal?: AbortSignal;
}
```

The finalizer:

- acknowledges each plaintext entry commit; queued, aborted, stale/no-op, and zero-row results throw a retryable cleanup error;
- uploads plaintext media replacement, commits metadata, persists progress, then deletes only the superseded encrypted blob;
- compare-and-set patches only journal fields in `user_backups`, preserving unrelated remote domains;
- verifies no protected remote journal row or encrypted media path remains;
- compare-and-set deletes `user_settings[journal-vault]` only when the remote vault revision still equals the captured expected revision;
- deletes the local intent last.

An extra or newer protected remote object yields pending cleanup and retains the remote vault. No automatic remote deletion, reset, or fake record is allowed.

## Compatibility

- Version-1 removal intents are read and normalized before version-2 writes are introduced.
- Future/malformed intents are `storage-failed`, not absence.
- Same owner/revision retry reuses the operation revision.
- A conflicting owner/revision returns `removal-pending`.
- Replayed completed queue action is an acknowledged obsolete success.
- Pending operation counts as a durable owner write for sign-out/account switch. Existing explicit discard authorization remains a separate user decision.

## UI mapping

| Outcome | Local protection | Dialog | Recovery |
| --- | --- | --- | --- |
| `removed` | Removed | Close after success announcement | None |
| `removed-cleanup-pending` | Removed | Show partial success; may close after acknowledgement | Stay signed in/online; retry is automatic or explicit |
| `unlock-required` | Unchanged | Remain open | Unlock and retry |
| `activation-pending` | Unchanged | Remain open | Wait for protection setup to finish |
| `removal-pending` | Derived from durable intent | Remain open | Resume the existing operation |
| decrypt blocker | Unchanged | Remain open | Reload/unlock and retry; never advise reset |
| `vault-revision-mismatch` | Unchanged | Remain open | Reload the current journal state |
| `owner-adoption-pending` | Unchanged | Remain open | Keep the app open and signed in; retry after normal owner adoption |
| `owner-changed` | Unchanged for this attempt | Remain open or close on account transition | Return to the original account |
| `fresh-auth-required` | Unchanged; an exact existing fence may remain paused | Remain open | Complete recent account verification and resume the same operation |
| `storage-failed` | Derived from durable phase | Remain open | Retry while preserving partial-success truth |

All copy is mapped in eight locales. UI/logging receives blocker class only, never record identity or raw crypto/storage error.

## Contract tests

- One red-first test per blocker class and protected object class.
- Fingerprint equality across all rows/settings/native/queue for every preflight blocker.
- Forced transaction abort, row snapshot change, vault revision change, and account switch.
- Native cleanup failure after local success and owner switch immediately before native cleanup.
- Queue enqueue failure, offline replay, restart before journal mount, duplicate click/action replay.
- Global merge negative control.
- Remote backup CAS, vault CAS zero-row/abort, extra protected row, media upload/metadata/delete failure boundaries.
- Sign-out/account-switch guard with queue empty but durable removal intent present.
- Migration expand/contract defaults, legacy-client admission, strict-owner promotion, paused protected-write rejection, plaintext conversion admission, and forward recovery.
