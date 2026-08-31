import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Raw storage mock ──────────────────────────────────────────
let rawStorage: Record<string, string> = {};

vi.mock("@/lib/safeJson", () => ({
  storageGetRaw: vi.fn((key: string) => rawStorage[key] ?? null),
  storageReadRaw: vi.fn((key: string) => ({
    ok: true,
    value: rawStorage[key] ?? null,
  })),
  safeLocalStorageSet: vi.fn((key: string, value: unknown) => {
    rawStorage[key] = JSON.stringify(value);
    return true;
  }),
  storageRemove: vi.fn((key: string) => {
    delete rawStorage[key];
    return true;
  }),
  safeJsonParse: vi.fn(<T>(str: string, def: T): T => {
    try {
      return JSON.parse(str);
    } catch {
      return def;
    }
  }),
}));

vi.mock("@/lib/utils", () => ({
  generateId: vi.fn(() => "test-id-123"),
  generateUuid: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
  getToday: vi.fn(() => "2026-02-17"),
}));

import { SK } from "@/lib/storageKeys";
import {
  DEFAULT_FOCUS_MINUTES,
  DEFAULT_BREAK_MINUTES,
  presetColors,
  loadTimerState,
  createFocusSession,
} from "@/types/focusTimerTypes";

// ─── Setup ─────────────────────────────────────────────────────

beforeEach(() => {
  rawStorage = {};
  vi.clearAllMocks();
});

// ============================================================
// Constants
// ============================================================
describe("constants", () => {
  it("DEFAULT_FOCUS_MINUTES is 25", () => {
    expect(DEFAULT_FOCUS_MINUTES).toBe(25);
  });

  it("DEFAULT_BREAK_MINUTES is 5", () => {
    expect(DEFAULT_BREAK_MINUTES).toBe(5);
  });
});

// ============================================================
// presetColors
// ============================================================
describe("presetColors", () => {
  it("has entries for 25, 50, and custom presets", () => {
    expect(presetColors).toHaveProperty("25");
    expect(presetColors).toHaveProperty("50");
    expect(presetColors).toHaveProperty("custom");
  });

  it("each preset has glow, ring, and bg properties", () => {
    for (const key of ["25", "50", "custom"] as const) {
      expect(presetColors[key]).toHaveProperty("glow");
      expect(presetColors[key]).toHaveProperty("ring");
      expect(presetColors[key]).toHaveProperty("bg");
    }
  });
});

// ============================================================
// loadTimerState
// ============================================================
describe("loadTimerState", () => {
  it("returns null when nothing stored", () => {
    expect(loadTimerState()).toBeNull();
  });

  it("returns parsed timer state from storage", () => {
    const state = {
      endTime: 1000,
      focusMinutes: 25,
      breakMinutes: 5,
      isRunning: true,
      isBreak: false,
      label: "Work",
      focusStartTime: 500,
      focusAccumulated: 0,
      preset: "25",
    };
    rawStorage[SK.TIMER_STATE] = JSON.stringify(state);
    const result = loadTimerState();
    expect(result).not.toBeNull();
    if (!result) throw new Error("Expected timer state");
    expect(result.focusMinutes).toBe(25);
    expect(result.isRunning).toBe(true);
    expect(result.label).toBe("Work");
  });

  it("returns null when stored value is invalid JSON", () => {
    rawStorage[SK.TIMER_STATE] = "{broken json";
    expect(loadTimerState()).toBeNull();
  });
});

// ============================================================
// createFocusSession
// ============================================================
describe("createFocusSession", () => {
  it("creates a session with correct fields", () => {
    const session = createFocusSession(25, "Deep work", "completed");
    expect(session.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(session.duration).toBe(25);
    expect(session.date).toBe("2026-02-17");
    expect(session.label).toBe("Deep work");
    expect(session.status).toBe("completed");
    expect(typeof session.completedAt).toBe("number");
  });

  it("trims label whitespace", () => {
    const session = createFocusSession(25, "  Study  ", "completed");
    expect(session.label).toBe("Study");
  });

  it("sets label to undefined when empty string", () => {
    const session = createFocusSession(25, "", "completed");
    expect(session.label).toBeUndefined();
  });

  it("sets label to undefined when only whitespace", () => {
    const session = createFocusSession(25, "   ", "aborted");
    expect(session.label).toBeUndefined();
  });

  it("supports aborted status", () => {
    const session = createFocusSession(10, "Quick", "aborted");
    expect(session.status).toBe("aborted");
    expect(session.duration).toBe(10);
  });
});
