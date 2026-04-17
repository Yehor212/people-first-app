/**
 * moodEntryDraftStore — Phase 3-A.4b transient draft slice.
 *
 * Purpose: build up a mood entry across UI steps (valence → scope → emotion)
 * before committing to `userDataStore.moods`. Cleared on confirm or skip.
 *
 * Scope values:
 *  - `now`      → "в этот момент" (default; momentary)
 *  - `day`      → "за весь день" (retrospective/overall)
 *  - `specific` → "в конкретное время" (reveals time picker)
 *
 * Not persisted to IndexedDB / Supabase — purely runtime. Survives tab nav
 * within a session (so user tapping Habits then back to Orb keeps draft),
 * cleared by `reset()` or after `commit()` (caller invokes reset post-save).
 */

import { create } from "zustand";

export type MoodDraftScope = "now" | "day" | "specific";

export interface MoodEntryDraft {
  /** -1.0 (very unpleasant) → +1.0 (very pleasant). `null` = not yet chosen. */
  valence: number | null;
  /** When did this apply? */
  scope: MoodDraftScope;
  /** ISO string when scope === "specific"; otherwise null. */
  specificTime: string | null;
  /** Chosen emotion tag key (see emotionTags.ts). null = not yet chosen. */
  emotion: string | null;
}

export interface MoodEntryDraftStore extends MoodEntryDraft {
  setValence: (valence: number) => void;
  setScope: (scope: MoodDraftScope) => void;
  setSpecificTime: (iso: string | null) => void;
  setEmotion: (emotion: string | null) => void;
  reset: () => void;
  /** True when valence AND emotion AND scope are all resolved (ready to confirm). */
  isComplete: () => boolean;
}

const INITIAL: MoodEntryDraft = {
  valence: null,
  scope: "now",
  specificTime: null,
  emotion: null,
};

export const useMoodEntryDraftStore = create<MoodEntryDraftStore>((set, get) => ({
  ...INITIAL,
  setValence: (valence) => set({ valence }),
  setScope: (scope) =>
    set((state) => ({
      scope,
      // Reset specificTime when leaving "specific"
      specificTime: scope === "specific" ? state.specificTime : null,
    })),
  setSpecificTime: (specificTime) => set({ specificTime }),
  setEmotion: (emotion) => set({ emotion }),
  // Test/e2e hook: expose setters on window for deterministic baseline capture
  // without relying on framer-motion drag simulation.
  ...(typeof window !== "undefined"
    ? (() => {
        interface WindowWithDraft {
          __zenMoodDraft?: {
            setValence: (v: number) => void;
            setScope: (s: MoodDraftScope) => void;
            setEmotion: (e: string | null) => void;
          };
        }
        const w = window as unknown as WindowWithDraft;
        setTimeout(() => {
          w.__zenMoodDraft = {
            setValence: (v) => useMoodEntryDraftStore.getState().setValence(v),
            setScope: (s) => useMoodEntryDraftStore.getState().setScope(s),
            setEmotion: (e) => useMoodEntryDraftStore.getState().setEmotion(e),
          };
        }, 0);
        return {};
      })()
    : {}),
  reset: () => set({ ...INITIAL }),
  isComplete: () => {
    const s = get();
    if (s.valence === null) return false;
    if (s.emotion === null) return false;
    if (s.scope === "specific" && !s.specificTime) return false;
    return true;
  },
}));
