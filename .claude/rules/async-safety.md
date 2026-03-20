---
description: Async & race condition rules — applies to syncOrchestrator, offlineQueue, authStateManager, *Sync files
---

# Async & Race Condition Rules (Law 25: Race Law)

- Pull BEFORE push in ALL sync operations — never overwrite remote with stale local
- AbortController for cancellable operations — abort on unmount or navigation
- Queue ordering: FIFO by default, with priority override for auth-critical operations
- Retry with exponential backoff + jitter — never retry immediately on failure
- Offline-first: operations must queue gracefully when offline, replay when online
- Auth state machine: single source of truth, no parallel auth checks
- Sync conflict resolution: last-write-wins with server timestamp, not client time
- Never `.then().catch()` chain without handling the rejection path
- Listener cleanup: every `addEventListener`/`subscribe` must have a matching cleanup
- Race condition test: if two rapid taps could trigger the same operation, it must be debounced or locked
