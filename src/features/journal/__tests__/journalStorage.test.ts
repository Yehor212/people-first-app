import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { SK } from "@/lib/storageKeys";

// ─── Mocks ────────────────────────────────────────────────────

vi.mock("@/storage/db", () => {
  const mockTable = () => ({
    add: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(undefined)),
    put: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
    update: vi.fn(() => Promise.resolve(1)),
    count: vi.fn(() => Promise.resolve(0)),
    toArray: vi.fn(() => Promise.resolve([])),
    bulkDelete: vi.fn(() => Promise.resolve()),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([])),
        count: vi.fn(() => Promise.resolve(0)),
        delete: vi.fn(() => Promise.resolve()),
        reverse: vi.fn(() => ({
          sortBy: vi.fn(() => Promise.resolve([])),
        })),
        sortBy: vi.fn(() => Promise.resolve([])),
      })),
      below: vi.fn(() => ({
        reverse: vi.fn(() => ({
          limit: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    })),
    orderBy: vi.fn(() => ({
      reverse: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([])),
      })),
    })),
  });
  return {
    db: {
      journalEntries: mockTable(),
      journalEntryLinks: mockTable(),
      journalPhotos: mockTable(),
      journalAudio: mockTable(),
      settings: mockTable(),
      offlineQueue: mockTable(),
      transaction: vi.fn((_mode: string, _tables: unknown[], fn: () => unknown) => fn()),
    },
  };
});

