import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntry } from "../types";

const mocks = vi.hoisted(() => ({
  getJournalContentVaultKey: vi.fn<() => string | null>(
    () => "isolated-fixture-vault-key",
  ),
  decryptJournalContentIfNeeded: vi.fn(async (content: string) => {
    if (content.startsWith("enc:unavailable:")) {
      throw new Error("Diary entry content is unavailable");
    }
    return content.replace(/^enc:readable:/, "");
  }),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/cloudSyncSettings", () => ({ isCloudSyncEnabled: () => false }));
vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
    info: vi.fn(),
    log: vi.fn(),
  },
}));
vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: () => Promise.resolve(null),
  getCurrentUserId: () => Promise.resolve(null),
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
vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    enqueue: vi.fn(() => Promise.resolve()),
    wakeFromDurableStorage: vi.fn(() => Promise.resolve()),
  },
  persistCriticalOfflineActionInCurrentTransaction: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/storage/deletionTracker", () => ({
  DELETION_TRACKER_KEYS: { journal: "zenflow-deleted-journal-entry-ids" },
  mergeDeletionTrackerIdsInCurrentTransaction: vi.fn(() => Promise.resolve(new Set())),
}));
vi.mock("@/storage/journalStorageService", () => ({
  JOURNAL_PHOTO_UPLOAD_MAX_BYTES: 1_048_576,
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
  validateSyncOwner: vi.fn(() => Promise.resolve()),
}));
vi.mock("../journalContentSession", () => ({
  getJournalContentVaultKey: mocks.getJournalContentVaultKey,
}));
vi.mock("../journalCrypto", () => ({
  encryptJournalContent: vi.fn(async (content: string) => `enc:readable:${content}`),
  decryptJournalContentIfNeeded: mocks.decryptJournalContentIfNeeded,
  isEncryptedJournalContent: (content: string) => content.startsWith("enc:"),
}));

import { db } from "@/storage/db";
import {
  getAllEntries,
  getEntriesByDate,
  getEntriesPage,
  getEntryById,
  getJournalExportSnapshot,
} from "../journalStorage";

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "fixture-entry",
    date: "2026-08-03",
    title: "Fixture title",
    content: "Readable fixture content",
    stickers: [],
    photoIds: [],
    audioIds: [],
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("journalStorage partial display reads", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.getJournalContentVaultKey.mockReturnValue("isolated-fixture-vault-key");
    db.close();
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it("returns nine readable entries and one privacy-safe unavailable count in raw order", async () => {
    const privateCiphertextMarker = "PRIVATE_CIPHERTEXT_MARKER_DO_NOT_SURFACE";
    const rows = Array.from({ length: 10 }, (_, index) =>
      makeEntry({
        id: `entry-${String(index).padStart(2, "0")}`,
        content:
          index === 4
            ? `enc:unavailable:${privateCiphertextMarker}`
            : `enc:readable:Readable fixture ${index}`,
        createdAt: 10 - index,
        updatedAt: 10 - index,
      }),
    );
    await db.journalEntries.bulkAdd(rows);

    const result = await getEntriesPage({ limit: 10 });

    expect(result).toMatchObject({
      totalCount: 10,
      requestedCount: 10,
      unavailableCount: 1,
      state: "degraded",
      hasMore: false,
      nextCursor: null,
    });
    expect(result.entries.map((entry) => entry.id)).toEqual(
      rows.filter((_, index) => index !== 4).map((entry) => entry.id),
    );
    expect(JSON.stringify(result)).not.toContain(privateCiphertextMarker);
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it("distinguishes all-unavailable rows from an authoritative empty journal", async () => {
    await db.journalEntries.bulkAdd([
      makeEntry({ id: "entry-b", content: "enc:unavailable:first", createdAt: 2 }),
      makeEntry({ id: "entry-a", content: "enc:unavailable:second", createdAt: 1 }),
    ]);

    const unavailable = await getEntriesPage({ limit: 10 });

    expect(unavailable).toMatchObject({
      entries: [],
      totalCount: 2,
      requestedCount: 2,
      unavailableCount: 2,
      state: "unavailable",
    });

    await db.journalEntries.clear();
    const empty = await getEntriesPage({ limit: 10 });

    expect(empty).toMatchObject({
      entries: [],
      totalCount: 0,
      requestedCount: 0,
      unavailableCount: 0,
      state: "empty",
    });
  });

  it("does not create a blank entry when an encrypted row has no active vault key", async () => {
    mocks.getJournalContentVaultKey.mockReturnValue(null);
    await db.journalEntries.add(
      makeEntry({ id: "locked-entry", content: "enc:readable:Must remain unavailable" }),
    );

    const result = await getEntriesPage({ limit: 10 });

    expect(result.entries).toEqual([]);
    expect(result).toMatchObject({
      totalCount: 1,
      requestedCount: 1,
      unavailableCount: 1,
      state: "unavailable",
    });
  });

  it("advances from an unavailable raw cursor boundary without duplicates or a loop", async () => {
    const createdAt = 2_000;
    await db.journalEntries.bulkAdd([
      makeEntry({ id: "entry-z", content: "enc:readable:Newest", createdAt }),
      makeEntry({ id: "entry-m", content: "enc:unavailable:boundary", createdAt }),
      makeEntry({ id: "entry-a", content: "enc:readable:Oldest tie", createdAt }),
    ]);

    const first = await getEntriesPage({ limit: 2 });
    expect(first.entries.map((entry) => entry.id)).toEqual(["entry-z"]);
    expect(first).toMatchObject({
      requestedCount: 2,
      unavailableCount: 1,
      state: "degraded",
      hasMore: true,
      nextCursor: { createdAt, id: "entry-m" },
    });

    const second = await getEntriesPage({ limit: 2, before: first.nextCursor });
    expect(second.entries.map((entry) => entry.id)).toEqual(["entry-a"]);
    expect(second).toMatchObject({
      requestedCount: 1,
      unavailableCount: 0,
      state: "ready",
      hasMore: false,
      nextCursor: null,
    });
  });

  it("settles date display reads without returning a blank substitute", async () => {
    await db.journalEntries.bulkAdd([
      makeEntry({ id: "date-readable", content: "enc:readable:Visible", createdAt: 2 }),
      makeEntry({ id: "date-unavailable", content: "enc:unavailable:hidden", createdAt: 1 }),
    ]);

    const result = await getEntriesByDate("2026-08-03");

    expect(result).toMatchObject({
      totalCount: 2,
      requestedCount: 2,
      unavailableCount: 1,
      state: "degraded",
      hasMore: false,
      nextCursor: null,
    });
    expect(result.entries.map((entry) => entry.id)).toEqual(["date-readable"]);
    expect(result.entries.every((entry) => entry.content.length > 0)).toBe(true);
  });

  it("keeps export and single-entry reads fail closed for an unreadable row", async () => {
    await db.journalEntries.bulkAdd([
      makeEntry({ id: "export-readable", content: "enc:readable:Visible", createdAt: 2 }),
      makeEntry({ id: "export-unavailable", content: "enc:unavailable:hidden", createdAt: 1 }),
    ]);

    await expect(getAllEntries()).rejects.toThrow(/unavailable/i);
    await expect(getJournalExportSnapshot()).rejects.toThrow(/unavailable/i);
    await expect(getEntryById("export-unavailable")).rejects.toThrow(/unavailable/i);
  });
});
