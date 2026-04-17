/**
 * diaryDraftStore — Phase 3-A.4b transient pre-population slice.
 *
 * When the Orb mood-entry flow completes, the saved mood context is dropped
 * here for the Diary page to pick up on mount. Diary page consumes then clears.
 *
 * Not persisted. No cross-session survival. If the user navigates away before
 * Diary reads, the draft silently evaporates on the next reset.
 */

import { create } from "zustand";
import type { MoodDraftScope } from "./moodEntryDraftStore";

export interface PendingMoodContext {
  valence: number;
  scope: MoodDraftScope;
  specificTime: string | null;
  emotion: string | null;
  /** ms epoch when the orb flow committed. */
  committedAt: number;
}

export interface DiaryDraftStore {
  pendingMoodContext: PendingMoodContext | null;
  setPendingMoodContext: (ctx: PendingMoodContext) => void;
  clearPendingMoodContext: () => void;
}

export const useDiaryDraftStore = create<DiaryDraftStore>((set) => ({
  pendingMoodContext: null,
  setPendingMoodContext: (ctx) => set({ pendingMoodContext: ctx }),
  clearPendingMoodContext: () => set({ pendingMoodContext: null }),
}));