vi.mock("@/storage/realtimeSync", () => ({
  syncJournalEntry: vi.fn(() => Promise.resolve()),
  deleteJournalEntryFromCloud: vi.fn(() => Promise.resolve()),
  syncJournalPhoto: vi.fn(() => Promise.resolve()),
  syncJournalAudio: vi.fn(() => Promise.resolve()),
  deleteJournalPhotoFromCloud: vi.fn(() => Promise.resolve()),
  deleteJournalAudioFromCloud: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/storage/cloudSync", () => ({ triggerSync: vi.fn() }));

vi.mock("@/lib/cloudSyncSettings", () => ({
  isCloudSyncEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    enqueue: vi.fn(() => Promise.resolve()),
    wakeFromDurableStorage: vi.fn(() => Promise.resolve()),
  },
  persistCriticalOfflineActionInCurrentTransaction: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: vi.fn(() => Promise.resolve("user-1")),
  getCurrentUserId: vi.fn(() => Promise.resolve("user-1")),
}));

vi.mock("@/storage/deletionTracker", () => ({
  DELETION_TRACKER_KEYS: { journal: "zenflow-deleted-journal-entry-ids" },
  mergeDeletionTrackerIdsInCurrentTransaction: vi.fn(() => Promise.resolve(new Set())),
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
  JOURNAL_PHOTO_UPLOAD_MAX_BYTES: 1_048_576,
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

vi.mock("@/lib/utils", () => ({
  generateId: vi.fn(() => "test-id-123"),
}));

import { db } from "@/storage/db";
import {
  getAllEntries,
  getJournalExportSnapshot,
  getEntriesPage,
  getEntriesByDate,
  getEntryById,
  saveEntry,
  updateEntry,
  deleteEntry,
  getEntryCount,
  getPhotosForEntry,
  getPhotoById,
  getPhotoPreviewById,
  deletePhoto,
  storeAudio,
  getAudioForEntry,
  getAudioById,
  deleteAudio,
  deleteDraftMedia,
  commitDraftMediaToEntry,
  compressAndStorePhoto,
  clearDraftPhotoCancellation,
  getDraftMediaIds,
  markDraftPhotoCancellation,
} from "../journalStorage";
import {
  syncJournalEntry,
  deleteJournalEntryFromCloud,
  syncJournalAudio,
  deleteJournalPhotoFromCloud,
  deleteJournalAudioFromCloud,
} from "@/storage/realtimeSync";
import { triggerSync } from "@/storage/cloudSync";
import {
  offlineQueue,
  persistCriticalOfflineActionInCurrentTransaction,
} from "@/lib/offlineQueue";
import {
  uploadPhoto,
  uploadAudio,
  deleteAudioFromStorage,
  deleteEntryMediaFromStorage,
  downloadAsBase64,
} from "@/storage/journalStorageService";
import {
  DELETION_TRACKER_KEYS,
  mergeDeletionTrackerIdsInCurrentTransaction,
} from "@/storage/deletionTracker";
import { isCloudSyncEnabled } from "@/lib/cloudSyncSettings";
import { getCurrentSessionUserId } from "@/lib/supabaseClient";
import type { JournalEntry, JournalPhoto, JournalAudio } from "../types";

// ─── Helpers ──────────────────────────────────────────────────

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "entry-1",
    date: "2026-02-17",
    title: "Test Entry",
    content: "Test content",
    stickers: [],
    photoIds: [],
    tags: [],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makePhoto(overrides: Partial<JournalPhoto> = {}): JournalPhoto {
  return {
    id: "photo-1",
    entryId: "entry-1",
    data: "data:image/jpeg;base64,abc",
    thumbnail: "data:image/jpeg;base64,thumb",
    width: 800,
    height: 600,
    createdAt: 1000,
    ...overrides,
  };
}

function makeAudio(overrides: Partial<JournalAudio> = {}): JournalAudio {
  return {
    id: "audio-1",
    entryId: "entry-1",
    data: "data:audio/webm;base64,xyz",
    duration: 30,
    mimeType: "audio/webm",
    createdAt: 1000,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────

async function flushAsyncTurns(turns = 10): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isCloudSyncEnabled).mockReturnValue(true);
  vi.mocked(getCurrentSessionUserId).mockResolvedValue("user-1");
  vi.mocked(db.journalEntries.get).mockResolvedValue(undefined);
  vi.mocked(db.journalPhotos.get).mockResolvedValue(undefined);
  vi.mocked(db.journalAudio.get).mockResolvedValue(undefined);
  vi.mocked(db.settings.get).mockResolvedValue(undefined);
  vi.mocked(uploadPhoto).mockResolvedValue(null);
  vi.mocked(uploadAudio).mockResolvedValue(null);
});

// ============================================================
// getAllEntries
// ============================================================
describe("getEntriesPage", () => {
  it("loads one bounded page plus one sentinel row and returns the total count", async () => {
    const entries = [
      makeEntry({ id: "e-new", createdAt: 3000 }),
      makeEntry({ id: "e-mid", createdAt: 2000 }),
      makeEntry({ id: "e-sentinel", createdAt: 1000 }),
    ];
    const mockToArray = vi.fn(() => Promise.resolve(entries));
    const mockLimit = vi.fn(() => ({ toArray: mockToArray }));
    const mockReverse = vi.fn(() => ({ limit: mockLimit }));
    vi.mocked(db.journalEntries.orderBy).mockReturnValue({ reverse: mockReverse } as never);
    vi.mocked(db.journalEntries.count).mockResolvedValue(12);

    const result = await getEntriesPage({ limit: 2 });

    expect(db.journalEntries.orderBy).toHaveBeenCalledWith("createdAt");
    expect(mockLimit).toHaveBeenCalledWith(3);
    expect(result.entries.map((entry) => entry.id)).toEqual(["e-new", "e-mid"]);
    expect(result.totalCount).toBe(12);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual({ createdAt: 2000, id: "e-mid" });
  });

  it("uses a stable cursor for older journal pages", async () => {
    const sameTimestampEntries = [makeEntry({ id: "e-cursor", createdAt: 1000 })];
    const olderEntries = [makeEntry({ id: "e-old", createdAt: 900 })];
    const mockSameToArray = vi.fn(() => Promise.resolve(sameTimestampEntries));
    const mockOlderToArray = vi.fn(() => Promise.resolve(olderEntries));
    const mockOlderLimit = vi.fn(() => ({ toArray: mockOlderToArray }));
    const mockOlderReverse = vi.fn(() => ({ limit: mockOlderLimit }));
    const mockWhere = vi.fn((field: string) => {
      expect(field).toBe("createdAt");
      return {
        equals: vi.fn((createdAt: number) => ({
          toArray:
            createdAt === 1000 ? mockSameToArray : vi.fn(() => Promise.resolve(olderEntries)),
        })),
        below: vi.fn(() => ({ reverse: mockOlderReverse })),
      };
    });
    vi.mocked(db.journalEntries.where).mockImplementation(mockWhere as never);
    vi.mocked(db.journalEntries.count).mockResolvedValue(2);

    const result = await getEntriesPage({ limit: 2, before: { createdAt: 1000, id: "e-cursor" } });

    expect(mockOlderLimit).toHaveBeenCalledWith(3);
    expect(result.entries.map((entry) => entry.id)).toEqual(["e-old"]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("keeps same-millisecond entries after the cursor instead of skipping them", async () => {
    const sameTimestampEntries = [
      makeEntry({ id: "e-z-first", createdAt: 2000 }),
      makeEntry({ id: "e-m-cursor", createdAt: 2000 }),
      makeEntry({ id: "e-a-same-ms", createdAt: 2000 }),
    ];
    const olderEntries = [makeEntry({ id: "e-old", createdAt: 1000 })];
    const mockSameToArray = vi.fn(() => Promise.resolve(sameTimestampEntries));
    const mockOlderToArray = vi.fn(() => Promise.resolve(olderEntries));
    const mockOlderLimit = vi.fn(() => ({ toArray: mockOlderToArray }));
    const mockOlderReverse = vi.fn(() => ({ limit: mockOlderLimit }));
    const mockWhere = vi.fn((field: string) => {
      expect(field).toBe("createdAt");
      return {
        equals: vi.fn((createdAt: number) => ({
          toArray:
            createdAt === 2000 ? mockSameToArray : vi.fn(() => Promise.resolve(olderEntries)),
        })),
        below: vi.fn(() => ({ reverse: mockOlderReverse })),
      };
    });
    vi.mocked(db.journalEntries.where).mockImplementation(mockWhere as never);
    vi.mocked(db.journalEntries.count).mockResolvedValue(4);

    const result = await getEntriesPage({
      limit: 2,
      before: { createdAt: 2000, id: "e-m-cursor" },
    });

    expect(result.entries.map((entry) => entry.id)).toEqual(["e-a-same-ms", "e-old"]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("uses the same raw id ordering for mixed-case same-millisecond cursors", async () => {
    const sameTimestampEntries = [
      makeEntry({ id: "entry-z", createdAt: 2000 }),
      makeEntry({ id: "entry-Z", createdAt: 2000 }),
      makeEntry({ id: "entry-a", createdAt: 2000 }),
      makeEntry({ id: "entry-_", createdAt: 2000 }),
      makeEntry({ id: "entry--", createdAt: 2000 }),
    ];
    const mockSameToArray = vi.fn(() => Promise.resolve(sameTimestampEntries));
    const mockWhere = vi.fn((field: string) => {
      expect(field).toBe("createdAt");
      return {
        equals: vi.fn(() => ({ toArray: mockSameToArray })),
        below: vi.fn(() => ({
          reverse: vi.fn(() => ({
            limit: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
          })),
        })),
      };
    });
    vi.mocked(db.journalEntries.where).mockImplementation(mockWhere as never);
    vi.mocked(db.journalEntries.count).mockResolvedValue(5);

    const result = await getEntriesPage({ limit: 3, before: { createdAt: 2000, id: "entry-z" } });

    expect(result.entries.map((entry) => entry.id)).toEqual(["entry-a", "entry-_", "entry-Z"]);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual({ createdAt: 2000, id: "entry-Z" });
  });
});

// ============================================================
// getAllEntries
// ============================================================
describe("getAllEntries", () => {
  it("returns entries ordered by createdAt descending", async () => {
    const entries = [makeEntry({ id: "e1" }), makeEntry({ id: "e2" })];
    const mockReverse = vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve(entries)) }));
    vi.mocked(db.journalEntries.orderBy).mockReturnValue({ reverse: mockReverse } as never);

    const result = await getAllEntries();

    expect(db.journalEntries.orderBy).toHaveBeenCalledWith("createdAt");
    expect(mockReverse).toHaveBeenCalled();
    expect(result).toEqual(entries);
  });

  it("returns empty array when no entries exist", async () => {
    const mockReverse = vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) }));
    vi.mocked(db.journalEntries.orderBy).mockReturnValue({ reverse: mockReverse } as never);

    const result = await getAllEntries();
    expect(result).toEqual([]);
  });
});

describe("getJournalExportSnapshot", () => {
  it("reads one atomic snapshot and excludes media not referenced by its parent entry", async () => {
    const entry = makeEntry({
      photoIds: ["photo-1"],
      audioIds: ["audio-1"],
    });
    const photos = [
      makePhoto(),
      makePhoto({ id: "orphan-photo", entryId: "entry-1" }),
      makePhoto({ id: "wrong-parent-photo", entryId: "entry-2" }),
    ];
    const audio = [
      makeAudio(),
      makeAudio({ id: "orphan-audio", entryId: "entry-1" }),
      makeAudio({ id: "wrong-parent-audio", entryId: "entry-2" }),
    ];
    const deletedEntry = makeEntry({
      id: "deleted-entry",
      photoIds: ["deleted-photo"],
      audioIds: ["deleted-audio"],
    });
    const deletedPhoto = makePhoto({ id: "deleted-photo", entryId: "deleted-entry" });
    const deletedAudio = makeAudio({ id: "deleted-audio", entryId: "deleted-entry" });
    const entryToArray = vi.fn(() => Promise.resolve([entry, deletedEntry]));
    vi.mocked(db.journalEntries.orderBy).mockReturnValue({
      reverse: vi.fn(() => ({ toArray: entryToArray })),
    } as never);
    vi.mocked(db.journalPhotos.toArray).mockResolvedValue([...photos, deletedPhoto]);
    vi.mocked(db.journalAudio.toArray).mockResolvedValue([...audio, deletedAudio]);
    vi.mocked(db.settings.get).mockResolvedValueOnce({
      key: DELETION_TRACKER_KEYS.journal,
      value: ["deleted-entry", "deleted-entry", ""],
    });

    const result = await getJournalExportSnapshot();

    expect(db.transaction).toHaveBeenCalledWith(
      "r",
      [db.settings, db.journalEntries, db.journalPhotos, db.journalAudio],
      expect.any(Function),
    );
    expect(entryToArray).toHaveBeenCalledTimes(1);
    expect(db.journalPhotos.toArray).toHaveBeenCalledTimes(1);
    expect(db.journalAudio.toArray).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      entries: [entry],
      photos: [photos[0]],
      audio: [audio[0]],
      deletedEntryIds: ["deleted-entry"],
    });
  });
});

// ============================================================
// getEntriesByDate
// ============================================================
describe("getEntriesByDate", () => {
  it("queries journalEntries by date field", async () => {
    const entries = [makeEntry({ date: "2026-02-17" })];
    const mockSortBy = vi.fn(() => Promise.resolve(entries));
    const mockReverse = vi.fn(() => ({ sortBy: mockSortBy }));
    const mockEquals = vi.fn(() => ({ reverse: mockReverse, sortBy: mockSortBy }));
    const mockWhere = vi.fn(() => ({ equals: mockEquals }));
    vi.mocked(db.journalEntries.where).mockImplementation(mockWhere as any);

    const result = await getEntriesByDate("2026-02-17");

    expect(mockWhere).toHaveBeenCalledWith("date");
    expect(mockEquals).toHaveBeenCalledWith("2026-02-17");
    expect(result).toEqual({
      entries,
      totalCount: 1,
      requestedCount: 1,
      unavailableCount: 0,
      state: "ready",
      hasMore: false,
      nextCursor: null,
    });
  });
});

