# Data Model: PWA Shell Lifecycle

This feature adds no persistent data model, Dexie table, migration, remote record, telemetry payload, or production write. All entities below are in-memory process state and must be discarded when the Web/PWA document closes.

## Entities

| Entity | Fields | Validation and lifecycle |
| --- | --- | --- |
| `AppRuntimeSurface` | exact union `browser | installed-pwa | capacitor | tauri` | Derived from existing platform helpers plus guarded browser capabilities; must not be inferred from URL parameters or persisted. Safari Home Screen is `installed-pwa`; native iOS and Android are `capacitor`. |
| `InstallSnapshot` | `state: PwaInstallState`, `manualHelpAvailable`, `errorKind`, `lastPromptOutcome?` | `PwaInstallState = installed | promptable | manual | unavailable | prompting | dismissed | error`. `accepted` may appear only as an action outcome and never proves installation. Opaque browser prompt is never exposed in diagnostics/storage. |
| `UpdateSnapshot` | `phase: PwaUpdatePhase`, `attemptId`, `failureKind` | `PwaUpdatePhase = idle | waiting | preparing | blocked | activating | error`. `attemptId` is process-local and not a user identifier; controller confirmation/reload are guarded side effects, not extra phases. |
| `DirtyWriterRegistration` | `name`, `awaitSettled()` | Names come from fixed code-owned literals; callback resolves/rejects without returning user data. Registry closes per attempt and cannot accept late registrations. |
| `PwaLifecycleDiagnostic` | `transition`, `outcome`, `route` | `route` is a normalized pathname identifier only. Query, fragment, URL credentials, identifiers, cache keys, install-event details, and user data are invalid fields. |
| `OwnedCacheName` | `name` | Valid only when the exact owner predicate accepts it; no substring or user-provided names are valid. |

## Relationships

`AppRuntimeSurface` gates `InstallSnapshot` and `UpdateSnapshot`. `UpdateSnapshot` owns one closed set of `DirtyWriterRegistration` entries for an attempt. A terminal transition may emit one `PwaLifecycleDiagnostic`. `OwnedCacheName` is evaluated only by the service-worker cleanup boundary.

## Integrity and recovery rules

- No entity is local truth for habits, moods, focus, journal, account, sync cursor, queue, or tombstone data.
- A writer's completion is a reload-safety signal, not proof that remote sync completed.
- Rejection, cancellation, timeout, untrusted message, missing waiting worker, or missing controller change transitions the update to `blocked` or `failed`; it must not synthesize success.
- Reopening the app starts a fresh in-memory lifecycle state and rereads actual browser/worker state. It does not restore an old prompt event or fabricate a previous install/update result.
- No schema migration or backward/forward data compatibility work applies. Existing Dexie and offline queue contracts remain unaffected unless future implementation evidence proves otherwise.
