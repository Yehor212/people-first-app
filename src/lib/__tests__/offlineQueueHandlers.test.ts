/**
 * Unit tests for offlineQueueHandlers
 *
 * Tests handler registration, payload validation, queue enqueue calls,
 * and auto-processing behavior.
 */

import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";

// ─── Mock Dependencies ──────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    sync: vi.fn(),
  },
}));

// Mock the offlineQueue module — use inline object to avoid hoisting issues
vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    registerHandler: vi.fn(),
    enqueue: vi.fn(() => Promise.resolve()),
    processQueue: vi.fn(() => Promise.resolve()),
  },
}));

// Mock cloud sync functions
vi.mock("@/storage/realtimeSync", () => ({
  syncMood: vi.fn(() => Promise.resolve()),
  deleteMoodFromCloud: vi.fn(() => Promise.resolve()),
  syncHabit: vi.fn(() => Promise.resolve()),
  syncHabitCompletion: vi.fn(() => Promise.resolve()),
  deleteHabitFromCloud: vi.fn(() => Promise.resolve()),
  syncFocusSession: vi.fn(() => Promise.resolve()),
  syncGratitude: vi.fn(() => Promise.resolve()),
  deleteGratitudeFromCloud: vi.fn(() => Promise.resolve()),
  syncJournalEntry: vi.fn(() => Promise.resolve()),
  deleteJournalEntryFromCloud: vi.fn(() => Promise.resolve()),
}));

// Mock validation — safeValidate returns the value if valid, null if invalid
vi.mock("@/lib/validation", () => ({
  moodEntrySchema: { _tag: "moodEntrySchema" },
  habitSchema: { _tag: "habitSchema" },
  focusSessionSchema: { _tag: "focusSessionSchema" },
  gratitudeEntrySchema: { _tag: "gratitudeEntrySchema" },
  safeValidate: vi.fn((_schema: unknown, value: unknown) => value),
  generateSecureRandom: vi.fn(() => "abc123"),
}));

// Import AFTER mocks
import {
  initializeOfflineQueueHandlers,
  queueMoodSync,
  queueHabitSync,
  queueFocusSessionSync,
  queueGratitudeSync,
} from "../offlineQueueHandlers";
import { offlineQueue, type OfflineAction } from "@/lib/offlineQueue";
import {
  syncMood,
  deleteMoodFromCloud,
  syncHabit,
  syncHabitCompletion,
  deleteHabitFromCloud,
  syncFocusSession,
  syncGratitude,
  deleteGratitudeFromCloud,
  syncJournalEntry,
  deleteJournalEntryFromCloud,
} from "@/storage/realtimeSync";
import { safeValidate } from "@/lib/validation";
import type { MoodEntry, Habit, FocusSession, GratitudeEntry } from "@/types";

// ─── Test Fixtures ──────────────────────────────────────────────

const makeMoodEntry = (overrides: Partial<MoodEntry> = {}): MoodEntry =>
  ({
    id: "mood-1",
    date: "2026-03-14",
    mood: 7,
    valence: 0.6,
    energy: 0.5,
    timestamp: Date.now(),
    ...overrides,
  }) as MoodEntry;

const makeHabit = (overrides: Partial<Habit> = {}): Habit =>
  ({
    id: "habit-1",
    name: "Meditate",
    frequency: "daily",
    completedDates: [],
    createdAt: "2026-03-01",
    ...overrides,
  }) as Habit;

const makeFocusSession = (overrides: Partial<FocusSession> = {}): FocusSession =>
  ({
    id: "focus-1",
    startTime: "2026-03-14T10:00:00Z",
    duration: 1500,
    completed: true,
    ...overrides,
  }) as FocusSession;

const makeGratitudeEntry = (overrides: Partial<GratitudeEntry> = {}): GratitudeEntry =>
  ({
    id: "gratitude-1",
    date: "2026-03-14",
    entries: ["Sunshine"],
    ...overrides,
  }) as GratitudeEntry;

// ─── Tests ──────────────────────────────────────────────────────

