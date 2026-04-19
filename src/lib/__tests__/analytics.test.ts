import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────
vi.mock("@/lib/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

let mockIsDev = false;
vi.mock("@/lib/env", () => ({
  get IS_DEV() {
    return mockIsDev;
  },
}));

import { analytics } from "@/lib/analytics";
import { SK, SSK } from "@/lib/storageKeys";

// ─── Helpers ────────────────────────────────────────────────────
const mockGtag = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockIsDev = false;
  // Reset analytics enabled state by re-initialising with disabled settings
  analytics.init({ analytics: false, noTracking: false });
  delete (window as any).gtag;
});

// ─── init ───────────────────────────────────────────────────────

describe("analytics.init", () => {
  it("enables tracking when analytics=true and noTracking=false", () => {
    window.gtag = mockGtag;
    analytics.init({ analytics: true, noTracking: false });
    analytics.track("test_event");
    expect(mockGtag).toHaveBeenCalledWith("event", "test_event", undefined);
  });

  it("disables tracking when analytics=false", () => {
    window.gtag = mockGtag;
    analytics.init({ analytics: false, noTracking: false });
    analytics.track("test_event");
    expect(mockGtag).not.toHaveBeenCalled();
  });

  it("disables tracking when noTracking=true", () => {
    window.gtag = mockGtag;
    analytics.init({ analytics: true, noTracking: true });
    analytics.track("test_event");
    expect(mockGtag).not.toHaveBeenCalled();
  });
});

// ─── track ──────────────────────────────────────────────────────

describe("analytics.track", () => {
  it("does nothing when disabled", () => {
    window.gtag = mockGtag;
    analytics.init({ analytics: false, noTracking: false });
    analytics.track("test_event");
    expect(mockGtag).not.toHaveBeenCalled();
  });

  it("calls window.gtag when enabled", () => {
    window.gtag = mockGtag;
    analytics.init({ analytics: true, noTracking: false });
    analytics.track("click", { button: "ok" });
    expect(mockGtag).toHaveBeenCalledWith("event", "click", { button: "ok" });
  });

  it("swallows errors from gtag", () => {
    window.gtag = vi.fn(() => {
      throw new Error("gtag broke");
    });
    analytics.init({ analytics: true, noTracking: false });
    expect(() => analytics.track("test")).not.toThrow();
  });
});

// ─── convenience methods ────────────────────────────────────────

describe("analytics convenience methods", () => {
  beforeEach(() => {
    window.gtag = mockGtag;
    analytics.init({ analytics: true, noTracking: false });
  });

  it("page() calls track with page_view", () => {
    analytics.page("home");
    expect(mockGtag).toHaveBeenCalledWith("event", "page_view", { page: "home" });
  });

  it("signIn() tracks sign_in", () => {
    analytics.signIn();
    expect(mockGtag).toHaveBeenCalledWith("event", "sign_in", undefined);
  });

  it("signOut() tracks sign_out", () => {
    analytics.signOut();
    expect(mockGtag).toHaveBeenCalledWith("event", "sign_out", undefined);
  });

  it("habitCompleted() tracks habit_completed with length only (PII safe)", () => {
    analytics.habitCompleted("Meditation");
    expect(mockGtag).toHaveBeenCalledWith("event", "habit_completed", { habit_length: 10 });
  });

  it("moodTracked() tracks mood_tracked with mood", () => {
    analytics.moodTracked("great");
    expect(mockGtag).toHaveBeenCalledWith("event", "mood_tracked", { mood: "great" });
  });

  it("focusSessionCompleted() tracks focus_session with duration", () => {
    analytics.focusSessionCompleted(25);
    expect(mockGtag).toHaveBeenCalledWith("event", "focus_session", { duration_minutes: 25 });
  });

  it("achievementUnlocked() tracks achievement_unlocked with id", () => {
    analytics.achievementUnlocked("streak_7");
    expect(mockGtag).toHaveBeenCalledWith("event", "achievement_unlocked", {
      achievement: "streak_7",
    });
  });
});

// ─── §15 metrics: habit_created activation funnel ───────────────

