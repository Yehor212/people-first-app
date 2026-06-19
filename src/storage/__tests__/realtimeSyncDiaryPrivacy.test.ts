import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  from: vi.fn(),
  settingsGet: vi.fn(),
  settingsPut: vi.fn(),
  transaction: vi.fn(),
  journalEntriesToArray: vi.fn(),
  journalEntriesBulkPut: vi.fn(),
  journalPhotosToArray: vi.fn(),
  journalPhotosBulkPut: vi.fn(),
  journalAudioToArray: vi.fn(),
  journalAudioBulkPut: vi.fn(),
  mergeSyncTombstones: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: mocks.from },
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/features/journal/journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => null),
}));

vi.mock("@/features/journal/journalCrypto", () => ({
  isEncryptedJournalContent: vi.fn((content: string) => content.startsWith("encrypted-entry:")),
}));

vi.mock("@/storage/sync/serverTombstones", () => ({
  fetchAndMergeServerTombstones: vi.fn(() =>
    Promise.resolve({
      mood: new Set(),
      habit: new Set(),
      focus: new Set(),
      gratitude: new Set(),
      journal: new Set(),
    })
  ),
  mergeSyncTombstones: mocks.mergeSyncTombstones,
}));

vi.mock("@/storage/db", () => {
  const emptyTable = {
    bulkDelete: vi.fn(() => Promise.resolve()),
    bulkPut: vi.fn(() => Promise.resolve()),
    toArray: vi.fn(() => Promise.resolve([])),
  };
  return {
    db: {
      moods: emptyTable,
      habits: emptyTable,
      focusSessions: emptyTable,
      gratitudeEntries: emptyTable,
      settings: {
        get: mocks.settingsGet,
        put: mocks.settingsPut,
        toArray: vi.fn(() => Promise.resolve([])),
      },
      journalEntries: {
        toArray: mocks.journalEntriesToArray,
        bulkPut: mocks.journalEntriesBulkPut,
      },
      journalPhotos: {
        toArray: mocks.journalPhotosToArray,
        bulkPut: mocks.journalPhotosBulkPut,
      },
      journalAudio: {
        toArray: mocks.journalAudioToArray,
        bulkPut: mocks.journalAudioBulkPut,
      },
      transaction: mocks.transaction,
    },
  };
});

import { pullFromCloud } from "@/storage/realtimeSync";

function queryResult(data: unknown[]) {
  const response = { data, error: null };
  const promise = Promise.resolve(response);
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: promise.then.bind(promise),
  };
  return chain;
}

describe("pullFromCloud diary privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.settingsGet.mockImplementation((key: string) =>
      Promise.resolve(key === "journal_password" ? { key, value: { hash: "local-lock" } } : undefined)
    );
    mocks.settingsPut.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(
      async (_mode: string, _tables: unknown[], callback: () => Promise<void>) => callback()
    );
    mocks.journalEntriesToArray.mockResolvedValue([]);
    mocks.journalEntriesBulkPut.mockResolvedValue(undefined);
    mocks.journalPhotosToArray.mockResolvedValue([]);
    mocks.journalPhotosBulkPut.mockResolvedValue(undefined);
    mocks.journalAudioToArray.mockResolvedValue([]);
    mocks.journalAudioBulkPut.mockResolvedValue(undefined);
    mocks.mergeSyncTombstones.mockResolvedValue({
      mood: new Set(),
      habit: new Set(),
      focus: new Set(),
      gratitude: new Set(),
      journal: new Set(),
    });
  });

  it("skips plaintext journal entries and media while a protected diary is locked", async () => {
    const dataByTable: Record<string, unknown[]> = {
      moods: [],
      habits: [],
      habit_completions: [],
      habit_reminders: [],
      focus_sessions: [],
      gratitude_entries: [],
      user_settings: [],
      journal_entries: [
        {
          id: "entry-plain",
          date: "2026-06-18",
          title: "Plain",
          content: "plaintext should not be stored while locked",
          stickers: [],
          mood: null,
          tags: [],
          template_id: null,
          habit_snapshot: null,
          photo_ids: ["photo-plain"],
          audio_ids: ["audio-plain"],
          created_at: 1,
          updated_at: 2,
        },
        {
          id: "entry-encrypted",
          date: "2026-06-18",
          title: "Encrypted",
          content: "encrypted-entry:ciphertext",
          stickers: [],
          mood: null,
          tags: [],
          template_id: null,
          habit_snapshot: null,
          photo_ids: ["photo-encrypted"],
          audio_ids: ["audio-encrypted"],
          created_at: 3,
          updated_at: 4,
        },
      ],
      journal_photos: [
        {
          id: "photo-plain",
          entry_id: "entry-plain",
          width: 100,
          height: 80,
          created_at: 1,
          storage_path: "user-1/photo-plain.jpg",
        },
        {
          id: "photo-encrypted",
          entry_id: "entry-encrypted",
          width: 100,
          height: 80,
          created_at: 1,
          storage_path: "user-1/photo-encrypted.bin",
        },
      ],
      journal_audio: [
        {
          id: "audio-plain",
          entry_id: "entry-plain",
          duration: 1,
          mime_type: "audio/webm",
          created_at: 1,
          storage_path: "user-1/audio-plain.webm",
        },
        {
          id: "audio-encrypted",
          entry_id: "entry-encrypted",
          duration: 1,
          mime_type: "audio/webm",
          created_at: 1,
          storage_path: "user-1/audio-encrypted.bin",
        },
      ],
      sync_tombstones: [],
    };
    mocks.from.mockImplementation((table: string) => queryResult(dataByTable[table] ?? []));

    await expect(pullFromCloud()).resolves.toBe(true);

    expect(mocks.journalEntriesBulkPut).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "entry-encrypted",
        content: "encrypted-entry:ciphertext",
      }),
    ]);
    expect(mocks.journalPhotosBulkPut).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "photo-encrypted",
        entryId: "entry-encrypted",
        storagePath: "user-1/photo-encrypted.bin",
      }),
    ]);
    expect(mocks.journalAudioBulkPut).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "audio-encrypted",
        entryId: "entry-encrypted",
        storagePath: "user-1/audio-encrypted.bin",
      }),
    ]);
    expect(JSON.stringify(mocks.journalEntriesBulkPut.mock.calls)).not.toContain("entry-plain");
    expect(JSON.stringify(mocks.journalPhotosBulkPut.mock.calls)).not.toContain("photo-plain");
    expect(JSON.stringify(mocks.journalAudioBulkPut.mock.calls)).not.toContain("audio-plain");
  });
});
