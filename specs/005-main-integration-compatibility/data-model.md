# Data Model: No Format Migration

| Existing entity | Retained representation | Invariant |
|---|---|---|
| Device identity | zenflow-device-id in Dexie settings | One cache, shared exports, invalidated on logout |
| Ordered event | Existing SyncEvent fields/entity types and server seq | Commit before broadcast; notifications are signals |
| Retry intent | Existing SyncEventWriteIntent and UUID-compatible idempotencyKey | Durable before return; duplicate resolves original receipt |
| Owner boundary | Session/local-data owner and generation fences | No cross-account write or pending-claim bypass |
| Deletion marker | Existing five zenflow-deleted-*-ids keys | Permanent plus in-flight visibility prevents resurrection |
| Device-local setting | Existing key/prefix classification | Draft/security/cursor/deletion state stays local |
| Journal recovery | Existing owner/revision-bound removal/vault records | Persistence and acknowledgement ordering unchanged |
| Retained UI surface | Existing React state and DOM attribute | Covered/closing content loses interaction without persisted-state change |

No Dexie version, SQL migration, storage key, event type, payload, retention or permission changes. Regression fixtures remain isolated in tests. Rollback changes code/dependencies, not user records.