// ============================================================
// getEntryById
// ============================================================
describe("getEntryById", () => {
  it("returns entry by id from db.journalEntries.get", async () => {
    const entry = makeEntry();
    vi.mocked(db.journalEntries.get).mockResolvedValue(entry);

    const result = await getEntryById("entry-1");
    expect(db.journalEntries.get).toHaveBeenCalledWith("entry-1");
    expect(result).toEqual(entry);
  });

  it("returns undefined when entry not found", async () => {
    vi.mocked(db.journalEntries.get).mockResolvedValue(undefined);

    const result = await getEntryById("nonexistent");
    expect(result).toBeUndefined();
  });
});

// ============================================================
// saveEntry
// ============================================================
describe("saveEntry", () => {
  it("generates id and timestamps, adds to db", async () => {
    const input = {
      date: "2026-02-17",
      title: "New Entry",
      content: "Content here",
      stickers: [],
      photoIds: [],
      tags: ["test"],
    };

    const result = await saveEntry(input);

    expect(result.id).toBe("test-id-123");
    expect(result.createdAt).toBeGreaterThan(0);
    expect(result.updatedAt).toBe(result.createdAt);
    expect(result.title).toBe("New Entry");
    expect(db.journalEntries.add).toHaveBeenCalledWith(
      expect.objectContaining({ id: "test-id-123", title: "New Entry" })
    );
  });

  it("persists and wakes the durable sync outbox after saving", async () => {
    await saveEntry({
      date: "2026-02-17",
      title: "T",
      content: "C",
      stickers: [],
      photoIds: [],
      tags: [],
    });

    expect(persistCriticalOfflineActionInCurrentTransaction).toHaveBeenCalledWith(
      "SYNC_JOURNAL_ENTRY",
      "test-id-123",
      expect.objectContaining({ id: "test-id-123" }),
      "user-1"
    );
    expect(offlineQueue.wakeFromDurableStorage).toHaveBeenCalled();
    expect(triggerSync).toHaveBeenCalled();
  });

  it("preserves all input fields in the saved entry", async () => {
    const result = await saveEntry({
      date: "2026-01-01",
      title: "Title",
      content: "Body text",
      stickers: ["star"],
      photoIds: ["p1"],
      audioIds: ["a1"],
      tags: ["tag1", "tag2"],
      mood: "great",
    });

    expect(result.mood).toBe("great");
    expect(result.stickers).toEqual(["star"]);
    expect(result.tags).toEqual(["tag1", "tag2"]);
    expect(result.photoIds).toEqual(["p1"]);
    expect(result.audioIds).toEqual(["a1"]);
  });

  it("relinks draft media rows to the generated entry id", async () => {
    vi.mocked(db.journalPhotos.get).mockResolvedValue(
      makePhoto({ id: "photo-draft", entryId: "__draft__" })
    );
    vi.mocked(db.journalAudio.get).mockResolvedValue(
      makeAudio({ id: "audio-draft", entryId: "__draft__" })
    );

    await saveEntry({
      date: "2026-01-01",
      title: "Title",
      content: "Body text",
      stickers: [],
      photoIds: ["photo-draft"],
      audioIds: ["audio-draft"],
      tags: [],
    });

    expect(db.journalPhotos.update).toHaveBeenCalledWith(
      "photo-draft",
      expect.objectContaining({ entryId: "test-id-123" })
    );
    expect(db.journalAudio.update).toHaveBeenCalledWith(
      "audio-draft",
      expect.objectContaining({ entryId: "test-id-123" })
    );
  });

  it("queues relinked draft photo upload retry without storing base64 in the queue payload", async () => {
    vi.mocked(db.journalPhotos.get).mockResolvedValue(
      makePhoto({ id: "photo-draft", entryId: "__draft__" })
    );
    vi.mocked(uploadPhoto).mockResolvedValue(null);

    await saveEntry({
      date: "2026-01-01",
      title: "Title",
      content: "Body text",
      stickers: [],
      photoIds: ["photo-draft"],
      tags: [],
    });
    await flushAsyncTurns();

    expect(persistCriticalOfflineActionInCurrentTransaction).toHaveBeenCalledWith(
      "UPLOAD_JOURNAL_PHOTO_STORAGE",
      "journal-photo-upload:photo-draft",
      expect.objectContaining({
        id: "photo-draft",
        metadata: expect.objectContaining({ id: "photo-draft" }),
      }),
      "user-1"
    );
  });

  it("keeps newly saved entries local when cloud sync is disabled", async () => {
    vi.mocked(isCloudSyncEnabled).mockReturnValue(false);

    await saveEntry({
      date: "2026-02-17",
      title: "Private local note",
      content: "Only on this device",
      stickers: [],
      photoIds: [],
      tags: [],
    });

    expect(syncJournalEntry).not.toHaveBeenCalled();
    expect(offlineQueue.enqueue).not.toHaveBeenCalled();
    expect(persistCriticalOfflineActionInCurrentTransaction).not.toHaveBeenCalled();
    expect(triggerSync).not.toHaveBeenCalled();
  });
});

// ============================================================
// commitDraftMediaToEntry
// ============================================================
describe("commitDraftMediaToEntry", () => {
  it("relinks media from an entry-scoped draft owner", async () => {
    vi.mocked(db.journalPhotos.get).mockResolvedValue(
      makePhoto({ id: "photo-scoped", entryId: "__draft__:entry-existing" })
    );
    vi.mocked(db.journalAudio.get).mockResolvedValue(
      makeAudio({ id: "audio-scoped", entryId: "__draft__:entry-existing" })
    );

    await commitDraftMediaToEntry("entry-existing", {
      photoIds: ["photo-scoped"],
      audioIds: ["audio-scoped"],
    });

    expect(db.journalPhotos.update).toHaveBeenCalledWith(
      "photo-scoped",
      expect.objectContaining({ entryId: "entry-existing" })
    );
    expect(db.journalAudio.update).toHaveBeenCalledWith(
      "audio-scoped",
      expect.objectContaining({ entryId: "entry-existing" })
    );
  });

  it("relinks selected draft media rows to an existing entry id", async () => {
    vi.mocked(db.journalPhotos.get).mockResolvedValue(
      makePhoto({ id: "photo-draft", entryId: "__draft__" })
    );
    vi.mocked(db.journalAudio.get).mockResolvedValue(
      makeAudio({ id: "audio-draft", entryId: "__draft__" })
    );

    await commitDraftMediaToEntry("entry-existing", {
      photoIds: ["photo-draft"],
      audioIds: ["audio-draft"],
    }, "__draft__");

    expect(db.journalPhotos.update).toHaveBeenCalledWith(
      "photo-draft",
      expect.objectContaining({ entryId: "entry-existing" })
    );
    expect(db.journalAudio.update).toHaveBeenCalledWith(
      "audio-draft",
      expect.objectContaining({ entryId: "entry-existing" })
    );
  });

  it("does not commit media back onto the reserved draft entry id", async () => {
    await commitDraftMediaToEntry("__draft__", {
      photoIds: ["photo-draft"],
      audioIds: ["audio-draft"],
    });

    expect(db.journalPhotos.get).not.toHaveBeenCalled();
    expect(db.journalAudio.get).not.toHaveBeenCalled();
  });
});

