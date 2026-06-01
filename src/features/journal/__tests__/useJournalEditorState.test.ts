/**
 * useJournalEditorState — Save State Machine, Word Count Milestones & Draft Persistence
 *
 * The full hook has too many side-effects and dependencies to render in isolation,
 * so we extract and test the PURE LOGIC patterns that drive save state, milestones,
 * and draft persistence.
 *
 * T01: Save state machine transitions
 * T02: Word count milestone detection
 * T03: Dirty baseline / unsaved detection
 * T06: Draft persistence lifecycle
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { SaveState } from "../SaveIndicator";

// ══════════════════════════════════════════════════════════════
// Extracted logic: Save state machine (mirrors useJournalEditorState)
// ══════════════════════════════════════════════════════════════

function useSaveStateMachine(onSave: () => Promise<void>, hasContent: boolean) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveStartRef = useRef(0);
  const MIN_SAVE_DISPLAY_MS = 400;

  const handleSave = useCallback(async () => {
    if (!hasContent) return;
    setSaveState("saving");
    saveStartRef.current = Date.now();
    try {
      await onSave();
      // Enforce minimum display time for "saving" state (prevents flicker)
      const elapsed = Date.now() - saveStartRef.current;
      if (elapsed < MIN_SAVE_DISPLAY_MS) {
        await new Promise((r) => setTimeout(r, MIN_SAVE_DISPLAY_MS - elapsed));
      }
      setSaveState("saved");
      // Auto-transition saved -> idle after 2s
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }, [onSave, hasContent]);

  const handleRetry = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  return { saveState, handleSave, handleRetry };
}

// ══════════════════════════════════════════════════════════════
// Extracted logic: Word count milestones (mirrors useJournalEditorState)
// ══════════════════════════════════════════════════════════════

function useMilestoneDetection(wordCount: number) {
  const MILESTONES = useMemo(() => [100, 250, 500, 1000], []);
  const [milestoneTriggered, setMilestoneTriggered] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const prevWordCountRef = useRef<number | null>(null);
  const hapticFired = useRef(false);

  useEffect(() => {
    // Initialize prevWordCountRef on first render (prevents false milestone on load)
    if (prevWordCountRef.current === null) {
      prevWordCountRef.current = wordCount;
      return;
    }
    const prev = prevWordCountRef.current;
    for (const threshold of MILESTONES) {
      if (prev < threshold && wordCount >= threshold) {
        setMilestoneTriggered(threshold);
        hapticFired.current = true;
        if (threshold === 1000) {
          setShowConfetti(true);
        }
        break; // Only fire the lowest newly-crossed milestone
      }
    }
    prevWordCountRef.current = wordCount;
  }, [wordCount, MILESTONES]);

  // Auto-clear milestone animation after 300ms
  useEffect(() => {
    if (milestoneTriggered === null) return;
    const timer = setTimeout(() => setMilestoneTriggered(null), 300);
    return () => clearTimeout(timer);
  }, [milestoneTriggered]);

  return { milestoneTriggered, showConfetti, hapticFired };
}

// ══════════════════════════════════════════════════════════════
// Extracted logic: Dirty baseline (mirrors useJournalEditorState)
// ══════════════════════════════════════════════════════════════

interface EditorSnapshot {
  title: string;
  date: string;
  content: string;
  stickers: string;
  photoIds: string;
  audioIds: string;
  mood?: string;
  tags: string;
  habitSnapshot: string;
  theme: string;
  font: string;
  inkColor: string;
  paperTexture: string;
  paperColor: string;
  bgIntensity: string;
  particleSpeed: string;
  bgPattern: string;
  fontSize: string;
  photoLayout: string;
}

function makeSnapshot(overrides: Partial<EditorSnapshot> = {}): EditorSnapshot {
  return {
    title: "Hopeful",
    date: "2026-04-21",
    content: "<p>Prompt</p>",
    stickers: JSON.stringify([]),
    photoIds: JSON.stringify([]),
    audioIds: JSON.stringify([]),
    mood: "good",
    tags: JSON.stringify(["hopeful"]),
    habitSnapshot: JSON.stringify([]),
    theme: "dark",
    font: "caveat",
    inkColor: "#ffffff",
    paperTexture: "clean",
    paperColor: "dark",
    bgIntensity: "full",
    particleSpeed: "slow",
    bgPattern: "none",
    fontSize: "medium",
    photoLayout: JSON.stringify({}),
    ...overrides,
  };
}

function computeIsDirty(initial: EditorSnapshot, current: EditorSnapshot) {
  return (
    current.title !== initial.title ||
    current.date !== initial.date ||
    current.content !== initial.content ||
    current.stickers !== initial.stickers ||
    current.photoIds !== initial.photoIds ||
    current.audioIds !== initial.audioIds ||
    current.mood !== initial.mood ||
    current.tags !== initial.tags ||
    current.habitSnapshot !== initial.habitSnapshot ||
    current.theme !== initial.theme ||
    current.font !== initial.font ||
    current.inkColor !== initial.inkColor ||
    current.paperTexture !== initial.paperTexture ||
    current.paperColor !== initial.paperColor ||
    current.bgIntensity !== initial.bgIntensity ||
    current.particleSpeed !== initial.particleSpeed ||
    current.bgPattern !== initial.bgPattern ||
    current.fontSize !== initial.fontSize ||
    current.photoLayout !== initial.photoLayout
  );
}

// ══════════════════════════════════════════════════════════════
// T01: Save State Machine
// ══════════════════════════════════════════════════════════════

describe("T01: Save state machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("idle → saving → saved → idle (happy path with 2s timeout)", async () => {
    const onSave = vi.fn(() => Promise.resolve());

    const { result } = renderHook(() => useSaveStateMachine(onSave, true));

    expect(result.current.saveState).toBe("idle");

    // Trigger save
    await act(async () => {
      const p = result.current.handleSave();
      // Advance past MIN_SAVE_DISPLAY_MS (400ms)
      vi.advanceTimersByTime(400);
      await p;
    });

    expect(result.current.saveState).toBe("saved");

    // Advance 2s to auto-transition back to idle
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.saveState).toBe("idle");
  });

  it("idle → saving → error (when onSave rejects)", async () => {
    const onSave = vi.fn(() => Promise.reject(new Error("network fail")));

    const { result } = renderHook(() => useSaveStateMachine(onSave, true));

    expect(result.current.saveState).toBe("idle");

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.saveState).toBe("error");
  });

  it("MIN_SAVE_DISPLAY_MS (400ms) — saving state visible for at least 400ms even if save is instant", async () => {
    // onSave resolves instantly
    const onSave = vi.fn(() => Promise.resolve());

    const { result } = renderHook(() => useSaveStateMachine(onSave, true));

    let savePromise: Promise<void>;
    act(() => {
      savePromise = result.current.handleSave();
    });

    // Save resolved instantly but MIN_SAVE_DISPLAY_MS not yet passed
    // State should be "saving" still
    expect(result.current.saveState).toBe("saving");

    // Advance only 200ms — still saving
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.saveState).toBe("saving");

    // Advance remaining 200ms to hit 400ms total
    await act(async () => {
      vi.advanceTimersByTime(200);
      await savePromise!;
    });

    expect(result.current.saveState).toBe("saved");
  });

  it("handleRetry calls handleSave again", async () => {
    const onSave = vi.fn(() => Promise.resolve());

    const { result } = renderHook(() => useSaveStateMachine(onSave, true));

    await act(async () => {
      result.current.handleRetry();
      vi.advanceTimersByTime(500);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("handleSave does nothing when hasContent is false", async () => {
    const onSave = vi.fn(() => Promise.resolve());

    const { result } = renderHook(() => useSaveStateMachine(onSave, false));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.saveState).toBe("idle");
  });
});

// ══════════════════════════════════════════════════════════════
// T02: Word Count Milestones
// ══════════════════════════════════════════════════════════════

describe("T02: Word count milestones", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("no milestone fires on initial load (prevWordCountRef initialized to current count)", () => {
    // Start with 150 words — already above 100 threshold
    const { result } = renderHook(() => useMilestoneDetection(150));

    expect(result.current.milestoneTriggered).toBeNull();
    expect(result.current.hapticFired.current).toBe(false);
  });

  it("crossing 100-word threshold fires milestone 100", () => {
    const { result, rerender } = renderHook(
      ({ wc }) => useMilestoneDetection(wc),
      { initialProps: { wc: 90 } }
    );

    // Initial: prevWordCountRef set to 90, no milestone
    expect(result.current.milestoneTriggered).toBeNull();

    // Cross the 100-word threshold
    rerender({ wc: 105 });

    expect(result.current.milestoneTriggered).toBe(100);
    expect(result.current.hapticFired.current).toBe(true);
  });

  it("only the lowest newly-crossed milestone fires (not all)", () => {
    const { result, rerender } = renderHook(
      ({ wc }) => useMilestoneDetection(wc),
      { initialProps: { wc: 90 } }
    );

    // Jump from 90 to 300 — crosses both 100 and 250
    rerender({ wc: 300 });

    // Should fire only 100 (the lowest), not 250
    expect(result.current.milestoneTriggered).toBe(100);
  });

  it("re-crossing same threshold after going back below doesn't prevent re-fire", () => {
    const { result, rerender } = renderHook(
      ({ wc }) => useMilestoneDetection(wc),
      { initialProps: { wc: 90 } }
    );

    // Cross 100
    rerender({ wc: 105 });
    expect(result.current.milestoneTriggered).toBe(100);

    // Clear milestone
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.milestoneTriggered).toBeNull();

    // Go back below 100
    rerender({ wc: 95 });

    // Cross again
    rerender({ wc: 105 });
    // Since prev (95) < 100 and wordCount (105) >= 100, milestone fires again
    expect(result.current.milestoneTriggered).toBe(100);
  });

  it("staying above threshold and incrementing doesn't re-fire", () => {
    const { result, rerender } = renderHook(
      ({ wc }) => useMilestoneDetection(wc),
      { initialProps: { wc: 90 } }
    );

    // Cross 100
    rerender({ wc: 105 });
    expect(result.current.milestoneTriggered).toBe(100);

    // Clear milestone
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.milestoneTriggered).toBeNull();
    result.current.hapticFired.current = false;

    // Increment while staying above 100 but below 250
    rerender({ wc: 110 });
    rerender({ wc: 120 });

    // No new milestone should fire
    expect(result.current.milestoneTriggered).toBeNull();
    expect(result.current.hapticFired.current).toBe(false);
  });

  it("milestone auto-clears after 300ms", () => {
    const { result, rerender } = renderHook(
      ({ wc }) => useMilestoneDetection(wc),
      { initialProps: { wc: 90 } }
    );

    // Cross 100
    rerender({ wc: 105 });
    expect(result.current.milestoneTriggered).toBe(100);

    // Before 300ms — still showing
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.milestoneTriggered).toBe(100);

    // After 300ms total — auto-cleared
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.milestoneTriggered).toBeNull();
  });

  it("1000-word milestone triggers confetti", () => {
    const { result, rerender } = renderHook(
      ({ wc }) => useMilestoneDetection(wc),
      { initialProps: { wc: 990 } }
    );

    expect(result.current.showConfetti).toBe(false);

    rerender({ wc: 1005 });

    expect(result.current.milestoneTriggered).toBe(1000);
    expect(result.current.showConfetti).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// T03: Dirty baseline / unsaved detection
// ══════════════════════════════════════════════════════════════

describe("T03: Dirty baseline", () => {
  it("prefill-backed editor starts clean when current state matches the prefill snapshot", () => {
    const initial = makeSnapshot({
      title: "Hopeful",
      content: "<p><strong>Specific - 14:30</strong></p><p>Describe a moment that stood out today.</p>",
      tags: JSON.stringify(["hopeful"]),
    });

    expect(computeIsDirty(initial, initial)).toBe(false);
  });

  it("changing only the date marks the editor dirty", () => {
    const initial = makeSnapshot();
    const current = makeSnapshot({ date: "2026-04-22" });

    expect(computeIsDirty(initial, current)).toBe(true);
  });

  it("changing only theme metadata or habit snapshot marks the editor dirty", () => {
    const initial = makeSnapshot();
    const current = makeSnapshot({
      theme: "ocean",
      habitSnapshot: JSON.stringify([
        { habitId: "habit-1", habitName: "Read", habitIcon: "book", completed: true },
      ]),
    });

    expect(computeIsDirty(initial, current)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// Extracted logic: Draft persistence (mirrors useJournalEditorState)
// ══════════════════════════════════════════════════════════════

interface DraftData {
  title: string;
  date: string;
  content: string;
  stickers: string[];
  photoIds: string[];
  audioIds?: string[];
  mood?: string;
  tags: string[];
  habitSnapshot?: {
    habitId: string;
    habitName: string;
    habitIcon: string;
    completed: boolean;
  }[];
  savedAt: number;
  theme?: string;
  font?: string;
  inkColor?: string;
}

/**
 * Mirrors the draft restore/dismiss/clear-on-save logic from useJournalEditorState.
 * Uses injected saveDraft/loadDraft/clearDraft functions so tests control I/O.
 */
