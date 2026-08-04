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

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: vi.fn(async () => "account-a"),
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
  deleteJournalEntryFromCloud: vi.fn(() => Promise.resolve({ status: "committed" })),
  syncSetting: vi.fn(() => Promise.resolve()),
  deleteSettingFromCloud: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/features/journal/journalStorage", () => ({
  retryJournalPhotoUpload: vi.fn(() => Promise.resolve()),
  retryJournalAudioUpload: vi.fn(() => Promise.resolve()),
  retryJournalPhotoDelete: vi.fn(() => Promise.resolve()),
  retryJournalAudioDelete: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/features/journal/journalSecurityMigration", () => ({
  runJournalSecurityMigration: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/storage/eventSync", () => ({
  isSyncEventWriteIntent: vi.fn(
    (value: unknown) =>
      typeof value === "object" &&
      value !== null &&
      "entityType" in value &&
      "entityId" in value &&
      "op" in value &&
      "deviceId" in value
  ),
  normalizeSyncEventWriteIntent: vi.fn((value: unknown) => value),
  writeQueuedEventAndBroadcast: vi.fn(() => Promise.resolve()),
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
import {
  offlineQueue,
  type OfflineAction,
  type OfflineQueueHandlerContext,
  type OfflineQueueHandlerResult,
} from "@/lib/offlineQueue";
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
  syncSetting,
  deleteSettingFromCloud,
} from "@/storage/realtimeSync";
import {
  retryJournalPhotoUpload,
  retryJournalAudioUpload,
  retryJournalPhotoDelete,
  retryJournalAudioDelete,
} from "@/features/journal/journalStorage";
import { runJournalSecurityMigration } from "@/features/journal/journalSecurityMigration";
import { writeQueuedEventAndBroadcast } from "@/storage/eventSync";
import { SyncOwnerBoundaryError } from "@/storage/sync/syncOwner";
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
      expect(registeredTypes).toContain("DELETE_SETTINGS");
      expect(registeredTypes).toContain("SYNC_JOURNAL_ENTRY");
      expect(registeredTypes).toContain("DELETE_JOURNAL_ENTRY");
      expect(registeredTypes).toContain("UPLOAD_JOURNAL_PHOTO_STORAGE");
      expect(registeredTypes).toContain("UPLOAD_JOURNAL_AUDIO_STORAGE");
      expect(registeredTypes).toContain("DELETE_JOURNAL_PHOTO_STORAGE");
      expect(registeredTypes).toContain("DELETE_JOURNAL_AUDIO_STORAGE");
      expect(registeredTypes).toContain("MIGRATE_JOURNAL_SECURITY");
      expect(registeredTypes).toContain("WRITE_SYNC_EVENT");
    });

    it("registers exactly 20 handlers", () => {
      initializeOfflineQueueHandlers();
      expect(offlineQueue.registerHandler).toHaveBeenCalledTimes(20);
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
    function getHandler(
      actionType: string,
      handlerContext?: OfflineQueueHandlerContext
    ): (action: OfflineAction) => Promise<OfflineQueueHandlerResult | void> {
      vi.mocked(offlineQueue.registerHandler).mockClear();
      initializeOfflineQueueHandlers();

      const call = vi
        .mocked(offlineQueue.registerHandler)
        .mock.calls.find((c) => c[0] === actionType);
      if (!call) throw new Error(`No handler registered for ${actionType}`);
      const context: OfflineQueueHandlerContext = handlerContext ?? {
        ownerUserId: "account-a",
        operationId: "11111111-1111-4111-8111-111111111111",
        signal: new AbortController().signal,
        runIfOwnerCurrent: async (operation) => operation(),
      };
      return (action) => call[1](action, context);
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

      expect(syncMood).toHaveBeenCalledWith(mood, "account-a");
    });

    it("CREATE_MOOD handler rejects invalid payload", async () => {
      vi.mocked(safeValidate).mockReturnValue(null);

      const handler = getHandler("CREATE_MOOD");
      await expect(
        handler(makeAction("CREATE_MOOD", { invalid: true }, "bad-id")),
      ).rejects.toMatchObject({ name: "OfflineQueuePayloadValidationError" });

      expect(syncMood).not.toHaveBeenCalled();
    });

    it("UPDATE_MOOD handler calls syncMood with valid payload", async () => {
      const handler = getHandler("UPDATE_MOOD");
      const mood = makeMoodEntry({ id: "mood-2" });
      await handler(makeAction("UPDATE_MOOD", mood, mood.id));

      expect(syncMood).toHaveBeenCalledWith(mood, "account-a");
    });

    it("DELETE_MOOD handler calls deleteMoodFromCloud with entityId", async () => {
      const handler = getHandler("DELETE_MOOD");
      await handler(makeAction("DELETE_MOOD", null, "mood-to-delete"));

      expect(deleteMoodFromCloud).toHaveBeenCalledWith("mood-to-delete", "account-a");
    });

    it("CREATE_HABIT handler calls syncHabit with valid payload", async () => {
      const handler = getHandler("CREATE_HABIT");
      const habit = makeHabit();
      await handler(makeAction("CREATE_HABIT", habit, habit.id));

      expect(syncHabit).toHaveBeenCalledWith(habit, "account-a");
    });

    it("CREATE_HABIT handler rejects invalid payload", async () => {
      vi.mocked(safeValidate).mockReturnValue(null);

      const handler = getHandler("CREATE_HABIT");
      await expect(
        handler(makeAction("CREATE_HABIT", { broken: true }, "bad-id")),
      ).rejects.toMatchObject({ name: "OfflineQueuePayloadValidationError" });

      expect(syncHabit).not.toHaveBeenCalled();
    });

    it("DELETE_HABIT handler calls deleteHabitFromCloud", async () => {
      const handler = getHandler("DELETE_HABIT");
      await handler(makeAction("DELETE_HABIT", null, "habit-del"));

      expect(deleteHabitFromCloud).toHaveBeenCalledWith("habit-del", "account-a");
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
        undefined,
        {
          entryValue: undefined,
          habitType: undefined,
          targetType: undefined,
        },
        "account-a"
      );
    });

    it("CREATE_FOCUS_SESSION handler calls syncFocusSession with valid payload", async () => {
      const handler = getHandler("CREATE_FOCUS_SESSION");
      const session = makeFocusSession();
      await handler(makeAction("CREATE_FOCUS_SESSION", session, session.id));

      expect(syncFocusSession).toHaveBeenCalledWith(session, "account-a");
    });

    it("CREATE_FOCUS_SESSION handler rejects invalid payload", async () => {
      vi.mocked(safeValidate).mockReturnValue(null);

      const handler = getHandler("CREATE_FOCUS_SESSION");
      await expect(
        handler(makeAction("CREATE_FOCUS_SESSION", null, "bad")),
      ).rejects.toMatchObject({ name: "OfflineQueuePayloadValidationError" });

      expect(syncFocusSession).not.toHaveBeenCalled();
    });

    it("CREATE_GRATITUDE handler calls syncGratitude with valid payload", async () => {
      const handler = getHandler("CREATE_GRATITUDE");
      const entry = makeGratitudeEntry();
      await handler(makeAction("CREATE_GRATITUDE", entry, entry.id));

      expect(syncGratitude).toHaveBeenCalledWith(entry, "account-a");
    });

    it("DELETE_GRATITUDE handler calls deleteGratitudeFromCloud", async () => {
      const handler = getHandler("DELETE_GRATITUDE");
      await handler(makeAction("DELETE_GRATITUDE", null, "grat-del"));

      expect(deleteGratitudeFromCloud).toHaveBeenCalledWith("grat-del", "account-a");
    });

    it("SYNC_JOURNAL_ENTRY handler calls syncJournalEntry with valid payload", async () => {
      const handler = getHandler("SYNC_JOURNAL_ENTRY");
      const entry = { id: "journal-1", date: "2026-03-14", content: "Today was good" };
      await handler(makeAction("SYNC_JOURNAL_ENTRY", entry, entry.id));

      expect(syncJournalEntry).toHaveBeenCalledWith(
        entry,
        "account-a",
        expect.any(AbortSignal),
      );
    });

    it("SYNC_JOURNAL_ENTRY handler rejects payload with missing id", async () => {
      const handler = getHandler("SYNC_JOURNAL_ENTRY");
      const badEntry = { date: "2026-03-14", content: "no id" };
      await expect(
        handler(makeAction("SYNC_JOURNAL_ENTRY", badEntry, "bad")),
      ).rejects.toMatchObject({ name: "OfflineQueuePayloadValidationError" });

      expect(syncJournalEntry).not.toHaveBeenCalled();
    });

    it("SYNC_JOURNAL_ENTRY handler rejects payload with missing date", async () => {
      const handler = getHandler("SYNC_JOURNAL_ENTRY");
      const badEntry = { id: "j-1", content: "no date" };
      await expect(
        handler(makeAction("SYNC_JOURNAL_ENTRY", badEntry, "j-1")),
      ).rejects.toMatchObject({ name: "OfflineQueuePayloadValidationError" });

      expect(syncJournalEntry).not.toHaveBeenCalled();
    });

    it("DELETE_JOURNAL_ENTRY handler calls deleteJournalEntryFromCloud", async () => {
      const handler = getHandler("DELETE_JOURNAL_ENTRY");
      const result = await handler(makeAction("DELETE_JOURNAL_ENTRY", null, "journal-del"));

      expect(deleteJournalEntryFromCloud).toHaveBeenCalledWith(
        "journal-del",
        "account-a",
        expect.any(AbortSignal),
      );
      expect(result).toEqual({ status: "committed" });
    });

    it("DELETE_JOURNAL_ENTRY handler preserves the server-paused intent", async () => {
      vi.mocked(deleteJournalEntryFromCloud).mockResolvedValueOnce({
        status: "deferred",
        reason: "password-removal-paused",
      });
      const handler = getHandler("DELETE_JOURNAL_ENTRY");

      await expect(
        handler(makeAction("DELETE_JOURNAL_ENTRY", null, "journal-paused")),
      ).resolves.toEqual({
        status: "deferred",
        reason: "password-removal-paused",
      });
    });

    it("UPLOAD_JOURNAL_PHOTO_STORAGE handler retries photo upload from an id-only payload", async () => {
      const handler = getHandler("UPLOAD_JOURNAL_PHOTO_STORAGE");
      await handler(
        makeAction(
          "UPLOAD_JOURNAL_PHOTO_STORAGE",
          { id: "photo-1" },
          "journal-photo-upload:photo-1"
        )
      );

      expect(retryJournalPhotoUpload).toHaveBeenCalledWith(
        { id: "photo-1" },
        "account-a",
        expect.any(AbortSignal),
      );
    });

    it("UPLOAD_JOURNAL_AUDIO_STORAGE handler retries audio upload from an id-only payload", async () => {
      const handler = getHandler("UPLOAD_JOURNAL_AUDIO_STORAGE");
      await handler(
        makeAction(
          "UPLOAD_JOURNAL_AUDIO_STORAGE",
          { id: "audio-1" },
          "journal-audio-upload:audio-1"
        )
      );

      expect(retryJournalAudioUpload).toHaveBeenCalledWith(
        { id: "audio-1" },
        "account-a",
        expect.any(AbortSignal),
      );
    });

    it("DELETE_JOURNAL_PHOTO_STORAGE handler retries photo delete from an id-only payload", async () => {
      const handler = getHandler("DELETE_JOURNAL_PHOTO_STORAGE");
      await handler(
        makeAction(
          "DELETE_JOURNAL_PHOTO_STORAGE",
          { id: "photo-1" },
          "journal-photo-delete:photo-1"
        )
      );

      expect(retryJournalPhotoDelete).toHaveBeenCalledWith(
        { id: "photo-1" },
        "account-a",
        expect.any(AbortSignal),
      );
    });

    it("DELETE_JOURNAL_AUDIO_STORAGE handler retries audio delete from an id-only payload", async () => {
      const handler = getHandler("DELETE_JOURNAL_AUDIO_STORAGE");
      await handler(
        makeAction(
          "DELETE_JOURNAL_AUDIO_STORAGE",
          { id: "audio-1" },
          "journal-audio-delete:audio-1"
        )
      );

      expect(retryJournalAudioDelete).toHaveBeenCalledWith(
        { id: "audio-1" },
        "account-a",
        expect.any(AbortSignal),
      );
    });

    it("MIGRATE_JOURNAL_SECURITY runs the durable migration for the queue owner", async () => {
      const handler = getHandler("MIGRATE_JOURNAL_SECURITY");
      const payload = { revision: "revision-1" };

      await handler(
        makeAction(
          "MIGRATE_JOURNAL_SECURITY",
          payload,
          "journal-security:revision-1",
        ),
      );

      expect(runJournalSecurityMigration).toHaveBeenCalledWith(payload, "account-a");
    });

    it("WRITE_SYNC_EVENT handler retries the durable event-log write", async () => {
      const handler = getHandler("WRITE_SYNC_EVENT");
      const intent = {
        entityType: "habit",
        entityId: "habit-1",
        op: "delete",
        payload: null,
        deviceId: "device-1",
      };

      await handler(makeAction("WRITE_SYNC_EVENT", intent, "sync-event:habit:habit-1:delete"));

      expect(writeQueuedEventAndBroadcast).toHaveBeenCalledWith(
        {
          ...intent,
          idempotencyKey: "11111111-1111-4111-8111-111111111111",
        },
        "account-a",
      );
    });

    it("rejects an invalid critical sync event instead of acknowledging it", async () => {
      const handler = getHandler("WRITE_SYNC_EVENT");

      await expect(
        handler(makeAction("WRITE_SYNC_EVENT", { broken: true }, "sync-event-invalid")),
      ).rejects.toMatchObject({ name: "OfflineQueuePayloadValidationError" });
      expect(writeQueuedEventAndBroadcast).not.toHaveBeenCalled();
    });

    it("UPDATE_SETTINGS handler calls syncSetting with valid payload", async () => {
      const handler = getHandler("UPDATE_SETTINGS");
      await handler(
        makeAction(
          "UPDATE_SETTINGS",
          { key: "journal_draft_new", value: { title: "draft" } },
          "journal_draft_new"
        )
      );

      expect(syncSetting).toHaveBeenCalledWith(
        "journal_draft_new",
        { title: "draft" },
        "account-a"
      );
    });

    it("turns an in-helper owner switch into a queue owner-boundary stop", async () => {
      const queueBoundary = new Error("queue-owner-boundary-stop");
      let ownerChecks = 0;
      const context: OfflineQueueHandlerContext = {
        ownerUserId: "account-a",
        operationId: "22222222-2222-4222-8222-222222222222",
        signal: new AbortController().signal,
        runIfOwnerCurrent: async (operation) => {
          ownerChecks += 1;
          if (ownerChecks === 2) throw queueBoundary;
          return operation();
        },
      };
      vi.mocked(syncSetting).mockRejectedValueOnce(
        new SyncOwnerBoundaryError("Setting sync")
      );
      const handler = getHandler("UPDATE_SETTINGS", context);

      await expect(
        handler(
          makeAction(
            "UPDATE_SETTINGS",
            { key: "mood-reminder-enabled", value: true },
            "mood-reminder-enabled"
          )
        )
      ).rejects.toBe(queueBoundary);

      expect(ownerChecks).toBe(2);
    });

    it("keeps a journal action queued when its helper detects an owner switch", async () => {
      const queueBoundary = new Error("queue-owner-boundary-stop");
      let ownerChecks = 0;
      const context: OfflineQueueHandlerContext = {
        ownerUserId: "account-a",
        operationId: "33333333-3333-4333-8333-333333333333",
        signal: new AbortController().signal,
        runIfOwnerCurrent: async (operation) => {
          ownerChecks += 1;
          if (ownerChecks === 2) throw queueBoundary;
          return operation();
        },
      };
      vi.mocked(syncJournalEntry).mockRejectedValueOnce(
        new SyncOwnerBoundaryError("Journal sync"),
      );
      const handler = getHandler("SYNC_JOURNAL_ENTRY", context);

      await expect(
        handler(
          makeAction(
            "SYNC_JOURNAL_ENTRY",
            { id: "journal-a", date: "2026-07-10", content: "private" },
            "journal-a",
          ),
        ),
      ).rejects.toBe(queueBoundary);

      expect(ownerChecks).toBe(2);
    });

    it("UPDATE_SETTINGS handler rejects invalid payload", async () => {
      const handler = getHandler("UPDATE_SETTINGS");
      await expect(
        handler(makeAction("UPDATE_SETTINGS", {}, "settings")),
      ).rejects.toMatchObject({ name: "OfflineQueuePayloadValidationError" });

      expect(syncSetting).not.toHaveBeenCalled();
    });

    it("DELETE_SETTINGS handler calls deleteSettingFromCloud", async () => {
      const handler = getHandler("DELETE_SETTINGS");
      await handler(
        makeAction("DELETE_SETTINGS", { key: "journal_draft_new" }, "journal_draft_new")
      );

      expect(deleteSettingFromCloud).toHaveBeenCalledWith("journal_draft_new", "account-a");
    });
  });

  // ─── Queue Helper Functions ──────────────────────────────────

  describe("queue helper functions", () => {
    it("queueMoodSync enqueues with correct action, entityId, and payload", async () => {
      const mood = makeMoodEntry({ id: "mood-q1" });
      await queueMoodSync("CREATE_MOOD", mood);

      expect(offlineQueue.enqueue).toHaveBeenCalledWith("CREATE_MOOD", "mood-q1", mood, {
        expectedOwnerUserId: "account-a",
      });
    });

    it("queueMoodSync supports UPDATE_MOOD action", async () => {
      const mood = makeMoodEntry({ id: "mood-q2" });
      await queueMoodSync("UPDATE_MOOD", mood);

      expect(offlineQueue.enqueue).toHaveBeenCalledWith("UPDATE_MOOD", "mood-q2", mood, {
        expectedOwnerUserId: "account-a",
      });
    });

    it("queueMoodSync supports DELETE_MOOD action", async () => {
      const mood = makeMoodEntry({ id: "mood-q3" });
      await queueMoodSync("DELETE_MOOD", mood);

      expect(offlineQueue.enqueue).toHaveBeenCalledWith("DELETE_MOOD", "mood-q3", mood, {
        expectedOwnerUserId: "account-a",
      });
    });

    it("queueHabitSync enqueues with correct parameters", async () => {
      const habit = makeHabit({ id: "habit-q1" });
      await queueHabitSync("CREATE_HABIT", habit);

      expect(offlineQueue.enqueue).toHaveBeenCalledWith("CREATE_HABIT", "habit-q1", habit, {
        expectedOwnerUserId: "account-a",
      });
    });

    it("queueHabitSync supports TOGGLE_HABIT action", async () => {
      const habit = makeHabit({ id: "habit-q2" });
      await queueHabitSync("TOGGLE_HABIT", habit);

      expect(offlineQueue.enqueue).toHaveBeenCalledWith("TOGGLE_HABIT", "habit-q2", habit, {
        expectedOwnerUserId: "account-a",
      });
    });

    it("queueFocusSessionSync enqueues with CREATE_FOCUS_SESSION", async () => {
      const session = makeFocusSession({ id: "focus-q1" });
      await queueFocusSessionSync(session);

      expect(offlineQueue.enqueue).toHaveBeenCalledWith(
        "CREATE_FOCUS_SESSION",
        "focus-q1",
        session,
        { expectedOwnerUserId: "account-a" }
      );
    });

    it("queueGratitudeSync enqueues with correct parameters", async () => {
      const entry = makeGratitudeEntry({ id: "grat-q1" });
      await queueGratitudeSync("CREATE_GRATITUDE", entry);

      expect(offlineQueue.enqueue).toHaveBeenCalledWith("CREATE_GRATITUDE", "grat-q1", entry, {
        expectedOwnerUserId: "account-a",
      });
    });

    it("queueGratitudeSync supports DELETE_GRATITUDE action", async () => {
      const entry = makeGratitudeEntry({ id: "grat-q2" });
      await queueGratitudeSync("DELETE_GRATITUDE", entry);

      expect(offlineQueue.enqueue).toHaveBeenCalledWith("DELETE_GRATITUDE", "grat-q2", entry, {
        expectedOwnerUserId: "account-a",
      });
    });
  });
});