// ============================================================
// updateEntry
// ============================================================
describe("updateEntry", () => {
  it("calls db.update with merged changes and new updatedAt", async () => {
    vi.mocked(db.journalEntries.get).mockResolvedValue(makeEntry());

    await updateEntry("entry-1", { title: "Updated" });

    expect(db.journalEntries.update).toHaveBeenCalledWith(
      "entry-1",
      expect.objectContaining({ title: "Updated" })
    );
    // updatedAt should be a timestamp
    const callArgs = vi.mocked(db.journalEntries.update).mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(callArgs.updatedAt).toBeGreaterThan(0);
  });

  it("triggers triggerSync after update", async () => {
    vi.mocked(db.journalEntries.get).mockResolvedValue(makeEntry());

    await updateEntry("entry-1", { content: "New content" });

    expect(triggerSync).toHaveBeenCalled();
  });

  it("updates only local IndexedDB when cloud sync is disabled", async () => {
    vi.mocked(isCloudSyncEnabled).mockReturnValue(false);
    vi.mocked(db.journalEntries.get).mockResolvedValue(makeEntry());

    await updateEntry("entry-1", { content: "Still local" });
    await flushAsyncTurns();

    expect(db.journalEntries.update).toHaveBeenCalledWith(
      "entry-1",
      expect.objectContaining({ content: "Still local" })
    );
    expect(syncJournalEntry).not.toHaveBeenCalled();
    expect(triggerSync).not.toHaveBeenCalled();
  });
});

// ============================================================
// deleteEntry
// ============================================================
describe("deleteEntry", () => {
  it("deletes entry, photos, and audio from db in a transaction", async () => {
    const photos = [makePhoto({ id: "p1" }), makePhoto({ id: "p2" })];
    const audios = [makeAudio({ id: "a1" })];

    const mockPhotosEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve(photos)),
      count: vi.fn(() => Promise.resolve(2)),
    }));
    vi.mocked(db.journalPhotos.where).mockReturnValue({ equals: mockPhotosEquals } as never);

    const mockAudioEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve(audios)),
      count: vi.fn(() => Promise.resolve(1)),
    }));
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockAudioEquals } as never);

    await deleteEntry("entry-1");

    expect(db.transaction).toHaveBeenCalled();
    expect(db.journalPhotos.bulkDelete).toHaveBeenCalledWith(["p1", "p2"]);
    expect(db.journalAudio.bulkDelete).toHaveBeenCalledWith(["a1"]);
    expect(db.journalEntryLinks.where).toHaveBeenCalledWith("entryId");
    expect(db.journalEntries.delete).toHaveBeenCalledWith("entry-1");
  });

  it("persists and wakes a durable cloud deletion", async () => {
    const mockEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve([])),
      count: vi.fn(() => Promise.resolve(0)),
    }));
    vi.mocked(db.journalPhotos.where).mockReturnValue({ equals: mockEquals } as never);
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);

    await deleteEntry("entry-1");

    expect(persistCriticalOfflineActionInCurrentTransaction).toHaveBeenCalledWith(
      "DELETE_JOURNAL_ENTRY",
      "entry-1",
      { id: "entry-1" },
      "user-1"
    );
    expect(offlineQueue.wakeFromDurableStorage).toHaveBeenCalled();
    expect(deleteEntryMediaFromStorage).not.toHaveBeenCalled();
    expect(deleteJournalEntryFromCloud).not.toHaveBeenCalled();
    expect(triggerSync).toHaveBeenCalled();
  });

  it("merges the tombstone inside the delete transaction before deleting rows", async () => {
    const mockEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve([])),
      count: vi.fn(() => Promise.resolve(0)),
    }));
    vi.mocked(db.journalPhotos.where).mockReturnValue({ equals: mockEquals } as never);
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);

    let resolveTombstone!: (value: Set<string>) => void;
    vi.mocked(mergeDeletionTrackerIdsInCurrentTransaction).mockImplementationOnce(
      () =>
        new Promise<Set<string>>((resolve) => {
          resolveTombstone = resolve;
        })
    );

    const deletion = deleteEntry("entry-1");
    await vi.waitFor(() => {
      expect(mergeDeletionTrackerIdsInCurrentTransaction).toHaveBeenCalledWith(
        DELETION_TRACKER_KEYS.journal,
        ["entry-1"]
      );
    });

    expect(db.transaction).toHaveBeenCalledWith(
      "rw",
      expect.arrayContaining([db.settings, db.journalEntries]),
      expect.any(Function)
    );
    expect(db.journalEntries.delete).not.toHaveBeenCalled();

    resolveTombstone(new Set(["entry-1"]));
    await deletion;

    expect(db.transaction).toHaveBeenCalled();
    expect(db.journalEntries.delete).toHaveBeenCalledWith("entry-1");
  });

  it("waits for the local tombstone before cloud delete and sync", async () => {
    const mockEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve([])),
      count: vi.fn(() => Promise.resolve(0)),
    }));
    vi.mocked(db.journalPhotos.where).mockReturnValue({ equals: mockEquals } as never);
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);

    let resolveTombstone!: (value: Set<string>) => void;
    vi.mocked(mergeDeletionTrackerIdsInCurrentTransaction).mockImplementationOnce(
      () =>
        new Promise<Set<string>>((resolve) => {
          resolveTombstone = resolve;
        })
    );

    const deletion = deleteEntry("entry-1");
    await vi.waitFor(() => {
      expect(mergeDeletionTrackerIdsInCurrentTransaction).toHaveBeenCalledWith(
        DELETION_TRACKER_KEYS.journal,
        ["entry-1"]
      );
    });

    expect(offlineQueue.wakeFromDurableStorage).not.toHaveBeenCalled();
    expect(triggerSync).not.toHaveBeenCalled();

    resolveTombstone(new Set(["entry-1"]));
    await deletion;

    expect(persistCriticalOfflineActionInCurrentTransaction).toHaveBeenCalledWith(
      "DELETE_JOURNAL_ENTRY",
      "entry-1",
      { id: "entry-1" },
      "user-1"
    );
    expect(offlineQueue.wakeFromDurableStorage).toHaveBeenCalled();
    expect(triggerSync).toHaveBeenCalled();
  });

  it("skips bulkDelete when entry has no photos or audio", async () => {
    const mockEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve([])),
      count: vi.fn(() => Promise.resolve(0)),
    }));
    vi.mocked(db.journalPhotos.where).mockReturnValue({ equals: mockEquals } as never);
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);

    await deleteEntry("entry-1");

    expect(db.journalPhotos.bulkDelete).not.toHaveBeenCalled();
    expect(db.journalAudio.bulkDelete).not.toHaveBeenCalled();
    expect(db.journalEntries.delete).toHaveBeenCalledWith("entry-1");
  });

  it("does not enqueue or call cloud deletes when cloud sync is disabled", async () => {
    vi.mocked(isCloudSyncEnabled).mockReturnValue(false);
    vi.mocked(db.journalPhotos.where).mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([makePhoto({ id: "p-local" })])),
      })),
    } as never);
    vi.mocked(db.journalAudio.where).mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([makeAudio({ id: "a-local" })])),
      })),
    } as never);

    await deleteEntry("entry-1");

    expect(mergeDeletionTrackerIdsInCurrentTransaction).toHaveBeenCalledWith(
      DELETION_TRACKER_KEYS.journal,
      ["entry-1"]
    );
    expect(db.journalEntries.delete).toHaveBeenCalledWith("entry-1");
    expect(offlineQueue.enqueue).not.toHaveBeenCalled();
    expect(deleteEntryMediaFromStorage).not.toHaveBeenCalled();
    expect(deleteJournalEntryFromCloud).not.toHaveBeenCalled();
    expect(triggerSync).not.toHaveBeenCalled();
  });
});

// ============================================================
// getEntryCount
// ============================================================
describe("getEntryCount", () => {
  it("returns count from db.journalEntries.count()", async () => {
    vi.mocked(db.journalEntries.count).mockResolvedValue(42);

    const result = await getEntryCount();
    expect(result).toBe(42);
  });

  it("returns 0 when no entries", async () => {
    vi.mocked(db.journalEntries.count).mockResolvedValue(0);

    const result = await getEntryCount();
    expect(result).toBe(0);
  });
});

