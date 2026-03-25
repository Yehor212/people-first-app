---
description: State store rules — applies to src/stores/**/*.{ts,tsx}
---

# State Store Rules (Law 14: State Integrity)

- Array validation in userDataStore: always validate array existence before operations
- Use Zustand set() with immutable patterns for all state updates
- Deletion tracker IDs are PERMANENT — always assign fresh IDs for new records
- Pull BEFORE push in all sync operations
- Bridge pattern: `useHydrate*` files bridge IndexedDB → Zustand on app load
- State shape changes require a migration plan (separate PR, phased approach)
- Keep store actions pure — side effects belong in hooks/components
- Dual storage: Zustand (runtime) + IndexedDB (persistence). Both must agree.
- Debug chain: UI → Store → IndexedDB → Tracker → Cloud → Blob → Sync → Import
