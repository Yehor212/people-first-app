---
description: Async & race condition rules — applies to syncOrchestrator, offlineQueue, authStateManager, *Sync files
---

# Async & Race Condition Rules (Law 25: Race Law)

- Pull BEFORE push in ALL sync operations — always preserve remote state over stale local
- AbortController for cancellable operations — abort on unmount or navigation
- Queue ordering: FIFO by default, with priority override for auth-critical operations
- Retry with exponential backoff + jitter — always wait before retrying on failure
- Offline-first: operations must queue gracefully when offline, replay when online
- Auth state machine: single source of truth, serialize all auth checks sequentially
- Sync conflict resolution: last-write-wins with server timestamp (always prefer server time)
- Always handle the rejection path in every `.then().catch()` chain
- Listener cleanup: every `addEventListener`/`subscribe` must have a matching cleanup
- Race condition test: if two rapid taps could trigger the same operation, it must be debounced or locked