describe("offlineQueueHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: online
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
    vi.mocked(safeValidate).mockImplementation((_schema: unknown, value: unknown) => value);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Handler Registration ────────────────────────────────────

  describe("initializeOfflineQueueHandlers", () => {
    it("registers handlers for all expected action types", () => {
      initializeOfflineQueueHandlers();

      const registeredTypes = vi
        .mocked(offlineQueue.registerHandler)
        .mock.calls.map((call) => call[0]);

      expect(registeredTypes).toContain("CREATE_MOOD");
      expect(registeredTypes).toContain("UPDATE_MOOD");
      expect(registeredTypes).toContain("DELETE_MOOD");
      expect(registeredTypes).toContain("CREATE_HABIT");
      expect(registeredTypes).toContain("UPDATE_HABIT");
      expect(registeredTypes).toContain("DELETE_HABIT");
      expect(registeredTypes).toContain("TOGGLE_HABIT");
      expect(registeredTypes).toContain("CREATE_FOCUS_SESSION");
      expect(registeredTypes).toContain("CREATE_GRATITUDE");
      expect(registeredTypes).toContain("DELETE_GRATITUDE");
      expect(registeredTypes).toContain("UPDATE_SETTINGS");
      expect(registeredTypes).toContain("SYNC_JOURNAL_ENTRY");
      expect(registeredTypes).toContain("DELETE_JOURNAL_ENTRY");
    });

    it("registers exactly 13 handlers", () => {
      initializeOfflineQueueHandlers();
      expect(offlineQueue.registerHandler).toHaveBeenCalledTimes(13);
    });

    it("calls processQueue when online", () => {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      initializeOfflineQueueHandlers();
      expect(offlineQueue.processQueue).toHaveBeenCalled();
    });

    it("does not call processQueue when offline", () => {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      vi.mocked(offlineQueue.processQueue).mockClear();

      initializeOfflineQueueHandlers();

      expect(offlineQueue.processQueue).not.toHaveBeenCalled();
    });
  });

  // ─── Registered Handler Behavior (Payload Validation) ────────

  describe("registered handler behavior", () => {
    /**
     * Helper: extract the registered handler function for a given action type.
     * Calls initializeOfflineQueueHandlers() then finds the matching registration.
     */
    function getHandler(actionType: string): (action: OfflineAction) => Promise<void> {
      vi.mocked(offlineQueue.registerHandler).mockClear();
      initializeOfflineQueueHandlers();

      const call = vi
        .mocked(offlineQueue.registerHandler)
        .mock.calls.find((c) => c[0] === actionType);
      if (!call) throw new Error(`No handler registered for ${actionType}`);
      return call[1] as (action: OfflineAction) => Promise<void>;
    }

    function makeAction(type: string, payload: unknown, entityId = "entity-1"): OfflineAction {
      return {
        id: `${type}_${entityId}_${Date.now()}`,
        type: type as OfflineAction["type"],
        entityId,
        payload,
        timestamp: Date.now(),
        retries: 0,
        maxRetries: 5,
      };
    }

    it("CREATE_MOOD handler calls syncMood with valid payload", async () => {
      const handler = getHandler("CREATE_MOOD");
      const mood = makeMoodEntry();
      await handler(makeAction("CREATE_MOOD", mood, mood.id));

      expect(syncMood).toHaveBeenCalledWith(mood);
    });

    it("CREATE_MOOD handler skips invalid payload", async () => {
      vi.mocked(safeValidate).mockReturnValue(null);

      const handler = getHandler("CREATE_MOOD");
      await handler(makeAction("CREATE_MOOD", { invalid: true }, "bad-id"));

      expect(syncMood).not.toHaveBeenCalled();
    });

    it("UPDATE_MOOD handler calls syncMood with valid payload", async () => {
      const handler = getHandler("UPDATE_MOOD");
      const mood = makeMoodEntry({ id: "mood-2" });
      await handler(makeAction("UPDATE_MOOD", mood, mood.id));

      expect(syncMood).toHaveBeenCalledWith(mood);
    });

    it("DELETE_MOOD handler calls deleteMoodFromCloud with entityId", async () => {
      const handler = getHandler("DELETE_MOOD");
      await handler(makeAction("DELETE_MOOD", null, "mood-to-delete"));

      expect(deleteMoodFromCloud).toHaveBeenCalledWith("mood-to-delete");
    });

    it("CREATE_HABIT handler calls syncHabit with valid payload", async () => {
      const handler = getHandler("CREATE_HABIT");
      const habit = makeHabit();
      await handler(makeAction("CREATE_HABIT", habit, habit.id));

      expect(syncHabit).toHaveBeenCalledWith(habit);
    });

    it("CREATE_HABIT handler skips invalid payload", async () => {
      vi.mocked(safeValidate).mockReturnValue(null);

      const handler = getHandler("CREATE_HABIT");
      await handler(makeAction("CREATE_HABIT", { broken: true }, "bad-id"));

      expect(syncHabit).not.toHaveBeenCalled();
    });

    it("DELETE_HABIT handler calls deleteHabitFromCloud", async () => {
      const handler = getHandler("DELETE_HABIT");
      await handler(makeAction("DELETE_HABIT", null, "habit-del"));

      expect(deleteHabitFromCloud).toHaveBeenCalledWith("habit-del");
    });

    it("TOGGLE_HABIT handler calls syncHabitCompletion with completion payload", async () => {
      const handler = getHandler("TOGGLE_HABIT");
      const completionPayload = {
        habitId: "habit-toggle",
        date: "2026-04-05",
        completed: true,
        count: 1,
      };
      await handler(makeAction("TOGGLE_HABIT", completionPayload, "habit-toggle_2026-04-05"));

      expect(syncHabitCompletion).toHaveBeenCalledWith(
        "habit-toggle",
        "2026-04-05",
        true,
        1,
        undefined
      );
    });

    it("CREATE_FOCUS_SESSION handler calls syncFocusSession with valid payload", async () => {
      const handler = getHandler("CREATE_FOCUS_SESSION");
      const session = makeFocusSession();
      await handler(makeAction("CREATE_FOCUS_SESSION", session, session.id));

      expect(syncFocusSession).toHaveBeenCalledWith(session);
    });

    it("CREATE_FOCUS_SESSION handler skips invalid payload", async () => {
      vi.mocked(safeValidate).mockReturnValue(null);

      const handler = getHandler("CREATE_FOCUS_SESSION");
      await handler(makeAction("CREATE_FOCUS_SESSION", null, "bad"));

      expect(syncFocusSession).not.toHaveBeenCalled();
    });

    it("CREATE_GRATITUDE handler calls syncGratitude with valid payload", async () => {
      const handler = getHandler("CREATE_GRATITUDE");
      const entry = makeGratitudeEntry();
      await handler(makeAction("CREATE_GRATITUDE", entry, entry.id));

      expect(syncGratitude).toHaveBeenCalledWith(entry);
    });

    it("DELETE_GRATITUDE handler calls deleteGratitudeFromCloud", async () => {
      const handler = getHandler("DELETE_GRATITUDE");
      await handler(makeAction("DELETE_GRATITUDE", null, "grat-del"));

      expect(deleteGratitudeFromCloud).toHaveBeenCalledWith("grat-del");
    });

    it("SYNC_JOURNAL_ENTRY handler calls syncJournalEntry with valid payload", async () => {
      const handler = getHandler("SYNC_JOURNAL_ENTRY");
      const entry = { id: "journal-1", date: "2026-03-14", content: "Today was good" };
      await handler(makeAction("SYNC_JOURNAL_ENTRY", entry, entry.id));

      expect(syncJournalEntry).toHaveBeenCalledWith(entry);
    });

    it("SYNC_JOURNAL_ENTRY handler skips payload with missing id", async () => {
      const handler = getHandler("SYNC_JOURNAL_ENTRY");
      const badEntry = { date: "2026-03-14", content: "no id" };
      await handler(makeAction("SYNC_JOURNAL_ENTRY", badEntry, "bad"));

      expect(syncJournalEntry).not.toHaveBeenCalled();
    });

    it("SYNC_JOURNAL_ENTRY handler skips payload with missing date", async () => {
      const handler = getHandler("SYNC_JOURNAL_ENTRY");
      const badEntry = { id: "j-1", content: "no date" };
      await handler(makeAction("SYNC_JOURNAL_ENTRY", badEntry, "j-1"));

      expect(syncJournalEntry).not.toHaveBeenCalled();
    });

    it("DELETE_JOURNAL_ENTRY handler calls deleteJournalEntryFromCloud", async () => {
      const handler = getHandler("DELETE_JOURNAL_ENTRY");
      await handler(makeAction("DELETE_JOURNAL_ENTRY", null, "journal-del"));

      expect(deleteJournalEntryFromCloud).toHaveBeenCalledWith("journal-del");
    });

    it("UPDATE_SETTINGS handler is a no-op placeholder", async () => {
      const handler = getHandler("UPDATE_SETTINGS");
      // Should not throw
      await expect(handler(makeAction("UPDATE_SETTINGS", {}, "settings"))).resolves.toBeUndefined();
    });
  });

  // ─── Queue Helper Functions ──────────────────────────────────

  describe("queue helper functions", () => {
    it("queueMoodSync enqueues with correct action, entityId, and payload", async () => {
      const mood = makeMoodEntry({ id: "mood-q1" });
      await queueMoodSync("CREATE_MOOD", mood);

      expect(offlineQueue.enqueue).toHaveBeenCalledWith("CREATE_MOOD", "mood-q1", mood);
    });

    it("queueMoodSync supports UPDATE_MOOD action", async () => {
      const mood = makeMoodEntry({ id: "mood-q2" });
      await queueMoodSync("UPDATE_MOOD", mood);

      expect(offlineQueue.enqueue).toHaveBeenCalledWith("UPDATE_MOOD", "mood-q2", mood);
    });

    it("queueMoodSync supports DELETE_MOOD action", async () => {
      const mood = makeMoodEntry({ id: "mood-q3" });
      await queueMoodSync("DELETE_MOOD", mood);

      expect(offlineQueue.enqueue).toHaveBeenCalledWith("DELETE_MOOD", "mood-q3", mood);
    });

    it("queueHabitSync enqueues with correct parameters", async () => {
      const habit = makeHabit({ id: "habit-q1" });
      await queueHabitSync("CREATE_HABIT", habit);

      expect(offlineQueue.enqueue).toHaveBeenCalledWith("CREATE_HABIT", "habit-q1", habit);
    });

    it("queueHabitSync supports TOGGLE_HABIT action", async () => {
      const habit = makeHabit({ id: "habit-q2" });
      await queueHabitSync("TOGGLE_HABIT", habit);

      expect(offlineQueue.enqueue).toHaveBeenCalledWith("TOGGLE_HABIT", "habit-q2", habit);
    });

    it("queueFocusSessionSync enqueues with CREATE_FOCUS_SESSION", async () => {
      const session = makeFocusSession({ id: "focus-q1" });
      await queueFocusSessionSync(session);

      expect(offlineQueue.enqueue).toHaveBeenCalledWith(
        "CREATE_FOCUS_SESSION",
        "focus-q1",
        session
      );
    });

    it("queueGratitudeSync enqueues with correct parameters", async () => {
      const entry = makeGratitudeEntry({ id: "grat-q1" });
      await queueGratitudeSync("CREATE_GRATITUDE", entry);

      expect(offlineQueue.enqueue).toHaveBeenCalledWith("CREATE_GRATITUDE", "grat-q1", entry);
    });

    it("queueGratitudeSync supports DELETE_GRATITUDE action", async () => {
      const entry = makeGratitudeEntry({ id: "grat-q2" });
      await queueGratitudeSync("DELETE_GRATITUDE", entry);

      expect(offlineQueue.enqueue).toHaveBeenCalledWith("DELETE_GRATITUDE", "grat-q2", entry);
    });
  });
});
