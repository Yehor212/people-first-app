export { getEntryCount, saveEntry } from "./journalStorage";
export { formatLocalizedCount } from "./journalWordCount";
export { LOCK_TIMEOUT_OPTIONS, setAutoLockMs } from "./useJournalSecurity";
export {
  getPendingJournalSecurityMigrationRevisionForOwner,
  hasPendingJournalSecurityMigrationForOwner,
} from "./journalSecurityMigration";
export { hasPersistentJournalProtection } from "./journalWriteSecurity";
export { reconcileJournalReminderAtStartup } from "./useJournalReminder";
export type { JournalEntryPrefill, JournalEntrySuggestion } from "./types";
