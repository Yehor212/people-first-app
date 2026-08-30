import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), sync: vi.fn(), auth: vi.fn() },
}));

vi.mock("@/lib/safeJson", async () => {
  const actual = await vi.importActual<typeof import("@/lib/safeJson")>("@/lib/safeJson");
  return {
    ...actual,
    storageKeys: vi.fn(() => Object.keys(localStorage)),
    storageRemove: vi.fn((key: string) => {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }),
  };
});

vi.mock("@/lib/storageKeys", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storageKeys")>("@/lib/storageKeys");
  return actual;
});

import {
  db,
  clearLocalUserData,
  checkDatabaseHealth,
  moodsRepo,
  habitsRepo,
  focusRepo,
  gratitudeRepo,
  settingsRepo,
  journalEntriesRepo,
  journalPhotosRepo,
  journalHubPreferencesRepo,
  journalSpacesRepo,
  journalPracticeSessionsRepo,
  journalEntryLinksRepo,
  journalSpaceCapturesRepo,
} from "@/storage/db";
import { SK, SSK } from "@/lib/storageKeys";
import { useMoodEntryDraftStore } from "@/stores/moodEntryDraftStore";
import { useUserDataStore } from "@/stores/userDataStore";

const EXPECTED_TABLES = [
  "moods",
  "habits",
  "focusSessions",
  "gratitudeEntries",
  "settings",
  "offlineQueue",
  "deadLetterQueue",
  "journalEntries",
  "journalPhotos",
  "journalAudio",
  "journalHubPreferences",
  "journalSpaces",
  "journalPracticeSessions",
  "journalEntryLinks",
  "journalSpaceCaptures",
];

// ─── Database Instance ───────────────────────────────────────────

describe("database instance", () => {
  it("db exists and is defined", () => {
    expect(db).toBeDefined();
  });

  it('db has name "ZenFlowDB"', () => {
    expect(db.name).toBe("ZenFlowDB");
  });

  it.each(EXPECTED_TABLES)('has table "%s"', (tableName) => {
    expect((db as any)[tableName]).toBeDefined();
  });

  it("has the correct number of tables", () => {
    // Dexie tables property lists all tables
    const tableNames = db.tables.map((t) => t.name);
    EXPECTED_TABLES.forEach((name) => {
      expect(tableNames).toContain(name);
    });
  });
});

// ─── Repository Exports ──────────────────────────────────────────

describe("repository exports", () => {
  it("moodsRepo is db.moods", () => {
    expect(moodsRepo).toBe(db.moods);
  });

  it("habitsRepo is db.habits", () => {
    expect(habitsRepo).toBe(db.habits);
  });

  it("focusRepo is db.focusSessions", () => {
    expect(focusRepo).toBe(db.focusSessions);
  });

  it("gratitudeRepo is db.gratitudeEntries", () => {
    expect(gratitudeRepo).toBe(db.gratitudeEntries);
  });

  it("settingsRepo is db.settings", () => {
    expect(settingsRepo).toBe(db.settings);
  });

  it("journalEntriesRepo is db.journalEntries", () => {
    expect(journalEntriesRepo).toBe(db.journalEntries);
  });

  it("journalPhotosRepo is db.journalPhotos", () => {
    expect(journalPhotosRepo).toBe(db.journalPhotos);
  });

  it("journalHubPreferencesRepo is db.journalHubPreferences", () => {
    expect(journalHubPreferencesRepo).toBe(db.journalHubPreferences);
  });

  it("journalSpacesRepo is db.journalSpaces", () => {
    expect(journalSpacesRepo).toBe(db.journalSpaces);
  });

  it("journalPracticeSessionsRepo is db.journalPracticeSessions", () => {
    expect(journalPracticeSessionsRepo).toBe(db.journalPracticeSessions);
  });

  it("journalEntryLinksRepo is db.journalEntryLinks", () => {
    expect(journalEntryLinksRepo).toBe(db.journalEntryLinks);
  });

  it("journalSpaceCapturesRepo is db.journalSpaceCaptures", () => {
    expect(journalSpaceCapturesRepo).toBe(db.journalSpaceCaptures);
  });
});

// ─── clearLocalUserData ──────────────────────────────────────────

