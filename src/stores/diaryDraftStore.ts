/**
 * diaryDraftStore — Phase 3-A.4b transient pre-population slice.
 *
 * When the Orb mood-entry flow completes, the saved mood context is dropped
 * here for the Diary page to expose as a soft writing suggestion. Diary should
 * stay history-first; the context is consumed only when the user starts or
 * dismisses that suggestion.
 *
 * Not persisted. No cross-session survival. If the user navigates away before
 * Diary reads, the draft silently evaporates on the next reset.
 */

import { create } from "zustand";
import type { MoodDraftScope } from "./moodEntryDraftStore";
import type { MoodType } from "@/types";

export interface PendingMoodContext {
  valence: number;
  mood: MoodType;
  scope: MoodDraftScope;
  specificTime: string | null;
  emotion: string | null;
  note?: string | null;
  /** ms epoch when the orb flow committed. */
  committedAt: number;
}

export interface DiaryDraftStore {
  pendingMoodContext: PendingMoodContext | null;
  setPendingMoodContext: (ctx: PendingMoodContext) => void;
  clearPendingMoodContext: () => void;
  consumePendingMoodContext: () => PendingMoodContext | null;
}

export const useDiaryDraftStore = create<DiaryDraftStore>((set, get) => ({
  pendingMoodContext: null,
  setPendingMoodContext: (ctx) => set({ pendingMoodContext: ctx }),
  clearPendingMoodContext: () => set({ pendingMoodContext: null }),
  consumePendingMoodContext: () => {
    const ctx = get().pendingMoodContext;
    set({ pendingMoodContext: null });
    return ctx;
  },
}));
