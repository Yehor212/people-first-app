import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const CONSENT_EPOCH = "22222222-2222-4222-8222-222222222222";

vi.mock("@/lib/cloudSyncSettings", () => ({ isCloudSyncEnabled: () => true }));
vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    sync: vi.fn(),
    auth: vi.fn(),
  },
}));
vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: () => Promise.resolve(OWNER_ID),
  getCurrentUserId: () => Promise.resolve(OWNER_ID),
}));
vi.mock("@/storage/realtimeSync", () => ({
  syncJournalEntry: vi.fn(() => Promise.resolve()),
  deleteJournalEntryFromCloud: vi.fn(() => Promise.resolve()),
  syncJournalPhoto: vi.fn(() => Promise.resolve()),
  syncJournalAudio: vi.fn(() => Promise.resolve()),
  deleteJournalPhotoFromCloud: vi.fn(() => Promise.resolve()),
  deleteJournalAudioFromCloud: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/storage/cloudSync", () => ({ triggerSync: vi.fn() }));
vi.mock("@/storage/journalStorageService", () => ({
  uploadPhoto: vi.fn(() => Promise.resolve(null)),
  uploadEncryptedPhoto: vi.fn(() => Promise.resolve(null)),
  uploadAudio: vi.fn(() => Promise.resolve(null)),
  uploadEncryptedAudio: vi.fn(() => Promise.resolve(null)),
  deletePhotoFromStorage: vi.fn(() => Promise.resolve()),
  deleteAudioFromStorage: vi.fn(() => Promise.resolve()),
  deleteEntryMediaFromStorage: vi.fn(() => Promise.resolve()),
  deleteJournalMediaStoragePath: vi.fn(() => Promise.resolve()),
  downloadAsBase64: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: vi.fn(async (expected?: string) =>
    !expected || expected === OWNER_ID ? OWNER_ID : null
  ),
}));

import { offlineQueue } from "@/lib/offlineQueue";
import { logger } from "@/lib/logger";
import { db, setLocalDataOwnerId } from "@/storage/db";
import { notifyAccountSessionTransition } from "@/storage/accountBoundaryRuntime";
import * as automationPreferences from "@/features/automation/automationPreferences";
import {
  AUTOMATION_PREFERENCE_SETTING_KEY,
  AUTOMATION_SOURCE_RESCAN_SETTING_KEY,
} from "@/features/automation/types";
import { saveEntry, updateEntry } from "../journalStorage";

describe("journal source intent atomic persistence", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.open();
    await offlineQueue.waitForInit();
    await db.transaction(
      "rw",
      [
        db.settings,
        db.journalEntries,
        db.journalPhotos,
        db.journalAudio,
        db.journalEntryLinks,
        db.offlineQueue,
        db.automationTransactions,
      ],
      async () => {
        await db.settings.clear();
        await db.journalEntries.clear();
        await db.journalPhotos.clear();
        await db.journalAudio.clear();
        await db.journalEntryLinks.clear();
        await db.offlineQueue.clear();
        await db.automationTransactions.clear();
      }
    );
    await setLocalDataOwnerId(OWNER_ID);
    await db.settings.put({
      key: AUTOMATION_PREFERENCE_SETTING_KEY,
      value: {
        schemaVersion: 1,
        enabled: true,
        serverRevision: 4,
        consentEpoch: CONSENT_EPOCH,
        consentedAt: 90,
        revokedAt: null,
        revocationPending: false,
        enabledRuleIds: ["journal.mood-to-checkin.v1"],
        focusHabitId: null,
        focusMinimumMinutes: 25,
        planningHabitMappings: {},
        updatedAt: 90,
      },
    });
    vi.spyOn(Date, "now").mockReturnValue(100);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("commits the journal, ordinary sync outbox, revision detachment and prose-free source intent together", async () => {
    const sourceReady = vi.fn();
    window.addEventListener("zenflow:automation-source-ready", sourceReady);
    const entry = await saveEntry({
      date: "2026-08-08",
      title: "Private title",
      content: "Private body",
      stickers: [],
      photoIds: [],
      audioIds: [],
      mood: "good",
      tags: [],
    });
    window.removeEventListener("zenflow:automation-source-ready", sourceReady);

    expect(sourceReady).toHaveBeenCalledTimes(1);
    await expect(db.journalEntries.get(entry.id)).resolves.toBeDefined();
    await expect(db.offlineQueue.where("entityId").equals(entry.id).count()).resolves.toBe(1);
    const sourceRows = await db.automationTransactions
      .where("kind")
      .equals("source_pending")
      .toArray();
    expect(sourceRows).toHaveLength(1);
    expect(sourceRows[0]).toMatchObject({
      ownerUserId: OWNER_ID,
      consentEpoch: CONSENT_EPOCH,
      source: {
        type: "journal",
        id: entry.id,
        revision: "updatedAt:100",
      },
      candidateRuleIds: ["journal.mood-to-checkin.v1"],
    });
    expect(JSON.stringify(sourceRows[0])).not.toContain("Private title");
    expect(JSON.stringify(sourceRows[0])).not.toContain("Private body");
    await expect(
      db.automationTransactions.get(`record_revision:journal:${entry.id}`)
    ).resolves.toBeUndefined();
  });

  it("detaches an existing automation revision when a manual journal update has no source intent", async () => {
    const entry = await saveEntry({
      date: "2026-08-08",
      title: "Private title",
      content: "Private body",
      stickers: [],
      photoIds: [],
      audioIds: [],
      mood: "good",
      tags: [],
    });
    await db.automationTransactions.put({
      kind: "record_revision",
      id: `record_revision:journal:${entry.id}`,
      schemaVersion: 1,
      ownerUserId: OWNER_ID,
      entityType: "journal",
      entityId: entry.id,
      recordExists: true,
      revisionToken: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      stateHash: `sha256:${"a".repeat(64)}`,
      mutationGeneration: 1,
      transactionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      updatedAt: entry.updatedAt,
    });
    await db.settings.put({
      key: AUTOMATION_PREFERENCE_SETTING_KEY,
      value: {
        schemaVersion: 1,
        enabled: false,
        serverRevision: 5,
        consentEpoch: null,
        consentedAt: null,
        revokedAt: 101,
        revocationPending: false,
        enabledRuleIds: [],
        focusHabitId: null,
        focusMinimumMinutes: 25,
        planningHabitMappings: {},
        updatedAt: 101,
      },
    });

    await updateEntry(entry.id, { content: "New private body" }, entry.updatedAt);

    await expect(
      db.automationTransactions.get(`record_revision:journal:${entry.id}`)
    ).resolves.toBeUndefined();
    await expect(db.offlineQueue.where("entityId").equals(entry.id).count()).resolves.toBe(2);
    await expect(db.offlineQueue.where("entityId").equals(entry.id).toArray()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "SYNC_JOURNAL_ENTRY",
          payload: expect.objectContaining({ content: expect.any(String), updatedAt: 100 }),
        }),
        expect.objectContaining({
          type: "SYNC_JOURNAL_ENTRY",
          payload: expect.objectContaining({ content: expect.any(String), updatedAt: 101 }),
        }),
      ])
    );
  });

  it("rolls back the journal and sync outbox when source-intent persistence fails", async () => {
    const sourceReady = vi.fn();
    window.addEventListener("zenflow:automation-source-ready", sourceReady);
    vi.spyOn(db.automationTransactions, "put").mockRejectedValueOnce(
      new Error("injected automation write failure")
    );

    await expect(
      saveEntry({
        date: "2026-08-08",
        title: "Must roll back",
        content: "Must not persist",
        stickers: [],
        photoIds: [],
        audioIds: [],
        mood: "good",
        tags: [],
      })
    ).rejects.toThrow("injected automation write failure");
    window.removeEventListener("zenflow:automation-source-ready", sourceReady);

    expect(sourceReady).not.toHaveBeenCalled();
    await expect(db.journalEntries.count()).resolves.toBe(0);
    await expect(db.offlineQueue.count()).resolves.toBe(0);
    await expect(db.automationTransactions.count()).resolves.toBe(0);
  });

  it("atomically preserves a rescan marker when eligible journal intent preparation fails", async () => {
    vi.spyOn(automationPreferences, "readAutomationPreference").mockRejectedValueOnce(
      new Error("automation preference unavailable")
    );

    const entry = await saveEntry({
      date: "2026-08-08",
      title: "Private title",
      content: "Private body",
      stickers: [],
      photoIds: [],
      audioIds: [],
      mood: "good",
      tags: [],
    });

    await expect(db.journalEntries.get(entry.id)).resolves.toBeDefined();
    await expect(db.offlineQueue.where("entityId").equals(entry.id).count()).resolves.toBe(1);
    await expect(
      db.automationTransactions.where("kind").equals("source_pending").count()
    ).resolves.toBe(0);
    await expect(db.settings.get(AUTOMATION_SOURCE_RESCAN_SETTING_KEY)).resolves.toMatchObject({
      value: expect.objectContaining({ ownerUserId: OWNER_ID, revision: 1 }),
    });
  });

  it("does not expose a private queue-wake failure through the post-commit diagnostic", async () => {
    const privateCanary = "PRIVATE_JOURNAL_CANARY_7f4c";
    vi.spyOn(offlineQueue, "wakeFromDurableStorage").mockRejectedValueOnce(
      new Error(privateCanary)
    );

    await saveEntry({
      date: "2026-08-08",
      title: "Private title",
      content: "Private body",
      stickers: [],
      photoIds: [],
      audioIds: [],
      mood: "good",
      tags: [],
    });

    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalled());
    const diagnosticText = vi
      .mocked(logger.warn)
      .mock.calls.flat()
      .map((value) =>
        value instanceof Error ? `${value.name}:${value.message}` : JSON.stringify(value)
      )
      .join(" ");
    expect(diagnosticText).not.toContain(privateCanary);
  });

  it("rolls back the journal transaction after an ABA session transition", async () => {
    const originalAdd = db.journalEntries.add.bind(db.journalEntries);
    vi.spyOn(db.journalEntries, "add").mockImplementationOnce((value, key) => {
      const primaryKey = originalAdd(value, key);
      notifyAccountSessionTransition();
      notifyAccountSessionTransition();
      return primaryKey;
    });

    await expect(
      saveEntry({
        date: "2026-08-08",
        title: "Must roll back",
        content: "Private body",
        stickers: [],
        photoIds: [],
        audioIds: [],
        mood: "good",
        tags: [],
      })
    ).rejects.toThrow(/account boundary|session changed/i);

    await expect(db.journalEntries.count()).resolves.toBe(0);
    await expect(db.offlineQueue.count()).resolves.toBe(0);
    await expect(db.automationTransactions.count()).resolves.toBe(0);
  });

  it("commits an edited explicit mood, detachment and its new source revision together", async () => {
    const entry = await saveEntry({
      date: "2026-08-08",
      title: "Before",
      content: "Private body",
      stickers: [],
      photoIds: [],
      audioIds: [],
      mood: "good",
      tags: [],
    });
    vi.mocked(Date.now).mockReturnValue(101);
    const sourceReady = vi.fn();
    window.addEventListener("zenflow:automation-source-ready", sourceReady);

    await expect(updateEntry(entry.id, { mood: "bad" }, entry.updatedAt)).resolves.toBe(101);
    window.removeEventListener("zenflow:automation-source-ready", sourceReady);

    expect(sourceReady).toHaveBeenCalledTimes(1);
    await expect(db.journalEntries.get(entry.id)).resolves.toMatchObject({
      mood: "bad",
      updatedAt: 101,
    });
    const sourceRows = await db.automationTransactions
      .where("kind")
      .equals("source_pending")
      .toArray();
    expect(sourceRows).toHaveLength(2);
    expect(sourceRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({
            id: entry.id,
            revision: "updatedAt:101",
          }),
        }),
      ])
    );
    await expect(
      db.automationTransactions.get(`record_revision:journal:${entry.id}`)
    ).resolves.toBeUndefined();
  });
});
