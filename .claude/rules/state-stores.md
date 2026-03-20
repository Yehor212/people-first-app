---
description: State store rules — applies to src/stores/**/*.{ts,tsx}
---

# State Store Rules (Law 14: State Integrity)

- Array validation in userDataStore: always validate array existence before operations
- No direct mutations — use Zustand set() with immutable patterns
- Deletion tracker IDs are PERMANENT — never reuse or reassign
- Pull BEFORE push in all sync operations
- Bridge pattern: `useHydrate*` files bridge IndexedDB → Zustand on app load
- State shape changes require a migration plan (separate PR, phased approach)
- No side effects in store actions — side effects belong in hooks/components
- Dual storage: Zustand (runtime) + IndexedDB (persistence). Both must agree.
- Debug chain: UI → Store → IndexedDB → Tracker → Cloud → Blob → Sync → Import