// ============================================================
// getPhotosForEntry
// ============================================================
describe("getPhotosForEntry", () => {
  it("queries photos by entryId", async () => {
    const photos = [makePhoto()];
    const mockEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve(photos)),
    }));
    vi.mocked(db.journalPhotos.where).mockReturnValue({ equals: mockEquals } as never);

    const result = await getPhotosForEntry("entry-1");

    expect(db.journalPhotos.where).toHaveBeenCalledWith("entryId");
    expect(mockEquals).toHaveBeenCalledWith("entry-1");
    expect(result).toEqual(photos);
  });

  it("downloads and caches synced photo data when local data is empty", async () => {
    const remotePhoto = makePhoto({
      id: "photo-cloud",
      data: "",
      thumbnail: "",
      storagePath: "user-1/photo-cloud.jpg",
    });
    const mockEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve([remotePhoto])),
    }));
    vi.mocked(db.journalPhotos.where).mockReturnValue({ equals: mockEquals } as never);
    vi.mocked(downloadAsBase64).mockResolvedValue("data:image/jpeg;base64,cloud");

    const result = await getPhotosForEntry("entry-1");

    expect(downloadAsBase64).toHaveBeenCalledWith(
      "journal-photos",
      "user-1/photo-cloud.jpg",
      "user-1"
    );
    expect(db.journalPhotos.update).toHaveBeenCalledWith("photo-cloud", {
      data: "data:image/jpeg;base64,cloud",
    });
    expect(result[0]).toEqual(
      expect.objectContaining({
        data: "data:image/jpeg;base64,cloud",
        thumbnail: "data:image/jpeg;base64,cloud",
      })
    );
  });
});

// ============================================================
// getPhotoById
// ============================================================
describe("getPhotoById", () => {
  it("returns photo from db.journalPhotos.get", async () => {
    const photo = makePhoto();
    vi.mocked(db.journalPhotos.get).mockResolvedValue(photo);

    const result = await getPhotoById("photo-1", "entry-1");
    expect(db.journalPhotos.get).toHaveBeenCalledWith("photo-1");
    expect(result).toEqual(photo);
  });

  it("returns thumbnail-only data for gallery previews", async () => {
    const photo = makePhoto({
      data: "data:image/jpeg;base64,full-resolution",
      thumbnail: "data:image/jpeg;base64,thumbnail",
    });
    vi.mocked(db.journalPhotos.get).mockResolvedValue(photo);

    const result = await getPhotoPreviewById("photo-1", "entry-1");

    expect(result).toEqual({
      ...photo,
      data: "",
      thumbnail: "data:image/jpeg;base64,thumbnail",
    });
    expect(downloadAsBase64).not.toHaveBeenCalled();
  });

  it("does not return full or preview bytes through another entry association", async () => {
    const photo = makePhoto({ entryId: "entry-a" });
    vi.mocked(db.journalPhotos.get).mockResolvedValue(photo);

    await expect(getPhotoById("photo-1", "entry-b")).resolves.toBeUndefined();
    await expect(getPhotoPreviewById("photo-1", "entry-b")).resolves.toBeUndefined();

    expect(downloadAsBase64).not.toHaveBeenCalled();
  });

  it("rejects metadata-only cloud photos when download returns no bytes", async () => {
    const photo = makePhoto({
      data: "",
      thumbnail: "",
      storagePath: "user-1/photo-1.jpg",
    });
    vi.mocked(db.journalPhotos.get).mockResolvedValue(photo);
    vi.mocked(downloadAsBase64).mockResolvedValue(null);

    await expect(getPhotoById("photo-1", "entry-1")).rejects.toMatchObject({
      name: "JournalPhotoHydrationError",
      code: "JOURNAL_PHOTO_DOWNLOAD_UNAVAILABLE",
    });
  });

  it("displays downloaded photo bytes when only the local cache write exceeds quota", async () => {
    const photo = makePhoto({
      data: "",
      thumbnail: "",
      storagePath: "user-1/photo-1.jpg",
    });
    vi.mocked(db.journalPhotos.get).mockResolvedValue(photo);
    vi.mocked(downloadAsBase64).mockResolvedValue("data:image/jpeg;base64,cloud-photo");
    vi.mocked(db.journalPhotos.update).mockRejectedValueOnce(
      new DOMException("Storage quota reached", "QuotaExceededError"),
    );

    await expect(getPhotoById("photo-1", "entry-1")).resolves.toMatchObject({
      id: "photo-1",
      data: "data:image/jpeg;base64,cloud-photo",
      thumbnail: "data:image/jpeg;base64,cloud-photo",
    });
    expect(db.journalPhotos.update).toHaveBeenCalled();
  });
});

// ============================================================
// deletePhoto
// ============================================================
describe("deletePhoto", () => {
  beforeEach(() => {
    vi.mocked(db.journalPhotos.get).mockResolvedValue(makePhoto());
  });

  it("stops before outbox creation when the photo belongs to another entry", async () => {
    vi.mocked(db.journalPhotos.get).mockResolvedValue(
      makePhoto({ id: "photo-owned-by-a", entryId: "entry-a" }),
    );
    vi.mocked(db.journalEntries.get).mockResolvedValue(
      makeEntry({ id: "entry-b", photoIds: ["photo-owned-by-a"] }),
    );

    await expect(deletePhoto("photo-owned-by-a", "entry-b")).rejects.toThrow(
      /does not belong to the requested entry/i,
    );

    expect(persistCriticalOfflineActionInCurrentTransaction).not.toHaveBeenCalled();
    expect(db.journalPhotos.delete).not.toHaveBeenCalled();
    expect(db.journalEntries.update).not.toHaveBeenCalled();
    expect(deleteJournalPhotoFromCloud).not.toHaveBeenCalled();
  });

  it("removes photo from db and updates entry photoIds", async () => {
    const entry = makeEntry({
      photoIds: ["photo-1", "photo-2"],
      photoLayout: {
        "photo-1": { x: 20, y: 30, width: 180 },
        "photo-2": { x: 60, y: 70, width: 220 },
      },
    });
    vi.mocked(db.journalEntries.get).mockResolvedValue(entry);

    await deletePhoto("photo-1", "entry-1");

    expect(db.journalPhotos.delete).toHaveBeenCalledWith("photo-1");
    expect(db.journalEntries.get).toHaveBeenCalledWith("entry-1");
    expect(db.journalEntries.update).toHaveBeenCalledWith(
      "entry-1",
      expect.objectContaining({
        photoIds: ["photo-2"],
        photoLayout: { "photo-2": { x: 60, y: 70, width: 220 } },
      })
    );
  });

  it("triggers cloud photo deletion", async () => {
    vi.mocked(db.journalEntries.get).mockResolvedValue(undefined);

    await deletePhoto("photo-1", "entry-1");

    expect(deleteJournalPhotoFromCloud).toHaveBeenCalledWith("photo-1", "user-1");
  });

  it("keeps photo deletion local when cloud sync is disabled", async () => {
    vi.mocked(isCloudSyncEnabled).mockReturnValue(false);
    vi.mocked(db.journalEntries.get).mockResolvedValue(undefined);

    await deletePhoto("photo-1", "entry-1");

    expect(db.journalPhotos.delete).toHaveBeenCalledWith("photo-1");
    expect(offlineQueue.enqueue).not.toHaveBeenCalled();
    expect(deleteJournalPhotoFromCloud).not.toHaveBeenCalled();
  });

  it("stops before local deletion when the captured and active account owners differ", async () => {
    let activeOwner = "user-a";
    vi.mocked(getCurrentSessionUserId).mockImplementation(async () => activeOwner);
    activeOwner = "user-b";
    vi.mocked(db.journalEntries.get).mockResolvedValue(undefined);

    await expect(deletePhoto("photo-owned-by-a", "entry-owned-by-a")).rejects.toThrow(
      /account boundary/i,
    );

    expect(db.journalPhotos.delete).not.toHaveBeenCalled();
  });

  it("does not update entry when entry not found", async () => {
    vi.mocked(db.journalEntries.get).mockResolvedValue(undefined);

    await deletePhoto("photo-1", "entry-1");

    expect(db.journalEntries.update).not.toHaveBeenCalled();
  });
});

