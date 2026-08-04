export { getEntryCount, saveEntry } from "./journalStorage";
export { formatLocalizedCount } from "./journalWordCount";
export { LOCK_TIMEOUT_OPTIONS, setAutoLockMs } from "./useJournalSecurity";
export {
  ensureOwnerBoundJournalSecurityMigration,
  getPendingJournalSecurityMigrationRevisionForOwner,
  getPendingJournalSecurityRemovalRevisionForOwner,
  hasPendingInstallationJournalSecurityRemoval,
  hasPendingJournalSecurityMigrationForOwner,
  hasPendingJournalSecurityRemovalForOwner,
  runJournalSecurityMigration,
} from "./journalSecurityMigration";
export { resumePendingJournalPasswordRemoval } from "./journalSecurityRemovalLifecycle";
export { hasPersistentJournalProtection } from "./journalWriteSecurity";
export { reconcileJournalReminderAtStartup } from "./useJournalReminder";
export type { JournalEntryPrefill, JournalEntrySuggestion } from "./types";
