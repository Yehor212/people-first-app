---
description: Data export & import rules — applies to exportService.ts, backup.ts, cloudSync.ts
---

# Data Export & Import Rules

- Export format must be versioned — include `{ version: N }` in every export payload
- Backward compatibility: import must handle all previous format versions gracefully
- Preserve all data on import failure — rollback to pre-import state if any step fails
- Export completeness: verify all user data tables are included, log any skipped tables
- Sync conflict resolution: server timestamp wins (always prefer server time)
- Blob storage: validate blob integrity (size, type) before upload/download
- Import validation: Zod-parse imported data before writing to IndexedDB
- Strip internal IDs and deletion tracker state from user-facing exports
- Progress feedback: large exports/imports must show progress to user
- Test round-trip: export → import → verify data matches original
