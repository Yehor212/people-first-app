import { describe, it, expect, beforeEach } from "vitest";
import { useMoodEntryDraftStore } from "@/stores/moodEntryDraftStore";

describe("moodEntryDraftStore", () => {
  beforeEach(() => {
    useMoodEntryDraftStore.getState().reset();
  });

  it("initialises with null valence, scope=now, null emotion", () => {
    const s = useMoodEntryDraftStore.getState();
    expect(s.valence).toBeNull();
    expect(s.scope).toBe("now");
    expect(s.specificTime).toBeNull();
    expect(s.emotion).toBeNull();
  });

  it("setValence updates state", () => {
    useMoodEntryDraftStore.getState().setValence(0.6);
    expect(useMoodEntryDraftStore.getState().valence).toBe(0.6);
  });

  it("setScope clears specificTime when leaving 'specific'", () => {
    useMoodEntryDraftStore.getState().setScope("specific");
    useMoodEntryDraftStore.getState().setSpecificTime("2026-04-16T10:00:00Z");
    useMoodEntryDraftStore.getState().setScope("now");
    expect(useMoodEntryDraftStore.getState().specificTime).toBeNull();
  });

  it("setScope preserves specificTime when scope stays 'specific'", () => {
    useMoodEntryDraftStore.getState().setScope("specific");
    useMoodEntryDraftStore.getState().setSpecificTime("2026-04-16T10:00:00Z");
    useMoodEntryDraftStore.getState().setScope("specific");
    expect(useMoodEntryDraftStore.getState().specificTime).toBe(
      "2026-04-16T10:00:00Z",
    );
  });

  it("setEmotion updates state", () => {
    useMoodEntryDraftStore.getState().setEmotion("hopeful");
    expect(useMoodEntryDraftStore.getState().emotion).toBe("hopeful");
  });

  it("reset restores INITIAL values", () => {
    useMoodEntryDraftStore.getState().setValence(0.9);
    useMoodEntryDraftStore.getState().setScope("day");
    useMoodEntryDraftStore.getState().setEmotion("joyful");
    useMoodEntryDraftStore.getState().reset();

    const s = useMoodEntryDraftStore.getState();
    expect(s.valence).toBeNull();
    expect(s.scope).toBe("now");
    expect(s.specificTime).toBeNull();
    expect(s.emotion).toBeNull();
  });

  it("isComplete returns false when valence is null", () => {
    useMoodEntryDraftStore.getState().setEmotion("content");
    expect(useMoodEntryDraftStore.getState().isComplete()).toBe(false);
  });

  it("isComplete returns false when emotion is null", () => {
    useMoodEntryDraftStore.getState().setValence(0.3);
    expect(useMoodEntryDraftStore.getState().isComplete()).toBe(false);
  });

  it("isComplete returns false when scope=specific but time null", () => {
    useMoodEntryDraftStore.getState().setValence(0.3);
    useMoodEntryDraftStore.getState().setEmotion("calm");
    useMoodEntryDraftStore.getState().setScope("specific");
    expect(useMoodEntryDraftStore.getState().isComplete()).toBe(false);
  });

  it("isComplete returns true when all three (now scope)", () => {
    useMoodEntryDraftStore.getState().setValence(0.3);
    useMoodEntryDraftStore.getState().setEmotion("calm");
    useMoodEntryDraftStore.getState().setScope("now");
    expect(useMoodEntryDraftStore.getState().isComplete()).toBe(true);
  });

  it("isComplete returns true when specific scope + time + all filled", () => {
    useMoodEntryDraftStore.getState().setValence(-0.2);
    useMoodEntryDraftStore.getState().setEmotion("anxious");
    useMoodEntryDraftStore.getState().setScope("specific");
    useMoodEntryDraftStore.getState().setSpecificTime("2026-04-16T14:30");
    expect(useMoodEntryDraftStore.getState().isComplete()).toBe(true);
  });
});
