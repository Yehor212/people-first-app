export { getEntryCount, saveEntry } from "./journalStorage";
export { formatLocalizedCount } from "./journalWordCount";
export { LOCK_TIMEOUT_OPTIONS, setAutoLockMs } from "./useJournalSecurity";
export { hasPendingJournalSecurityMigrationForOwner } from "./journalSecurityMigration";
export { hasPersistentJournalProtection } from "./journalWriteSecurity";
export type { JournalEntryPrefill, JournalEntrySuggestion } from "./types";
