/**
 * Barrel re-export for all per-entity sync modules.
 * Import from '@/storage/sync' or via re-exports from '@/storage/realtimeSync'.
 */

// Shared utilities
export { detectNetworkError, processBatched, BATCH_SIZE, BATCH_DELAY } from "./syncUtils";

// Mood sync
export { syncMood, deleteMoodFromCloud, pullMoodsFromCloud } from "./syncMoods";

// Habit sync
export { syncHabit, deleteHabitFromCloud, syncHabitCompletion } from "./syncHabits";

// Focus session sync
export { syncFocusSession, pullFocusFromCloud } from "./syncFocus";

// Gratitude sync
export { syncGratitude, deleteGratitudeFromCloud, pullGratitudeFromCloud } from "./syncGratitude";

// Settings sync
export { syncSetting, deleteSettingFromCloud, deleteRemoteJournalVault } from "./syncSettings";
export type { RemoteVaultDeleteInput } from "./syncSettings";

// Required remote-commit contract used by journal-security cleanup.
export { RequiredRemoteCommitError } from "./remoteCommit";
export type {
  RequiredRemoteCommitFailureOutcome,
  RequiredRemoteCommitOptions,
  RequiredRemoteCommitResult,
} from "./remoteCommit";

// Journal sync
export {
  syncJournalEntry,
  deleteJournalEntryFromCloud,
  syncJournalPhoto,
  syncJournalAudio,
  deleteJournalPhotoFromCloud,
  deleteJournalAudioFromCloud,
} from "./syncJournal";

// User stats
export { fetchUserStats } from "./fetchUserStats";
