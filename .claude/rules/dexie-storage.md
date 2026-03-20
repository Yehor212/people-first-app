---
description: Dexie/IndexedDB rules — applies to src/storage/**/*.ts
---

# Dexie / IndexedDB Rules (Law 14: State Integrity)

- Schema migrations: use Dexie's `.version(N).stores()` upgrade chain — never delete data during migration
- Bridge pattern: `useHydrate*` files bridge IndexedDB → Zustand on app load. Both must agree.
- No direct `db.table.put/add/delete` outside repository files in `src/storage/`
- Deletion tracker IDs are PERMANENT — never reuse or reassign deleted record IDs
- Backup before destructive operations: export to blob before schema changes
- Pull BEFORE push in cloud sync — local must not overwrite newer server data
- Transaction safety: wrap multi-table operations in `db.transaction()` for atomicity
- IndexedDB has no foreign keys — maintain referential integrity in application code
- Test migrations: verify data survives version upgrades (old data + new schema)
- Storage quota: handle `QuotaExceededError` gracefully — notify user, don't crash
