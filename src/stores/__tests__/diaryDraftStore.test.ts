import { describe, it, expect, beforeEach } from "vitest";
import { useDiaryDraftStore } from "@/stores/diaryDraftStore";

describe("diaryDraftStore", () => {
  beforeEach(() => {
    useDiaryDraftStore.getState().clearPendingMoodContext();
  });

  it("initialises with null pendingMoodContext", () => {
    expect(useDiaryDraftStore.getState().pendingMoodContext).toBeNull();
  });

  it("setPendingMoodContext stores context", () => {
    const ctx = {
      valence: 0.7,
      scope: "now" as const,
      specificTime: null,
      emotion: "grateful",
      committedAt: Date.now(),
    };
    useDiaryDraftStore.getState().setPendingMoodContext(ctx);
    expect(useDiaryDraftStore.getState().pendingMoodContext).toEqual(ctx);
  });

  it("clearPendingMoodContext resets to null", () => {
    useDiaryDraftStore.getState().setPendingMoodContext({
      valence: 0.0,
      scope: "day",
      specificTime: null,
      emotion: "neutral",
      committedAt: Date.now(),
    });
    useDiaryDraftStore.getState().clearPendingMoodContext();
    expect(useDiaryDraftStore.getState().pendingMoodContext).toBeNull();
  });

  it("setPendingMoodContext overwrites prior context", () => {
    useDiaryDraftStore.getState().setPendingMoodContext({
      valence: -0.5,
      scope: "now",
      specificTime: null,
      emotion: "anxious",
      committedAt: 100,
    });
    useDiaryDraftStore.getState().setPendingMoodContext({
      valence: 0.8,
      scope: "day",
      specificTime: null,
      emotion: "joyful",
      committedAt: 200,
    });
    const ctx = useDiaryDraftStore.getState().pendingMoodContext;
    expect(ctx?.valence).toBe(0.8);
    expect(ctx?.emotion).toBe("joyful");
    expect(ctx?.committedAt).toBe(200);
  });

  it("preserves specific scope with specificTime", () => {
    useDiaryDraftStore.getState().setPendingMoodContext({
      valence: 0.2,
      scope: "specific",
      specificTime: "2026-04-16T14:30",
      emotion: "calm",
      committedAt: Date.now(),
    });
    const ctx = useDiaryDraftStore.getState().pendingMoodContext;
    expect(ctx?.scope).toBe("specific");
    expect(ctx?.specificTime).toBe("2026-04-16T14:30");
  });
});
