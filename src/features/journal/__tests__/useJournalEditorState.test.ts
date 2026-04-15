/**
 * useJournalEditorState — Save State Machine & Word Count Milestones
 *
 * The full hook has too many side-effects and dependencies to render in isolation,
 * so we extract and test the PURE LOGIC patterns that drive save state and milestones.
 *
 * T01: Save state machine transitions
 * T02: Word count milestone detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
