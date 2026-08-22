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
    analytics.signIn();
    expect(mockGtag).toHaveBeenCalledWith("event", "sign_in", undefined);
  });

  it("disables tracking when analytics=false", () => {
    window.gtag = mockGtag;
    analytics.init({ analytics: false, noTracking: false });
    analytics.signIn();
    expect(mockGtag).not.toHaveBeenCalled();
  });

  it("disables tracking when noTracking=true", () => {
    window.gtag = mockGtag;
    analytics.init({ analytics: true, noTracking: true });
    analytics.signIn();
    expect(mockGtag).not.toHaveBeenCalled();
  });
});

// ─── fixed event boundary ───────────────────────────────────────

describe("analytics fixed event boundary", () => {
  it("does nothing when disabled", () => {
    window.gtag = mockGtag;
    analytics.init({ analytics: false, noTracking: false });
    analytics.signIn();
    expect(mockGtag).not.toHaveBeenCalled();
  });

  it("calls window.gtag when enabled", () => {
    window.gtag = mockGtag;
    analytics.init({ analytics: true, noTracking: false });
    analytics.signIn();
    expect(mockGtag).toHaveBeenCalledWith("event", "sign_in", undefined);
  });

  it("swallows errors from gtag", () => {
    window.gtag = vi.fn(() => {
      throw new Error("gtag broke");
    });
    analytics.init({ analytics: true, noTracking: false });
    expect(() => analytics.signIn()).not.toThrow();
  });
});

// ─── convenience methods ────────────────────────────────────────

describe("analytics convenience methods", () => {
  beforeEach(() => {
    window.gtag = mockGtag;
    analytics.init({ analytics: true, noTracking: false });
  });

  it("rejects forged free-form enum values before gtag", () => {
    const canary = "PRIVATE_JOURNAL_CANARY_DO_NOT_SEND";
    analytics.habitCreated(canary as never, 1);
    analytics.insightStripRendered(canary as never, canary as never);
    analytics.achievementUnlocked(canary as never);
    expect(JSON.stringify(mockGtag.mock.calls)).not.toContain(canary);
    expect(mockGtag).not.toHaveBeenCalled();
  });

  it("signIn() tracks sign_in", () => {
    analytics.signIn();
    expect(mockGtag).toHaveBeenCalledWith("event", "sign_in", undefined);
  });

  it("signOut() tracks sign_out", () => {
    analytics.signOut();
    expect(mockGtag).toHaveBeenCalledWith("event", "sign_out", undefined);
  });

  it("habitCompleted() never accepts private habit content", () => {
    analytics.habitCompleted(4);
    expect(mockGtag).toHaveBeenCalledWith("event", "habit_completed", { total_habits: 4 });
  });

  it("moodTracked() emits only a fixed event and no emotional payload", () => {
    analytics.moodTracked();
    expect(mockGtag).toHaveBeenCalledWith("event", "mood_tracked", undefined);
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

  it("omits properties when caller does not provide an operational count", () => {
    analytics.habitCompleted();
    expect(mockGtag).toHaveBeenCalledWith("event", "habit_completed", undefined);
  });

  it("includes total_habits when provided — enables ≥3-habit cohort filter", () => {
    analytics.habitCompleted(5);
    expect(mockGtag).toHaveBeenCalledWith("event", "habit_completed", {
      total_habits: 5,
    });
  });

  it("does not expose a public arbitrary track method", () => {
    expect("track" in analytics).toBe(false);
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
    analytics.insightStripRendered("mood-habit-correlation", "celebration");
    expect(mockGtag).toHaveBeenCalledWith("event", "insight_strip_rendered", {
      insight_type: "mood-habit-correlation",
      insight_severity: "celebration",
    });
  });

  it("does not emit when disabled", () => {
    analytics.init({ analytics: false, noTracking: false });
    analytics.insightStripRendered("mood-habit-correlation", "celebration");
    expect(mockGtag).not.toHaveBeenCalled();
  });
});