// ============================================================
// storeAudio
// ============================================================
describe("storeAudio", () => {
  it("creates audio record and stores in db", async () => {
    vi.mocked(isCloudSyncEnabled).mockReturnValue(false);
    const mockCount = vi.fn(() => Promise.resolve(0));
    const mockEquals = vi.fn(() => ({
      count: mockCount,
      toArray: vi.fn(() => Promise.resolve([])),
    }));
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);

    const result = await storeAudio(
      "entry-1",
      "data:audio/webm;base64,YXVkaW8=",
      30,
      "audio/webm",
    );

    expect(result.id).toBe("test-id-123");
    expect(result.entryId).toBe("entry-1");
    expect(result.data).toBe("data:audio/webm;base64,YXVkaW8=");
    expect(result.duration).toBe(30);
    expect(result.mimeType).toBe("audio/webm");
    expect(result.createdAt).toBeGreaterThan(0);
    expect(db.journalAudio.add).toHaveBeenCalled();
  });

  it("throws when MAX_AUDIO_PER_ENTRY is reached", async () => {
    const mockCount = vi.fn(() => Promise.resolve(3));
    const mockEquals = vi.fn(() => ({
      count: mockCount,
      toArray: vi.fn(() => Promise.resolve([])),
    }));
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);

    await expect(
      storeAudio("entry-1", "data:audio/webm;base64,YXVkaW8=", 10, "audio/webm"),
    ).rejects.toThrow(
      "Maximum 3 audio recordings per entry"
    );
  });

  it("triggers cloud sync for audio metadata", async () => {
    const mockCount = vi.fn(() => Promise.resolve(0));
    const mockEquals = vi.fn(() => ({
      count: mockCount,
      toArray: vi.fn(() => Promise.resolve([])),
    }));
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);
    vi.mocked(db.journalAudio.get).mockResolvedValue(
      makeAudio({
        id: "test-id-123",
        entryId: "entry-1",
        data: "data:audio/mp4;base64,YXVkaW8=",
        mimeType: "audio/mp4",
      })
    );

    await storeAudio("entry-1", "data:audio/mp4;base64,YXVkaW8=", 15, "audio/mp4");
    await vi.waitFor(() => {
      expect(syncJournalAudio).toHaveBeenCalledWith(
        expect.objectContaining({ id: "test-id-123", entryId: "entry-1" }),
        "user-1"
      );
    });

  });

  it("keeps newly recorded entry audio local when cloud sync is disabled", async () => {
    vi.mocked(isCloudSyncEnabled).mockReturnValue(false);
    const mockCount = vi.fn(() => Promise.resolve(0));
    const mockEquals = vi.fn(() => ({
      count: mockCount,
      toArray: vi.fn(() => Promise.resolve([])),
    }));
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);

    await storeAudio("entry-1", "data:audio/webm;base64,abc", 15, "audio/webm");

    expect(db.journalAudio.add).toHaveBeenCalled();
    expect(uploadAudio).not.toHaveBeenCalled();
    expect(syncJournalAudio).not.toHaveBeenCalled();
    expect(offlineQueue.enqueue).not.toHaveBeenCalled();
  });

  it("queues audio upload retry without storing the recording payload in the queue", async () => {
    const mockCount = vi.fn(() => Promise.resolve(0));
    const mockEquals = vi.fn(() => ({
      count: mockCount,
      toArray: vi.fn(() => Promise.resolve([])),
    }));
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);
    vi.mocked(uploadAudio).mockResolvedValue(null);

    await storeAudio("entry-1", "data:audio/webm;base64,abc", 15, "audio/webm");
    await vi.waitFor(() => {
      expect(offlineQueue.enqueue).toHaveBeenCalledWith(
        "UPLOAD_JOURNAL_AUDIO_STORAGE",
        "journal-audio-upload:test-id-123",
        { id: "test-id-123" },
        expect.objectContaining({ expectedOwnerUserId: "user-1", priority: "critical" })
      );
    });

  });

  it("keeps draft audio local until the entry is saved", async () => {
    const mockCount = vi.fn(() => Promise.resolve(0));
    const mockEquals = vi.fn(() => ({
      count: mockCount,
      toArray: vi.fn(() => Promise.resolve([])),
    }));
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);

    await storeAudio("__draft__", "data:audio/webm;base64,abc", 15, "audio/webm");

    expect(uploadAudio).not.toHaveBeenCalled();
    expect(syncJournalAudio).not.toHaveBeenCalled();
  });
});