function useDraftPersistence(opts: {
  draftKey: string;
  initialDraft: DraftData | null;
  clearDraftFn: (key: string) => Promise<void>;
  saveDraftFn: (key: string, data: DraftData) => Promise<void>;
  onSave: () => Promise<void>;
  hasContent: boolean;
}) {
  const { draftKey, initialDraft, clearDraftFn, saveDraftFn, onSave, hasContent } = opts;

  // === Content State ===
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("2026-04-21");
  const [content, setContent] = useState("");
  const contentRef = useRef("");
  const [stickers, setStickers] = useState<string[]>([]);
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [audioIds, setAudioIds] = useState<string[]>([]);
  const [mood, setMood] = useState<string | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [habitSnapshot, setHabitSnapshot] = useState<DraftData["habitSnapshot"]>([]);

  // === Draft State ===
  const [draftAvailable, setDraftAvailable] = useState<DraftData | null>(initialDraft);

  // === Auto-save debounce (3s) ===
  const draftTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [draftSavedAt, setDraftSavedAt] = useState(0);

  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      if (
        title ||
        photoIds.length > 0 ||
        contentRef.current ||
        stickers.length > 0 ||
        mood ||
        tags.length > 0 ||
        audioIds.length > 0 ||
        (habitSnapshot?.length || 0) > 0
      ) {
        void saveDraftFn(draftKey, {
          title,
          date,
          content: contentRef.current,
          stickers,
          photoIds,
          audioIds,
          mood,
          tags,
          habitSnapshot,
          savedAt: Date.now(),
        });
        setDraftSavedAt(Date.now());
      }
    }, 3000);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [title, date, stickers, photoIds, audioIds, mood, tags, habitSnapshot, draftKey, saveDraftFn]);

  // === Save State ===
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const handleSave = useCallback(async () => {
    if (!hasContent) return;
    setSaveState("saving");
    try {
      await onSave();
      void clearDraftFn(draftKey);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [onSave, hasContent, clearDraftFn, draftKey]);

  // === Restore draft ===
  const handleRestoreDraft = useCallback(() => {
    if (!draftAvailable) return;
    setTitle(draftAvailable.title);
    setDate(draftAvailable.date);
    contentRef.current = draftAvailable.content;
    setContent(draftAvailable.content);
    setStickers(draftAvailable.stickers);
    setPhotoIds(draftAvailable.photoIds);
    if (draftAvailable.audioIds) setAudioIds(draftAvailable.audioIds);
    setMood(draftAvailable.mood);
    setTags(draftAvailable.tags);
    setHabitSnapshot(draftAvailable.habitSnapshot || []);
    setDraftAvailable(null);
  }, [draftAvailable]);

  // === Dismiss draft ===
  const handleDismissDraft = useCallback(() => {
    void clearDraftFn(draftKey);
    setDraftAvailable(null);
  }, [draftKey, clearDraftFn]);

  return {
    title,
    setTitle,
    date,
    setDate,
    content,
    setPhotoIds,
    stickers,
    photoIds,
    audioIds,
    mood,
    tags,
    habitSnapshot,
    setHabitSnapshot,
    draftAvailable,
    draftSavedAt,
    saveState,
    handleSave,
    handleRestoreDraft,
    handleDismissDraft,
  };
}

// ══════════════════════════════════════════════════════════════
// T06: Draft persistence lifecycle
// ══════════════════════════════════════════════════════════════

describe("T06: Draft persistence lifecycle", () => {
  const DRAFT_KEY = "journal_draft_new";

  const makeDraft = (overrides?: Partial<DraftData>): DraftData => ({
    title: "My Draft Title",
    date: "2026-04-21",
    content: "<p>Some draft content here</p>",
    stickers: ["star", "heart"],
    photoIds: ["photo-1"],
    audioIds: ["audio-1"],
    mood: "happy",
    tags: ["reflection", "morning"],
    habitSnapshot: [
      { habitId: "habit-1", habitName: "Read", habitIcon: "book", completed: true },
    ],
    savedAt: Date.now() - 60_000,
    ...overrides,
  });

  type ClearDraftFn = (key: string) => Promise<void>;
  type SaveDraftFn = (key: string, data: DraftData) => Promise<void>;
  type OnSaveFn = () => Promise<void>;

  let clearDraftFn: Mock<ClearDraftFn>;
  let saveDraftFn: Mock<SaveDraftFn>;
  let onSave: Mock<OnSaveFn>;

  beforeEach(() => {
    vi.useFakeTimers();
    clearDraftFn = vi.fn<ClearDraftFn>(() => Promise.resolve());
    saveDraftFn = vi.fn<SaveDraftFn>(() => Promise.resolve());
    onSave = vi.fn<OnSaveFn>(() => Promise.resolve());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clearDraft called after successful save", async () => {
    const draft = makeDraft();

    const { result } = renderHook(() =>
      useDraftPersistence({
        draftKey: DRAFT_KEY,
        initialDraft: draft,
        clearDraftFn,
        saveDraftFn,
        onSave,
        hasContent: true,
      })
    );

    expect(result.current.saveState).toBe("idle");

    await act(async () => {
      await result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(clearDraftFn).toHaveBeenCalledTimes(1);
    expect(clearDraftFn).toHaveBeenCalledWith(DRAFT_KEY);
    expect(result.current.saveState).toBe("saved");
  });

  it("clearDraft NOT called when save fails", async () => {
    onSave = vi.fn<OnSaveFn>(() => Promise.reject(new Error("save failed")));

    const { result } = renderHook(() =>
      useDraftPersistence({
        draftKey: DRAFT_KEY,
        initialDraft: null,
        clearDraftFn,
        saveDraftFn,
        onSave,
        hasContent: true,
      })
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(clearDraftFn).not.toHaveBeenCalled();
    expect(result.current.saveState).toBe("error");
  });

  it("handleRestoreDraft populates state from draft data", () => {
    const draft = makeDraft({
      title: "Restored Title",
      content: "<p>Restored content</p>",
      stickers: ["moon"],
      photoIds: ["photo-99"],
      audioIds: ["audio-42"],
      mood: "calm",
      tags: ["evening"],
    });

    const { result } = renderHook(() =>
      useDraftPersistence({
        draftKey: DRAFT_KEY,
        initialDraft: draft,
        clearDraftFn,
        saveDraftFn,
        onSave,
        hasContent: false,
      })
    );

    // Draft available before restore
    expect(result.current.draftAvailable).toStrictEqual(draft);
    expect(result.current.title).toBe("");
    expect(result.current.content).toBe("");

    act(() => {
      result.current.handleRestoreDraft();
    });

    // State populated from draft
    expect(result.current.title).toBe("Restored Title");
    expect(result.current.date).toBe("2026-04-21");
    expect(result.current.content).toBe("<p>Restored content</p>");
    expect(result.current.stickers).toStrictEqual(["moon"]);
    expect(result.current.photoIds).toStrictEqual(["photo-99"]);
    expect(result.current.audioIds).toStrictEqual(["audio-42"]);
    expect(result.current.mood).toBe("calm");
    expect(result.current.tags).toStrictEqual(["evening"]);
    expect(result.current.habitSnapshot).toStrictEqual([
      { habitId: "habit-1", habitName: "Read", habitIcon: "book", completed: true },
    ]);

    // draftAvailable cleared after restore
    expect(result.current.draftAvailable).toBeNull();
  });

  it("handleRestoreDraft is a no-op when draftAvailable is null", () => {
    const { result } = renderHook(() =>
      useDraftPersistence({
        draftKey: DRAFT_KEY,
        initialDraft: null,
        clearDraftFn,
        saveDraftFn,
        onSave,
        hasContent: false,
      })
    );

    act(() => {
      result.current.handleRestoreDraft();
    });

    expect(result.current.title).toBe("");
    expect(result.current.content).toBe("");
    expect(result.current.draftAvailable).toBeNull();
  });

  it("handleDismissDraft clears draft and sets draftAvailable to null", () => {
    const draft = makeDraft();

    const { result } = renderHook(() =>
      useDraftPersistence({
        draftKey: DRAFT_KEY,
        initialDraft: draft,
        clearDraftFn,
        saveDraftFn,
        onSave,
        hasContent: false,
      })
    );

    // Draft available before dismiss
    expect(result.current.draftAvailable).toStrictEqual(draft);

    act(() => {
      result.current.handleDismissDraft();
    });

    expect(clearDraftFn).toHaveBeenCalledTimes(1);
    expect(clearDraftFn).toHaveBeenCalledWith(DRAFT_KEY);
    expect(result.current.draftAvailable).toBeNull();
  });

  it("auto-save debounce fires after 3s when content exists", () => {
    const { result } = renderHook(() =>
      useDraftPersistence({
        draftKey: DRAFT_KEY,
        initialDraft: null,
        clearDraftFn,
        saveDraftFn,
        onSave,
        hasContent: true,
      })
    );

    // Set title to trigger auto-save dependency change
    act(() => {
      result.current.setTitle("New title");
    });

    // Not called yet — debounce not elapsed
    expect(saveDraftFn).not.toHaveBeenCalled();

    // Advance 2s — still not called
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(saveDraftFn).not.toHaveBeenCalled();

    // Advance remaining 1s to hit 3s total
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(saveDraftFn).toHaveBeenCalledTimes(1);
    expect(saveDraftFn).toHaveBeenCalledWith(
      DRAFT_KEY,
      expect.objectContaining({ title: "New title", date: "2026-04-21" })
    );
  });

  it("auto-save debounce resets on rapid changes", () => {
    const { result } = renderHook(() =>
      useDraftPersistence({
        draftKey: DRAFT_KEY,
        initialDraft: null,
        clearDraftFn,
        saveDraftFn,
        onSave,
        hasContent: true,
      })
    );

    // First change
    act(() => {
      result.current.setTitle("A");
    });

    // Wait 2s
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(saveDraftFn).not.toHaveBeenCalled();

    // Second change resets the debounce
    act(() => {
      result.current.setTitle("AB");
    });

    // Advance 2s from second change — still not called (need 3s from last change)
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(saveDraftFn).not.toHaveBeenCalled();

    // Advance remaining 1s
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(saveDraftFn).toHaveBeenCalledTimes(1);
    expect(saveDraftFn).toHaveBeenCalledWith(
      DRAFT_KEY,
      expect.objectContaining({ title: "AB", date: "2026-04-21" })
    );
  });

  it("auto-save fires when only habitSnapshot exists and persists it", () => {
    const { result } = renderHook(() =>
      useDraftPersistence({
        draftKey: DRAFT_KEY,
        initialDraft: null,
        clearDraftFn,
        saveDraftFn,
        onSave,
        hasContent: true,
      })
    );

    act(() => {
      result.current.setHabitSnapshot([
        { habitId: "habit-9", habitName: "Walk", habitIcon: "shoe", completed: true },
      ]);
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(saveDraftFn).toHaveBeenCalledWith(
      DRAFT_KEY,
      expect.objectContaining({
        date: "2026-04-21",
        habitSnapshot: [
          { habitId: "habit-9", habitName: "Walk", habitIcon: "shoe", completed: true },
        ],
      })
    );
  });

  it("auto-save does NOT fire when all fields are empty", () => {
    renderHook(() =>
      useDraftPersistence({
        draftKey: DRAFT_KEY,
        initialDraft: null,
        clearDraftFn,
        saveDraftFn,
        onSave,
        hasContent: false,
      })
    );

    // Advance well past debounce
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(saveDraftFn).not.toHaveBeenCalled();
  });
});
