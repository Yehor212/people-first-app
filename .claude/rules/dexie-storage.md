---
description: Dexie/IndexedDB rules — applies to src/storage/**/*.ts
---

# Dexie / IndexedDB Rules (Law 14: State Integrity)

- Schema migrations: use Dexie's `.version(N).stores()` upgrade chain — preserve all data during migration
- Bridge pattern: `useHydrate*` files bridge IndexedDB → Zustand on app load. Both must agree.
- Route all `db.table.put/add/delete` operations through repository files in `src/storage/`
- Deletion tracker IDs are PERMANENT — always assign fresh IDs for new records
- Backup before destructive operations: export to blob before schema changes
- Pull BEFORE push in cloud sync — always preserve newer server data over local
- Transaction safety: wrap multi-table operations in `db.transaction()` for atomicity
- IndexedDB lacks foreign keys — maintain referential integrity in application code
- Test migrations: verify data survives version upgrades (old data + new schema)
- Storage quota: handle `QuotaExceededError` gracefully — notify user and remain operational