// ============================================================
// Draft media privacy
// ============================================================
describe("draft media privacy", () => {
  const prepareProcessablePhoto = () => {
    vi.mocked(db.journalPhotos.where).mockReturnValue({
      equals: vi.fn(() => ({ count: vi.fn(() => Promise.resolve(0)) })),
    } as never);
    const pngHeader = new Uint8Array(24);
    pngHeader.set([0x89, 0x50, 0x4e, 0x47], 0);
    new DataView(pngHeader.buffer).setUint32(16, 1200);
    new DataView(pngHeader.buffer).setUint32(20, 630);
    const file = new File([pngHeader], "memory.png", { type: "image/png" });
    vi.spyOn(file, "slice").mockReturnValue({
      arrayBuffer: () => Promise.resolve(pngHeader.buffer),
    } as Blob);
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => Promise.resolve({ width: 1200, height: 630, close })),
    );
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:journal-photo"),
      revokeObjectURL: vi.fn(),
    });
    const context = {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      drawImage: vi.fn(),
    };
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(context as never);
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((callback) => callback(new Blob(["jpeg"], { type: "image/jpeg" })));
    return {
      file,
      restore: () => {
        getContext.mockRestore();
        toBlob.mockRestore();
        vi.unstubAllGlobals();
      },
    };
  };

  it("quarantines a processed draft photo in the same transaction that stores it", async () => {
    const scopedOwner = "__draft__:entry-one";
    const { file, restore } = prepareProcessablePhoto();

    try {
      await compressAndStorePhoto(file, scopedOwner);
    } finally {
      restore();
    }

    expect(db.transaction).toHaveBeenCalledWith(
      "rw",
      [db.journalPhotos, db.settings],
      expect.any(Function),
    );
    expect(db.settings.put).toHaveBeenCalledWith({
      key: SK.JOURNAL_CANCELLED_DRAFT_PHOTOS,
      value: { [scopedOwner]: ["test-id-123"] },
    });
    expect(vi.mocked(db.settings.put).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(db.journalPhotos.add).mock.invocationCallOrder[0],
    );
  });

  it("does not store a draft photo when its quarantine marker cannot be committed", async () => {
    const scopedOwner = "__draft__:entry-one";
    const { file, restore } = prepareProcessablePhoto();
    vi.mocked(db.settings.put).mockRejectedValueOnce(new Error("settings write unavailable"));

    try {
      await expect(compressAndStorePhoto(file, scopedOwner)).rejects.toThrow(
        "settings write unavailable",
      );
    } finally {
      restore();
    }

    expect(db.journalPhotos.add).not.toHaveBeenCalled();
  });

  it("lists only media owned by the requested scoped draft", async () => {
    const photoToArray = vi.fn(() =>
      Promise.resolve([makePhoto({ id: "photo-recover", entryId: "__draft__:entry-one" })]),
    );
    const audioToArray = vi.fn(() =>
      Promise.resolve([makeAudio({ id: "audio-recover", entryId: "__draft__:entry-one" })]),
    );
    const photoEquals = vi.fn(() => ({ toArray: photoToArray }));
    const audioEquals = vi.fn(() => ({ toArray: audioToArray }));
    vi.mocked(db.journalPhotos.where).mockReturnValue({ equals: photoEquals } as never);
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: audioEquals } as never);

    const { getDraftMediaIds } = await import("../journalStorage");
    await expect(getDraftMediaIds("__draft__:entry-one")).resolves.toEqual({
      photoIds: ["photo-recover"],
      audioIds: ["audio-recover"],
    });
    expect(photoEquals).toHaveBeenCalledWith("__draft__:entry-one");
    expect(audioEquals).toHaveBeenCalledWith("__draft__:entry-one");
  });

  it("persists cancelled draft photos until deletion succeeds", async () => {
    const scopedOwner = "__draft__:entry-one";

    await markDraftPhotoCancellation("photo-cancelled", scopedOwner);

    expect(db.settings.put).toHaveBeenCalledWith({
      key: SK.JOURNAL_CANCELLED_DRAFT_PHOTOS,
      value: { [scopedOwner]: ["photo-cancelled"] },
    });

    vi.mocked(db.settings.get).mockResolvedValue({
      key: SK.JOURNAL_CANCELLED_DRAFT_PHOTOS,
      value: { [scopedOwner]: ["photo-cancelled"] },
    });
    await clearDraftPhotoCancellation("photo-cancelled", scopedOwner);

    expect(db.settings.delete).toHaveBeenCalledWith(SK.JOURNAL_CANCELLED_DRAFT_PHOTOS);
  });

  it("never recovers cancelled photos and retries their local deletion", async () => {
    const scopedOwner = "__draft__:entry-one";
    const photoToArray = vi.fn(() =>
      Promise.resolve([
        makePhoto({ id: "photo-accepted", entryId: scopedOwner, createdAt: 1 }),
        makePhoto({ id: "photo-cancelled", entryId: scopedOwner, createdAt: 2 }),
      ]),
    );
    const audioToArray = vi.fn(() => Promise.resolve([]));
    vi.mocked(db.journalPhotos.where).mockReturnValue({
      equals: vi.fn(() => ({ toArray: photoToArray })),
    } as never);
    vi.mocked(db.journalAudio.where).mockReturnValue({
      equals: vi.fn(() => ({ toArray: audioToArray })),
    } as never);
    vi.mocked(db.settings.get).mockResolvedValue({
      key: SK.JOURNAL_CANCELLED_DRAFT_PHOTOS,
      value: { [scopedOwner]: ["photo-cancelled"] },
    });

    await expect(getDraftMediaIds(scopedOwner)).resolves.toEqual({
      photoIds: ["photo-accepted"],
      audioIds: [],
    });
    expect(db.journalPhotos.bulkDelete).toHaveBeenCalledWith(["photo-cancelled"]);
    expect(db.settings.delete).toHaveBeenCalledWith(SK.JOURNAL_CANCELLED_DRAFT_PHOTOS);
  });

  it("does not delete media from another owner when a cancellation marker is corrupted", async () => {
    const scopedOwner = "__draft__:entry-one";
    vi.mocked(db.journalPhotos.where).mockReturnValue({
      equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
    } as never);
    vi.mocked(db.journalAudio.where).mockReturnValue({
      equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
    } as never);
    vi.mocked(db.journalPhotos.get).mockResolvedValue(
      makePhoto({ id: "photo-other-owner", entryId: "entry-other" }),
    );
    vi.mocked(db.settings.get).mockResolvedValue({
      key: SK.JOURNAL_CANCELLED_DRAFT_PHOTOS,
      value: { [scopedOwner]: ["photo-other-owner"] },
    });

    await expect(getDraftMediaIds(scopedOwner)).resolves.toEqual({
      photoIds: [],
      audioIds: [],
    });
    expect(db.journalPhotos.bulkDelete).not.toHaveBeenCalled();
    expect(db.settings.delete).toHaveBeenCalledWith(SK.JOURNAL_CANCELLED_DRAFT_PHOTOS);
  });

  it("deletes only the requested scoped draft owner", async () => {
    const scopedOwner = "__draft__:entry-one";
    const scopedPhotos = [makePhoto({ id: "photo-one", entryId: scopedOwner })];
    const scopedAudios = [makeAudio({ id: "audio-one", entryId: scopedOwner })];
    const photoEquals = vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve(scopedPhotos)) }));
    const audioEquals = vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve(scopedAudios)) }));
    vi.mocked(db.journalPhotos.where).mockReturnValue({ equals: photoEquals } as never);
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: audioEquals } as never);

    await deleteDraftMedia(scopedOwner);

    expect(photoEquals).toHaveBeenCalledWith(scopedOwner);
    expect(audioEquals).toHaveBeenCalledWith(scopedOwner);
    expect(db.journalPhotos.bulkDelete).toHaveBeenCalledWith(["photo-one"]);
    expect(db.journalAudio.bulkDelete).toHaveBeenCalledWith(["audio-one"]);
  });

  it("keeps draft photos local until the entry is saved", () => {
    const source = readFileSync("src/features/journal/journalStorage.ts", "utf8");

    expect(source).toContain("if (!isJournalDraftMediaOwnerId(entryId))");
    expect(source).toContain("runWithJournalSecurityWriteLock(async () =>");
    expect(source).toContain("const encryptedPhoto = await encryptPhotoForStorage(photo)");
    expect(source).toContain(
      "uploadPhotoAndSync(storedPhoto, storedPhoto.data, expectedOwnerUserId)"
    );
    expect(source).toContain("syncJournalPhoto(photo, expectedOwnerUserId)");
  });

  it("deletes local and remote draft media on discard", async () => {
    const photos = [makePhoto({ id: "photo-draft", entryId: "__draft__" })];
    const audios = [makeAudio({ id: "audio-draft", entryId: "__draft__" })];
    vi.mocked(db.journalPhotos.where).mockReturnValue({
      equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve(photos)) })),
    } as never);
    vi.mocked(db.journalAudio.where).mockReturnValue({
      equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve(audios)) })),
    } as never);

    await deleteDraftMedia();

    expect(db.journalPhotos.bulkDelete).toHaveBeenCalledWith(["photo-draft"]);
    expect(db.journalAudio.bulkDelete).toHaveBeenCalledWith(["audio-draft"]);
    expect(deleteEntryMediaFromStorage).toHaveBeenCalledWith(
      ["photo-draft"],
      ["audio-draft"],
      "user-1"
    );
    expect(deleteJournalPhotoFromCloud).toHaveBeenCalledWith("photo-draft", "user-1");
    expect(deleteJournalAudioFromCloud).toHaveBeenCalledWith("audio-draft", "user-1");
  });
});

describe("photo quality contract", () => {
  it("keeps a high-density full image and a distinct lightweight thumbnail", () => {
    const storageSource = readFileSync("src/features/journal/journalStorage.ts", "utf8");
    const encodingSource = readFileSync(
      "src/features/journal/journalPhotoEncoding.ts",
      "utf8",
    );
    const readNumber = (source: string, name: string): number => {
      const match = source.match(new RegExp(`const ${name} = ([0-9.]+);`));
      expect(match, `${name} must remain an explicit reviewed constant`).not.toBeNull();
      return Number(match?.[1]);
    };
    const readNumberList = (name: string): number[] => {
      const match = encodingSource.match(new RegExp(`const ${name} = \\[([^\\]]+)\\] as const;`));
      expect(match, `${name} must remain an explicit reviewed policy`).not.toBeNull();
      return (match?.[1] ?? "").split(",").map((value) => Number(value.trim()));
    };

    expect(readNumberList("DEFAULT_DIMENSIONS")[0]).toBeGreaterThanOrEqual(2560);
    expect(readNumberList("FULL_RESOLUTION_QUALITIES")[0]).toBeGreaterThanOrEqual(0.84);
    expect(readNumber(storageSource, "THUMB_WIDTH")).toBeGreaterThanOrEqual(384);
    expect(readNumber(storageSource, "THUMB_WIDTH")).toBeLessThanOrEqual(480);
    expect(readNumber(storageSource, "THUMB_QUALITY")).toBeGreaterThanOrEqual(0.7);
    expect(storageSource).toContain("createImageBitmap");
    expect(storageSource).toContain("resizeWidth");
    expect(storageSource).toContain("resizeHeight");
    expect(storageSource).toContain("ctx.imageSmoothingEnabled = true");
    expect(storageSource).toContain('ctx.imageSmoothingQuality = "high"');
    expect(storageSource).toContain("canvas.toBlob");
    expect(storageSource).toContain("image.close()");
    expect(storageSource).toContain("createPhotoThumbnail");
    expect(storageSource).not.toContain("photo.thumbnail || storedData");
  });
});

