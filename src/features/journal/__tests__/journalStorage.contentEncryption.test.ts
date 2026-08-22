import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntry } from "../types";

const mocks = vi.hoisted(() => ({
  addEntry: vi.fn(() => Promise.resolve()),
  updateEntry: vi.fn(() => Promise.resolve(1)),
  getEntry: vi.fn<() => Promise<JournalEntry | undefined>>(() => Promise.resolve(undefined)),
  entriesToArray: vi.fn<() => Promise<JournalEntry[]>>(() => Promise.resolve([])),
  entriesFilter: vi.fn(),
  orderBy: vi.fn(),
  photoGet: vi.fn(() => Promise.resolve(undefined)),
  photoUpdate: vi.fn(() => Promise.resolve(1)),
  audioGet: vi.fn(() => Promise.resolve(undefined)),
  audioUpdate: vi.fn(() => Promise.resolve(1)),
  settingsGet: vi.fn<() => Promise<{ value: unknown } | undefined>>(() =>
    Promise.resolve(undefined)
  ),
  transaction: vi.fn((_mode: string, _tables: unknown, fn: () => unknown) => Promise.resolve(fn())),
  persistCriticalOfflineActionInCurrentTransaction: vi.fn(() => Promise.resolve()),
  syncJournalEntry: vi.fn(() => Promise.resolve()),
  triggerSync: vi.fn(),
  isCloudSyncEnabled: vi.fn(() => true),
  encryptJournalContent: vi.fn((content: string, key: string) =>
    Promise.resolve(`enc:${key}:${content}`)
  ),
  decryptJournalContentIfNeeded: vi.fn((content: string, key: string) =>
    Promise.resolve(
      content.startsWith(`enc:${key}:`) ? content.slice(`enc:${key}:`.length) : content
    )
  ),
  isEncryptedJournalContent: vi.fn((content: string) => content.startsWith("enc:")),
}));

vi.mock("@/storage/db", () => ({
  db: {
    journalEntries: {
      add: mocks.addEntry,
      update: mocks.updateEntry,
      get: mocks.getEntry,
      filter: mocks.entriesFilter,
      toArray: mocks.entriesToArray,
      orderBy: mocks.orderBy,
    },
    journalPhotos: {
      get: mocks.photoGet,
      update: mocks.photoUpdate,
    },
    journalAudio: {
      get: mocks.audioGet,
      update: mocks.audioUpdate,
    },
    settings: {
      get: mocks.settingsGet,
    },
    transaction: mocks.transaction,
  },
}));

vi.mock("@/storage/realtimeSync", () => ({
  syncJournalEntry: mocks.syncJournalEntry,
  deleteJournalEntryFromCloud: vi.fn(() => Promise.resolve()),
  syncJournalPhoto: vi.fn(() => Promise.resolve()),
  syncJournalAudio: vi.fn(() => Promise.resolve()),
  deleteJournalPhotoFromCloud: vi.fn(() => Promise.resolve()),
  deleteJournalAudioFromCloud: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/storage/cloudSync", () => ({ triggerSync: mocks.triggerSync }));
vi.mock("@/lib/cloudSyncSettings", () => ({ isCloudSyncEnabled: mocks.isCloudSyncEnabled }));
vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: vi.fn(() => Promise.resolve("user-1")),
  getCurrentUserId: vi.fn(() => Promise.resolve("user-1")),
}));
vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    enqueue: vi.fn(() => Promise.resolve()),
    wakeFromDurableStorage: vi.fn(() => Promise.resolve()),
  },
  persistCriticalOfflineActionInCurrentTransaction:
    mocks.persistCriticalOfflineActionInCurrentTransaction,
}));
vi.mock("@/storage/deletionTracker", () => ({
  trackDeletedJournalEntryId: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/features/automation/automationRepository", () => ({
  detachAutomationRecordRevisionInCurrentTransaction: vi.fn(() => Promise.resolve()),
  markAutomationSourceRescanRequiredInCurrentTransaction: vi.fn(() => Promise.resolve()),
  persistAutomationSourceIntentInCurrentTransaction: vi.fn(() =>
    Promise.resolve({ intentPersisted: false })
  ),
}));
vi.mock("@/storage/journalStorageService", () => ({
  uploadPhoto: vi.fn(() => Promise.resolve(null)),
  uploadAudio: vi.fn(() => Promise.resolve(null)),
  deletePhotoFromStorage: vi.fn(() => Promise.resolve()),
  deleteAudioFromStorage: vi.fn(() => Promise.resolve()),
  deleteEntryMediaFromStorage: vi.fn(() => Promise.resolve()),
  downloadAsBase64: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), log: vi.fn() },
}));
vi.mock("@/lib/utils", () => ({ generateId: vi.fn(() => "entry-id") }));
vi.mock("../journalCrypto", () => ({
  encryptJournalContent: mocks.encryptJournalContent,
  decryptJournalContentIfNeeded: mocks.decryptJournalContentIfNeeded,
  isEncryptedJournalContent: mocks.isEncryptedJournalContent,
  JournalContentCryptoError: class JournalContentCryptoError extends Error {},
}));