describe("clearLocalUserData", () => {
  beforeEach(async () => {
    // Open db and seed data into tables so we can verify clearing
    await db.open();
    await db.moods.put({ id: "test-mood-1", timestamp: Date.now() } as any);
    await db.habits.put({ id: "test-habit-1", createdAt: Date.now() } as any);
    await db.settings.put({ key: "zenflow-moods", value: "test" });
    await db.focusSessions.put({ id: "test-focus-1", startTime: Date.now() } as any);
    await db.gratitudeEntries.put({ id: "test-grat-1", timestamp: Date.now() } as any);
    await db.journalHubPreferences.put({
      id: "default",
      homeView: "entries",
      visibleViews: ["entries"],
      dockActions: ["write"],
      density: "balanced",
      motion: "system",
      background: "clean",
      updatedAt: Date.now(),
    } as any);
    await db.journalSpaces.put({
      id: "space-1",
      iconKey: "folder",
      accent: "primary",
      private: false,
      sortOrder: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);
    await db.journalPracticeSessions.put({
      id: "practice-1",
      practiceId: "focus-note",
      startedAt: Date.now(),
    });
    await db.journalEntryLinks.put({
      id: "link-1",
      entryId: "entry-1",
      targetType: "space",
      targetId: "space-1",
      createdAt: Date.now(),
    } as any);
    await db.offlineQueue.put({
      id: "queue-1",
      type: "WRITE_SYNC_EVENT",
      entityId: "habit-1",
      payload: {},
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3,
    });
    await db.deadLetterQueue.put({
      id: "dead-1",
      type: "WRITE_SYNC_EVENT",
      entityId: "habit-1",
      payload: {},
      lastError: "failed",
      failedAt: Date.now(),
    });
    await db.settings.put({ key: "sync-last-seq", value: 42 });
    await db.settings.put({ key: "zenflow-device-id", value: "device-old" });
    await db.settings.put({ key: "zenflow-deleted-habit-ids", value: ["habit-old"] });
    await db.settings.put({ key: "journal_vault_key", value: { wrappedKey: "wrapped-key" } });
    await db.settings.put({ key: "journal_password_reset_proof", value: { nonce: "reset-proof" } });
    await db.settings.put({ key: SK.JOURNAL_VAULT_REVISION, value: 42 });
    await db.settings.put({
      key: SK.JOURNAL_SECURITY_REMOVAL,
      value: {
        version: 1,
        revision: "remove-a",
        ownerUserId: "account-a",
        createdAt: 1,
        status: "pending",
      },
    });
    await db.settings.put({ key: "journal_draft_new", value: { title: "private draft" } });
    await db.settings.put({ key: "journal_draft_entry-1", value: { title: "entry draft" } });

    // Set some localStorage keys that should be cleared
    localStorage.setItem("zenflow-moods", "data");
    localStorage.setItem("zenflow-habits", "data");
    localStorage.setItem("zenflow_cloud_sync_enabled", "true");
    localStorage.setItem("zenflow_offline_queue", "[]");
    localStorage.setItem("zenflow-device-id", "device-old");
    localStorage.setItem("sync-last-seq", "42");
    localStorage.setItem("zenflow-deleted-habit-ids", '["habit-old"]');
    localStorage.setItem("journal_vault_key", '{"wrappedKey":"wrapped-key"}');
    localStorage.setItem("journal_password_reset_proof", '{"nonce":"reset-proof"}');
    localStorage.setItem("journal_draft_new", '{"title":"private draft"}');
    localStorage.setItem(
      SK.PROFILE_RECOVERY,
      JSON.stringify({ version: 1, name: "Account A", userChosen: true })
    );
  });

  it("clears moods table", async () => {
    await clearLocalUserData();
    const count = await db.moods.count();
    expect(count).toBe(0);
  });

  it("clears habits table", async () => {
    await clearLocalUserData();
    const count = await db.habits.count();
    expect(count).toBe(0);
  });

  it("clears focusSessions table", async () => {
    await clearLocalUserData();
    const count = await db.focusSessions.count();
    expect(count).toBe(0);
  });

  it("clears gratitudeEntries table", async () => {
    await clearLocalUserData();
    const count = await db.gratitudeEntries.count();
    expect(count).toBe(0);
  });

  it("deletes user-specific settings keys from settings table", async () => {
    await clearLocalUserData();
    const setting = await db.settings.get("zenflow-moods");
    expect(setting).toBeUndefined();
  });

  it("clears the account-bound profile recovery envelope", async () => {
    await clearLocalUserData();

    expect(localStorage.getItem(SK.PROFILE_RECOVERY)).toBeNull();
  });

  it("clears journal hub local tables", async () => {
    await clearLocalUserData();

    await expect(db.journalHubPreferences.count()).resolves.toBe(0);
    await expect(db.journalSpaces.count()).resolves.toBe(0);
    await expect(db.journalPracticeSessions.count()).resolves.toBe(0);
    await expect(db.journalEntryLinks.count()).resolves.toBe(0);
  });

  it("clears offline queues and account-bound sync state", async () => {
    await clearLocalUserData();

    await expect(db.offlineQueue.count()).resolves.toBe(0);
    await expect(db.deadLetterQueue.count()).resolves.toBe(0);
    await expect(db.settings.get("sync-last-seq")).resolves.toBeUndefined();
    await expect(db.settings.get("zenflow-device-id")).resolves.toBeUndefined();
    await expect(db.settings.get("zenflow-deleted-habit-ids")).resolves.toBeUndefined();
    expect(localStorage.getItem("sync-last-seq")).toBeNull();
    expect(localStorage.getItem("zenflow-device-id")).toBeNull();
    expect(localStorage.getItem("zenflow-deleted-habit-ids")).toBeNull();
  });

  it("clears every non-Dexie account payload that could be reused by the next session", async () => {
    const accountPayloadKeys = [
      SK.TASKS,
      SK.INNER_WORLD,
      SK.CHALLENGES,
      SK.QUESTS,
      SK.FRIENDS,
      SK.MY_FRIEND_PROFILE,
      SK.FRIEND_ACTIVITIES,
      SK.COACH_HISTORY,
      SK.USER_BIRTH_DATE,
      SK.CALENDAR_CACHE,
      SK.WIDGET_DATA,
    ];
    for (const key of accountPayloadKeys) {
      localStorage.setItem(key, JSON.stringify({ owner: "account-a" }));
      await db.settings.put({ key, value: { owner: "account-a" } });
    }

    await clearLocalUserData();

    for (const key of accountPayloadKeys) {
      expect(localStorage.getItem(key), key).toBeNull();
      await expect(db.settings.get(key), key).resolves.toBeUndefined();
    }
  });

  it("clears account-bound session data and the in-memory mood draft", async () => {
    useMoodEntryDraftStore.getState().setValence(-0.667);
    useMoodEntryDraftStore.getState().setEmotion("overwhelmed");
    useMoodEntryDraftStore.getState().setNote("Private account A note");
    const accountAccessToken = crypto.randomUUID();
    const accountRefreshToken = crypto.randomUUID();
    sessionStorage.setItem(
      SSK.SPOTIFY_TOKENS,
      JSON.stringify({ accessToken: accountAccessToken, refreshToken: accountRefreshToken })
    );
    sessionStorage.setItem(SSK.SPOTIFY_PKCE_VERIFIER, "account-a-verifier");

    await clearLocalUserData();

    expect(sessionStorage.getItem(SSK.MOOD_ENTRY_DRAFT)).toBeNull();
    expect(sessionStorage.getItem(SSK.SPOTIFY_TOKENS)).toBeNull();
    expect(sessionStorage.getItem(SSK.SPOTIFY_PKCE_VERIFIER)).toBeNull();
    expect(useMoodEntryDraftStore.getState()).toMatchObject({
      valence: null,
      scope: "now",
      specificTime: null,
      emotion: null,
      note: "",
    });
  });

  it("does not carry privacy or remote-push consent into the next account", async () => {
    const accountAPrivacy = {
      noTracking: true,
      analytics: false,
      consentShown: true,
      pushNotifications: true,
    };
    await db.settings.put({ key: SK.PRIVACY, value: accountAPrivacy });
    localStorage.setItem(SK.PRIVACY, JSON.stringify(accountAPrivacy));
    useUserDataStore.setState({ privacy: accountAPrivacy });

    await clearLocalUserData();

    await expect(db.settings.get(SK.PRIVACY)).resolves.toBeUndefined();
    expect(localStorage.getItem(SK.PRIVACY)).toBeNull();
    expect(useUserDataStore.getState().privacy).toEqual({
      noTracking: false,
      analytics: false,
      consentShown: false,
      adAgeEligibility: "unknown",
      pushNotifications: false,
    });
  });

  it("clears wrapped journal vault keys at the account boundary", async () => {
    await clearLocalUserData();

    await expect(db.settings.get("journal_vault_key")).resolves.toBeUndefined();
    expect(localStorage.getItem("journal_vault_key")).toBeNull();
  });

  it("clears pending journal reset proof at the account boundary", async () => {
    await clearLocalUserData();

    await expect(db.settings.get("journal_password_reset_proof")).resolves.toBeUndefined();
    expect(localStorage.getItem("journal_password_reset_proof")).toBeNull();
  });

  it("clears the diary vault revision and pending removal intent only at the account boundary", async () => {
    await clearLocalUserData();

    await expect(db.settings.get(SK.JOURNAL_VAULT_REVISION)).resolves.toBeUndefined();
    await expect(db.settings.get(SK.JOURNAL_SECURITY_REMOVAL)).resolves.toBeUndefined();
  });

  it("clears dynamic unsaved journal draft settings at the account boundary", async () => {
    await clearLocalUserData();

    await expect(db.settings.get("journal_draft_new")).resolves.toBeUndefined();
    await expect(db.settings.get("journal_draft_entry-1")).resolves.toBeUndefined();
    expect(localStorage.getItem("journal_draft_new")).toBeNull();
  });

  it("removes expected localStorage keys", async () => {
    await clearLocalUserData();
    // storageRemove is called for user keys
    const { storageRemove } = await import("@/lib/safeJson");
    expect(storageRemove).toHaveBeenCalled();
  });

  it("keeps the durable sign-out cleanup marker outside the real account purge", async () => {
    const pendingCleanupKey = "zenflow_pending_account_sign_out_cleanup";
    const marker = JSON.stringify({
      version: 1,
      ownerUserId: "account-a",
      localDataOwnerUserId: "account-a",
      phase: "purging-local-data",
      createdAt: 1,
    });
    localStorage.setItem(pendingCleanupKey, marker);

    try {
      await clearLocalUserData();

      await expect(db.moods.count()).resolves.toBe(0);
      await expect(db.settings.get(SK.DATA_OWNER_ID)).resolves.toBeUndefined();
      expect(localStorage.getItem(pendingCleanupKey)).toBe(marker);
    } finally {
      localStorage.removeItem(pendingCleanupKey);
    }
  });

  it("clears the imported-backup claim fence only after local data removal succeeds", async () => {
    localStorage.setItem(
      SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM,
      JSON.stringify({ version: 1, generation: "claim-generation" })
    );

    await clearLocalUserData();

    expect(localStorage.getItem(SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM)).toBeNull();
  });

  it("rejects when both the transactional purge and database recreation fail", async () => {
    const claimFence = JSON.stringify({ version: 1, generation: "claim-generation" });
    localStorage.setItem(SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM, claimFence);
    vi.spyOn(db, "transaction").mockRejectedValueOnce(new Error("transaction failed"));
    vi.spyOn(db, "delete").mockRejectedValueOnce(new Error("database recreation failed"));

    await expect(clearLocalUserData()).rejects.toThrow("Unable to clear data on this device");
    expect(localStorage.getItem(SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM)).toBe(claimFence);
  });

  it("rejects when an account-bound browser-storage value cannot be removed", async () => {
    const { storageRemove } = await import("@/lib/safeJson");
    vi.mocked(storageRemove).mockReturnValue(false);

    await expect(clearLocalUserData()).rejects.toThrow("Unable to clear data on this device");
  });
});

// ─── checkDatabaseHealth ─────────────────────────────────────────

describe("checkDatabaseHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves the database and reports unhealthy when opening fails", async () => {
    const openError = new Error("transient open failure");
    const openSpy = vi.spyOn(db, "open").mockRejectedValueOnce(openError);
    const deleteSpy = vi
      .spyOn(db, "delete")
      .mockRejectedValue(new Error("destructive fallback blocked by test"));

    try {
      await expect(checkDatabaseHealth()).resolves.toBe(false);
      expect(deleteSpy).not.toHaveBeenCalled();
    } finally {
      openSpy.mockRestore();
      deleteSpy.mockRestore();
    }
  });

  it("preserves the database and reports unhealthy when the count probe fails", async () => {
    const countSpy = vi.spyOn(db.moods, "count").mockRejectedValueOnce(new Error("quota failure"));
    const deleteSpy = vi
      .spyOn(db, "delete")
      .mockRejectedValue(new Error("destructive fallback blocked by test"));

    try {
      await expect(checkDatabaseHealth()).resolves.toBe(false);
      expect(deleteSpy).not.toHaveBeenCalled();
    } finally {
      countSpy.mockRestore();
      deleteSpy.mockRestore();
    }
  });

  it("does not delete the database when an open failure arrives after the timeout", async () => {
    vi.useFakeTimers();
    const openSpy = vi.spyOn(db, "open").mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("late open failure")), 6000);
        }) as ReturnType<typeof db.open>
    );
    const deleteSpy = vi
      .spyOn(db, "delete")
      .mockRejectedValue(new Error("destructive fallback blocked by test"));

    try {
      const healthCheck = checkDatabaseHealth();
      await vi.advanceTimersByTimeAsync(5000);
      await expect(healthCheck).resolves.toBe(true);
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      expect(deleteSpy).not.toHaveBeenCalled();
    } finally {
      openSpy.mockRestore();
      deleteSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("does not emit timeout warning after a healthy database check", async () => {
    vi.useFakeTimers();
    try {
      const { logger } = await import("@/lib/logger");

      const result = await checkDatabaseHealth();

      expect(result).toBe(true);
      await vi.advanceTimersByTimeAsync(5000);
      expect(logger.warn).not.toHaveBeenCalledWith(
        "[DB] Database health check timed out - continuing anyway"
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns true when database is healthy", async () => {
    const result = await checkDatabaseHealth();
    expect(result).toBe(true);
  });

  it("returns a boolean", async () => {
    const result = await checkDatabaseHealth();
    expect(typeof result).toBe("boolean");
  });
});
