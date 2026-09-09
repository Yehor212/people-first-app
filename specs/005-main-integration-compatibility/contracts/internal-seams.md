# Internal Compatibility Contracts

eventSyncWriter.ts owns the existing producer API: writeEvent, writeEventAndBroadcast, writeQueuedEventAndBroadcast, broadcastCommittedSyncEvent, getPersistentDeviceId, clearDeviceIdCache, isSyncEvent, isSyncEventWriteIntent and normalizeSyncEventWriteIntent, preserving types and signatures. It also exposes the unchanged validateEventSyncNetworkOwner helper to the consumer.

eventSync.ts retains cursor/delta/recovery code and re-exports the historical producer API. Old/new imports must be identical function objects sharing one cache, not wrappers or copies. The writer has no dependency on its delta consumer or journal recovery. Seven sync producers and automation device lookup use the writer. Producer-specific mocks follow the actual dependency with unchanged behavioral assertions; facade integration tests retain the old import.

deletionTrackerKeys.ts contains the original constant object and type with no persistence import. The tracker re-exports the same object; the setting policy uses the leaf. Values, transaction and in-flight behavior remain unchanged.

React declarative inert is boolean under the original condition. Imperative DOM attributes remain unchanged. Nullable DOM refs remain nullable; timer refs remain undefined until initialized.

Configured cycle analysis still includes async edges. Existing writer invariants move to the writer, delta invariants remain at the consumer and additional facade-wiring assertions prevent accidental API removal. No external endpoint, required assertion or forbidden-pattern check is removed.
