/** Permanent local deletion markers; this leaf must not import persistence. */
export const DELETION_TRACKER_KEYS = {
  habit: "zenflow-deleted-habit-ids",
  journal: "zenflow-deleted-journal-entry-ids",
  mood: "zenflow-deleted-mood-ids",
  focus: "zenflow-deleted-focus-session-ids",
  gratitude: "zenflow-deleted-gratitude-ids",
} as const;

export type DeletionTrackerKey =
  (typeof DELETION_TRACKER_KEYS)[keyof typeof DELETION_TRACKER_KEYS];
