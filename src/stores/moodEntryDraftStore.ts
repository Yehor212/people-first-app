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
import { safeSessionStorageGet, safeSessionStorageSet } from "@/lib/safeJson";
import { SSK } from "@/lib/storageKeys";
import { registerAccountBoundaryRuntimeReset } from "@/storage/accountBoundaryRuntime";

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
  /** Optional short note captured on the refine step before Diary handoff. */
  note: string;
}

export interface MoodEntryDraftStore extends MoodEntryDraft {
  setValence: (valence: number) => void;
  setScope: (scope: MoodDraftScope) => void;
  setSpecificTime: (iso: string | null) => void;
  setEmotion: (emotion: string | null) => void;
  setNote: (note: string) => void;
  reset: () => void;
  /** True when the orb handoff can proceed without missing required timing info. */
  isComplete: () => boolean;
}

const INITIAL: MoodEntryDraft = {
  valence: null,
  scope: "now",
  specificTime: null,
  emotion: null,
  note: "",
};

function clampValence(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(-1, Math.min(1, value));
}

function normalizeDraft(value: Partial<MoodEntryDraft> | null | undefined): MoodEntryDraft {
  const scope =
    value?.scope === "day" || value?.scope === "specific" || value?.scope === "now"
      ? value.scope
      : INITIAL.scope;

  return {
    valence: clampValence(value?.valence),
    scope,
    specificTime:
      scope === "specific" && typeof value?.specificTime === "string"
        ? value.specificTime
        : null,
    emotion: typeof value?.emotion === "string" ? value.emotion : null,
    note: typeof value?.note === "string" ? value.note : "",
  };
}

function readInitialDraft(): MoodEntryDraft {
  if (typeof window === "undefined") return INITIAL;
  return normalizeDraft(
    safeSessionStorageGet<Partial<MoodEntryDraft> | null>(SSK.MOOD_ENTRY_DRAFT, null),
  );
}

function pickDraft(state: MoodEntryDraft): MoodEntryDraft {
  return {
    valence: state.valence,
    scope: state.scope,
    specificTime: state.specificTime,
    emotion: state.emotion,
    note: state.note,
  };
}

function persistDraft(draft: MoodEntryDraft) {
  if (typeof window === "undefined") return;
  safeSessionStorageSet(SSK.MOOD_ENTRY_DRAFT, draft);
}

function clearDraftPersistence() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SSK.MOOD_ENTRY_DRAFT);
  } catch {
    // best-effort only: storage can be disabled/private, but mood flow must continue
  }
}

export const useMoodEntryDraftStore = create<MoodEntryDraftStore>((set, get) => ({
  ...readInitialDraft(),
  setValence: (valence) =>
    set((state) => {
      const next = { ...pickDraft(state), valence: clampValence(valence) };
      persistDraft(next);
      return { valence: next.valence };
    }),
  setScope: (scope) =>
    set((state) => {
      const next = {
        ...pickDraft(state),
        scope,
        // Reset specificTime when leaving "specific"
        specificTime: scope === "specific" ? state.specificTime : null,
      };
      persistDraft(next);
      return {
        scope: next.scope,
        specificTime: next.specificTime,
      };
    }),
  setSpecificTime: (specificTime) =>
    set((state) => {
      const next = { ...pickDraft(state), specificTime };
      persistDraft(next);
      return { specificTime };
    }),
  setEmotion: (emotion) =>
    set((state) => {
      const next = { ...pickDraft(state), emotion };
      persistDraft(next);
      return { emotion };
    }),
  setNote: (note) =>
    set((state) => {
      const next = { ...pickDraft(state), note };
      persistDraft(next);
      return { note };
    }),
  // Test/e2e hook: expose setters on window for deterministic baseline capture
  // without relying on framer-motion drag simulation.
  ...(typeof window !== "undefined"
    ? (() => {
        interface WindowWithDraft {
          __zenMoodDraft?: {
            setValence: (v: number) => void;
            setScope: (s: MoodDraftScope) => void;
            setEmotion: (e: string | null) => void;
            setNote: (note: string) => void;
          };
        }
        const w = window as unknown as WindowWithDraft;
        setTimeout(() => {
          w.__zenMoodDraft = {
            setValence: (v) => useMoodEntryDraftStore.getState().setValence(v),
            setScope: (s) => useMoodEntryDraftStore.getState().setScope(s),
            setEmotion: (e) => useMoodEntryDraftStore.getState().setEmotion(e),
            setNote: (note) => useMoodEntryDraftStore.getState().setNote(note),
          };
        }, 0);
        return {};
      })()
    : {}),
  reset: () => {
    clearDraftPersistence();
    set({ ...INITIAL });
  },
  isComplete: () => {
    const s = get();
    if (s.scope === "specific" && !s.specificTime) return false;
    return s.valence !== null;
  },
}));

registerAccountBoundaryRuntimeReset(() => {
  useMoodEntryDraftStore.getState().reset();
});