describe("analytics.habitCreated (§15 activation)", () => {
  beforeEach(() => {
    window.gtag = mockGtag;
    analytics.init({ analytics: true, noTracking: false });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("first-ever create emits ever_first=true AND session_first=true", () => {
    analytics.habitCreated("quick-pick", 1);
    expect(mockGtag).toHaveBeenCalledWith("event", "habit_created", {
      source: "quick-pick",
      total_habits: 1,
      ever_first: true,
      session_first: true,
    });
  });

  it("second create in same session emits both flags false", () => {
    analytics.habitCreated("quick-pick", 1);
    mockGtag.mockClear();
    analytics.habitCreated("custom", 2);
    expect(mockGtag).toHaveBeenCalledWith("event", "habit_created", {
      source: "custom",
      total_habits: 2,
      ever_first: false,
      session_first: false,
    });
  });

  it("new session on returning device keeps ever_first=false, session_first=true", () => {
    analytics.habitCreated("template", 1);
    mockGtag.mockClear();
    window.sessionStorage.clear(); // simulate new tab / app session
    analytics.habitCreated("template", 2);
    expect(mockGtag).toHaveBeenCalledWith("event", "habit_created", {
      source: "template",
      total_habits: 2,
      ever_first: false,
      session_first: true,
    });
  });

  it("does not emit when disabled", () => {
    analytics.init({ analytics: false, noTracking: false });
    analytics.habitCreated("custom", 1);
    expect(mockGtag).not.toHaveBeenCalled();
  });

  it("uses the canonical storageKeys registry (not raw strings)", () => {
    analytics.habitCreated("custom", 1);
    expect(window.localStorage.getItem(SK.HABITS_EVER_CREATED)).toBe("1");
    expect(window.sessionStorage.getItem(SSK.HABITS_SESSION_CREATED)).toBe("1");
  });
});

// ─── §15 metrics: habit_completed retention annotation ──────────

describe("analytics.habitCompleted (§15 retention)", () => {
  beforeEach(() => {
    window.gtag = mockGtag;
    analytics.init({ analytics: true, noTracking: false });
  });

  it("omits total_habits when caller does not provide it (backwards-compat)", () => {
    analytics.habitCompleted("Morning run");
    expect(mockGtag).toHaveBeenCalledWith("event", "habit_completed", {
      habit_length: 11,
    });
  });

  it("includes total_habits when provided — enables ≥3-habit cohort filter", () => {
    analytics.habitCompleted("Read", 5);
    expect(mockGtag).toHaveBeenCalledWith("event", "habit_completed", {
      habit_length: 4,
      total_habits: 5,
    });
  });

  it("never leaks the habit name", () => {
    analytics.habitCompleted("Take meds at 8pm — sertraline 50mg", 3);
    const call = mockGtag.mock.calls[0];
    const payload = call?.[2] as Record<string, unknown>;
    expect(Object.values(payload).some((v) => typeof v === "string")).toBe(false);
  });
});

// ─── §15 metrics: habit_detail_opened depth ─────────────────────

describe("analytics.habitDetailOpened (§15 depth)", () => {
  beforeEach(() => {
    window.gtag = mockGtag;
    analytics.init({ analytics: true, noTracking: false });
  });

  it("emits habit_detail_opened with total_habits", () => {
    analytics.habitDetailOpened(4);
    expect(mockGtag).toHaveBeenCalledWith("event", "habit_detail_opened", {
      total_habits: 4,
    });
  });

  it("does not emit when disabled", () => {
    analytics.init({ analytics: false, noTracking: false });
    analytics.habitDetailOpened(4);
    expect(mockGtag).not.toHaveBeenCalled();
  });
});

// ─── §15 metrics: insight_strip_rendered cross-habit signal ─────

describe("analytics.insightStripRendered (§15 cross-habit)", () => {
  beforeEach(() => {
    window.gtag = mockGtag;
    analytics.init({ analytics: true, noTracking: false });
  });

  it("emits finite enum fields only — no free text", () => {
    analytics.insightStripRendered("mood-habit", "positive");
    expect(mockGtag).toHaveBeenCalledWith("event", "insight_strip_rendered", {
      insight_type: "mood-habit",
      insight_severity: "positive",
    });
  });

  it("does not emit when disabled", () => {
    analytics.init({ analytics: false, noTracking: false });
    analytics.insightStripRendered("mood-habit", "positive");
    expect(mockGtag).not.toHaveBeenCalled();
  });
});