import { setJournalContentVaultKey } from "../journalContentSession";
import {
  decryptEncryptedJournalEntries,
  encryptPlaintextJournalEntries,
  getAllEntries,
  hasEncryptedJournalContent,
  saveEntry,
  updateEntry,
} from "../journalStorage";

const sessionKey = ["session", "key", "fixture"].join("-");

function baseEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "entry-id",
    date: "2026-06-18",
    title: "Private thought",
    content: "A quiet journal line",
    stickers: [],
    photoIds: [],
    tags: [],
    createdAt: 1_781_580_000_000,
    updatedAt: 1_781_580_000_000,
    ...overrides,
  };
}

describe("journalStorage content encryption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setJournalContentVaultKey(null);
    mocks.isCloudSyncEnabled.mockReturnValue(true);
    mocks.settingsGet.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation((_mode: string, _tables: unknown, fn: () => unknown) =>
      Promise.resolve(fn())
    );
    mocks.entriesFilter.mockImplementation((predicate: (entry: JournalEntry) => boolean) => ({
      first: vi.fn(() =>
        Promise.resolve(
          [
            baseEntry({ id: "plain-1", content: "Legacy line" }),
            baseEntry({ id: "enc-1", content: `enc:${sessionKey}:Already safe` }),
          ].find(predicate)
        )
      ),
    }));
  });

  it("stores and syncs encrypted content while returning plaintext to the UI", async () => {
    setJournalContentVaultKey(sessionKey, 2);
    mocks.settingsGet.mockResolvedValue({
      value: { wrappedKey: "persisted", createdAt: 1, updatedAt: 2 },
    });

    const result = await saveEntry({
      date: "2026-06-18",
      title: "Private thought",
      content: "A quiet journal line",
      stickers: [],
      photoIds: [],
      tags: [],
    });

    expect(result.content).toBe("A quiet journal line");
    expect(mocks.encryptJournalContent).toHaveBeenCalledWith("A quiet journal line", sessionKey);
    expect(mocks.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "entry-id",
        content: `enc:${sessionKey}:A quiet journal line`,
      })
    );
    expect(mocks.persistCriticalOfflineActionInCurrentTransaction).toHaveBeenCalledWith(
      "SYNC_JOURNAL_ENTRY",
      "entry-id",
      expect.objectContaining({
        id: "entry-id",
        content: `enc:${sessionKey}:A quiet journal line`,
      }),
      "user-1"
    );
  });

  it("rejects plaintext writes from a stale tab when diary protection is persisted", async () => {
    mocks.settingsGet.mockResolvedValue({
      value: { wrappedKey: "protected-in-another-tab", createdAt: 1, updatedAt: 2 },
    });

    await expect(
      saveEntry({
        date: "2026-06-18",
        title: "Private thought",
        content: "Must not be stored as plaintext",
        stickers: [],
        photoIds: [],
        tags: [],
      })
    ).rejects.toThrow(/unlock|locked|protected/i);

    expect(mocks.addEntry).not.toHaveBeenCalled();
    expect(mocks.syncJournalEntry).not.toHaveBeenCalled();
    expect(mocks.triggerSync).not.toHaveBeenCalled();
  });

  it("decrypts encrypted entries for read APIs when the session key is available", async () => {
    setJournalContentVaultKey(sessionKey, 2);
    const stored = baseEntry({ content: `enc:${sessionKey}:A quiet journal line` });
    const toArray = vi.fn(() => Promise.resolve([stored]));
    const reverse = vi.fn(() => ({ toArray }));
    mocks.orderBy.mockReturnValue({ reverse });

    const result = await getAllEntries();

    expect(result).toEqual([baseEntry()]);
    expect(mocks.decryptJournalContentIfNeeded).toHaveBeenCalledWith(stored.content, sessionKey);
  });

  it("redacts encrypted content instead of exposing ciphertext while the diary is locked", async () => {
    const stored = baseEntry({ content: `enc:${sessionKey}:A quiet journal line` });
    const toArray = vi.fn(() => Promise.resolve([stored]));
    const reverse = vi.fn(() => ({ toArray }));
    mocks.orderBy.mockReturnValue({ reverse });

    const result = await getAllEntries();

    expect(result).toEqual([baseEntry({ content: "" })]);
    expect(mocks.decryptJournalContentIfNeeded).not.toHaveBeenCalled();
  });

  it("encrypts content updates before storage and sync", async () => {
    setJournalContentVaultKey(sessionKey, 2);
    mocks.settingsGet.mockResolvedValue({
      value: { wrappedKey: "persisted", createdAt: 1, updatedAt: 2 },
    });
    mocks.getEntry.mockResolvedValue(
      baseEntry({
        content: `enc:${sessionKey}:Updated line`,
        updatedAt: 1_781_580_000_123,
      })
    );

    await updateEntry("entry-id", { content: "Updated line", title: "Updated" });
    await Promise.resolve();

    expect(mocks.updateEntry).toHaveBeenCalledWith(
      "entry-id",
      expect.objectContaining({
        title: "Updated",
        content: `enc:${sessionKey}:Updated line`,
      })
    );
    expect(mocks.persistCriticalOfflineActionInCurrentTransaction).toHaveBeenCalledWith(
      "SYNC_JOURNAL_ENTRY",
      "entry-id",
      expect.objectContaining({
        content: `enc:${sessionKey}:Updated line`,
      }),
      "user-1"
    );
  });

  it("migrates existing plaintext entries into encrypted stored rows", async () => {
    mocks.entriesToArray.mockResolvedValue([
      baseEntry({ id: "plain-1", content: "Legacy line" }),
      baseEntry({ id: "enc-1", content: `enc:${sessionKey}:Already safe` }),
    ]);

    const migrated = await encryptPlaintextJournalEntries(sessionKey);

    expect(migrated).toBe(1);
    expect(mocks.updateEntry).toHaveBeenCalledWith(
      "plain-1",
      expect.objectContaining({
        content: `enc:${sessionKey}:Legacy line`,
        updatedAt: expect.any(Number),
      })
    );
    expect(mocks.syncJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "plain-1",
        content: `enc:${sessionKey}:Legacy line`,
      }),
      "user-1"
    );
  });

  it("detects encrypted content without materializing every entry", async () => {
    await expect(hasEncryptedJournalContent()).resolves.toBe(true);

    expect(mocks.entriesFilter).toHaveBeenCalledTimes(1);
    expect(mocks.entriesToArray).not.toHaveBeenCalled();
  });

  it("decrypts encrypted stored rows before removing password protection", async () => {
    mocks.entriesToArray.mockResolvedValue([
      baseEntry({ id: "enc-1", content: `enc:${sessionKey}:Back to plaintext` }),
      baseEntry({ id: "plain-1", content: "Already plaintext" }),
    ]);

    const migrated = await decryptEncryptedJournalEntries(sessionKey);

    expect(migrated).toBe(1);
    expect(mocks.updateEntry).toHaveBeenCalledWith(
      "enc-1",
      expect.objectContaining({
        content: "Back to plaintext",
        updatedAt: expect.any(Number),
      })
    );
    expect(mocks.syncJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "enc-1",
        content: "Back to plaintext",
      }),
      "user-1"
    );
  });
});
