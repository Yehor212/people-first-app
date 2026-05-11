import { describe, it, expect, beforeEach } from "vitest";
import { SSK } from "@/lib/storageKeys";
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
    expect(s.note).toBe("");
  });

  it("setValence updates state", () => {
    useMoodEntryDraftStore.getState().setValence(0.6);
    expect(useMoodEntryDraftStore.getState().valence).toBe(0.6);
  });

  it("keeps an in-progress valence draft through a browser-tab reload", async () => {
    useMoodEntryDraftStore.getState().setValence(-0.667);
    useMoodEntryDraftStore.getState().setScope("day");

    expect(window.sessionStorage.getItem(SSK.MOOD_ENTRY_DRAFT)).toContain("-0.667");

    const modulePath = "@/stores/moodEntryDraftStore";
    const freshModule = await import(`${modulePath}?reload=${Date.now()}`);

    expect(freshModule.useMoodEntryDraftStore.getState().valence).toBe(-0.667);
    expect(freshModule.useMoodEntryDraftStore.getState().scope).toBe("day");
  });

  it("clears the reload draft when reset runs after save or skip", () => {
    useMoodEntryDraftStore.getState().setValence(0.333);
    expect(window.sessionStorage.getItem(SSK.MOOD_ENTRY_DRAFT)).not.toBeNull();

    useMoodEntryDraftStore.getState().reset();

    expect(window.sessionStorage.getItem(SSK.MOOD_ENTRY_DRAFT)).toBeNull();
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

  it("setNote updates state", () => {
    useMoodEntryDraftStore.getState().setNote("A calmer current is underneath.");
    expect(useMoodEntryDraftStore.getState().note).toBe(
      "A calmer current is underneath.",
    );
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
    expect(s.note).toBe("");
  });

  it("isComplete returns false when valence is null", () => {
    useMoodEntryDraftStore.getState().setEmotion("content");
    expect(useMoodEntryDraftStore.getState().isComplete()).toBe(false);
  });

  it("isComplete returns true when only valence is set for a now-scope handoff", () => {
    useMoodEntryDraftStore.getState().setValence(0.3);
    expect(useMoodEntryDraftStore.getState().isComplete()).toBe(true);
  });

  it("isComplete returns false when scope=specific but time null", () => {
    useMoodEntryDraftStore.getState().setValence(0.3);
    useMoodEntryDraftStore.getState().setScope("specific");
    expect(useMoodEntryDraftStore.getState().isComplete()).toBe(false);
  });

  it("isComplete returns true when valence exists for day scope", () => {
    useMoodEntryDraftStore.getState().setValence(0.3);
    useMoodEntryDraftStore.getState().setScope("day");
    expect(useMoodEntryDraftStore.getState().isComplete()).toBe(true);
  });

  it("isComplete returns true when specific scope + time are resolved", () => {
    useMoodEntryDraftStore.getState().setValence(-0.2);
    useMoodEntryDraftStore.getState().setScope("specific");
    useMoodEntryDraftStore.getState().setSpecificTime("2026-04-16T14:30");
    expect(useMoodEntryDraftStore.getState().isComplete()).toBe(true);
  });
});
