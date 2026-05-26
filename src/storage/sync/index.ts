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
export { syncSetting, deleteSettingFromCloud } from "./syncSettings";

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