// ============================================================
// getAudioForEntry
// ============================================================
describe("getAudioForEntry", () => {
  it("queries audio by entryId", async () => {
    const audios = [makeAudio()];
    const mockEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve(audios)),
    }));
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);

    const result = await getAudioForEntry("entry-1");

    expect(db.journalAudio.where).toHaveBeenCalledWith("entryId");
    expect(mockEquals).toHaveBeenCalledWith("entry-1");
    expect(result).toEqual(audios);
  });

  it("downloads and caches synced audio data when local data is empty", async () => {
    const remoteAudio = makeAudio({
      id: "audio-cloud",
      data: "",
      storagePath: "user-1/audio-cloud.m4a",
    });
    const mockEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve([remoteAudio])),
    }));
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);
    vi.mocked(downloadAsBase64).mockResolvedValue("data:audio/mp4;base64,cloud");

    const result = await getAudioForEntry("entry-1");

    expect(downloadAsBase64).toHaveBeenCalledWith(
      "journal-audio",
      "user-1/audio-cloud.m4a",
      "user-1"
    );
    expect(db.journalAudio.update).toHaveBeenCalledWith("audio-cloud", {
      data: "data:audio/mp4;base64,cloud",
    });
    expect(result[0]).toEqual(expect.objectContaining({ data: "data:audio/mp4;base64,cloud" }));
  });

  it("rejects unavailable synced audio so a later editor retry re-downloads it", async () => {
    const remoteAudio = makeAudio({
      id: "audio-offline",
      data: "",
      storagePath: "user-1/audio-offline.m4a",
    });
    const mockEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve([remoteAudio])),
    }));
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);
    vi.mocked(downloadAsBase64).mockResolvedValue(null);

    await expect(getAudioForEntry("entry-1")).rejects.toThrow(
      "Synced journal audio is unavailable",
    );
    expect(downloadAsBase64).toHaveBeenCalledWith(
      "journal-audio",
      "user-1/audio-offline.m4a",
      "user-1",
    );
  });
});

// ============================================================
// getAudioById
// ============================================================
describe("getAudioById", () => {
  it("returns audio from db.journalAudio.get", async () => {
    const audio = makeAudio();
    vi.mocked(db.journalAudio.get).mockResolvedValue(audio);

    const result = await getAudioById("audio-1", ["entry-1"]);
    expect(db.journalAudio.get).toHaveBeenCalledWith("audio-1");
    expect(result).toEqual(audio);
  });

  it("returns undefined when audio not found", async () => {
    vi.mocked(db.journalAudio.get).mockResolvedValue(undefined);

    const result = await getAudioById("nonexistent", ["entry-1"]);
    expect(result).toBeUndefined();
  });

  it("does not hydrate audio through another journal entry association", async () => {
    vi.mocked(db.journalAudio.get).mockResolvedValue(
      makeAudio({ id: "audio-owned-by-a", entryId: "entry-a", data: "" }),
    );

    await expect(getAudioById("audio-owned-by-a", ["entry-b"])).resolves.toBeUndefined();

    expect(downloadAsBase64).not.toHaveBeenCalled();
  });
});

// ============================================================
// deleteAudio
// ============================================================
describe("deleteAudio", () => {
  beforeEach(() => {
    vi.mocked(db.journalAudio.get).mockResolvedValue(makeAudio());
  });

  it("stops before outbox creation when the audio belongs to another entry", async () => {
    vi.mocked(db.journalAudio.get).mockResolvedValue(
      makeAudio({ id: "audio-owned-by-a", entryId: "entry-a" }),
    );
    vi.mocked(db.journalEntries.get).mockResolvedValue(
      makeEntry({ id: "entry-b", audioIds: ["audio-owned-by-a"] }),
    );

    await expect(deleteAudio("audio-owned-by-a", "entry-b")).rejects.toThrow(
      /does not belong to the requested entry/i,
    );

    expect(persistCriticalOfflineActionInCurrentTransaction).not.toHaveBeenCalled();
    expect(db.journalAudio.delete).not.toHaveBeenCalled();
    expect(db.journalEntries.update).not.toHaveBeenCalled();
    expect(deleteAudioFromStorage).not.toHaveBeenCalled();
    expect(deleteJournalAudioFromCloud).not.toHaveBeenCalled();
  });

  it("does not create a delete action when the audio is already absent", async () => {
    vi.mocked(db.journalAudio.get).mockResolvedValue(undefined);

    await deleteAudio("missing-audio", "entry-1");

    expect(persistCriticalOfflineActionInCurrentTransaction).not.toHaveBeenCalled();
    expect(db.journalAudio.delete).not.toHaveBeenCalled();
    expect(db.journalEntries.update).not.toHaveBeenCalled();
    expect(deleteAudioFromStorage).not.toHaveBeenCalled();
    expect(deleteJournalAudioFromCloud).not.toHaveBeenCalled();
  });

  it("removes audio from db and updates entry audioIds", async () => {
    const entry = makeEntry({ audioIds: ["audio-1", "audio-2"] });
    vi.mocked(db.journalEntries.get).mockResolvedValue(entry);

    await deleteAudio("audio-1", "entry-1");

    expect(db.journalAudio.delete).toHaveBeenCalledWith("audio-1");
    expect(db.journalEntries.get).toHaveBeenCalledWith("entry-1");
    expect(db.journalEntries.update).toHaveBeenCalledWith(
      "entry-1",
      expect.objectContaining({ audioIds: ["audio-2"] })
    );
  });

  it("triggers cloud audio deletion", async () => {
    vi.mocked(db.journalEntries.get).mockResolvedValue(undefined);

    await deleteAudio("audio-1", "entry-1");

    expect(deleteJournalAudioFromCloud).toHaveBeenCalledWith("audio-1", "user-1");
  });

  it("keeps audio deletion local when cloud sync is disabled", async () => {
    vi.mocked(isCloudSyncEnabled).mockReturnValue(false);
    vi.mocked(db.journalEntries.get).mockResolvedValue(undefined);

    await deleteAudio("audio-1", "entry-1");

    expect(db.journalAudio.delete).toHaveBeenCalledWith("audio-1");
    expect(offlineQueue.enqueue).not.toHaveBeenCalled();
    expect(deleteJournalAudioFromCloud).not.toHaveBeenCalled();
  });

  it("persists audio delete retry as an id-only durable action", async () => {
    vi.mocked(db.journalEntries.get).mockResolvedValue(undefined);

    await deleteAudio("audio-1", "entry-1");

    expect(persistCriticalOfflineActionInCurrentTransaction).toHaveBeenCalledWith(
      "DELETE_JOURNAL_AUDIO_STORAGE",
      "journal-audio-delete:audio-1",
      { id: "audio-1" },
      "user-1",
    );
  });

  it("does not update entry when entry not found", async () => {
    vi.mocked(db.journalEntries.get).mockResolvedValue(undefined);

    await deleteAudio("audio-1", "entry-1");

    expect(db.journalEntries.update).not.toHaveBeenCalled();
  });
});
