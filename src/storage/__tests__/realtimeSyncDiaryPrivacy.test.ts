import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  from: vi.fn(),
  delete: vi.fn(),
  match: vi.fn(),
  getPersistentDeviceId: vi.fn(),
  writeEventAndBroadcast: vi.fn(),
  settingsGet: vi.fn(),
  settingsPut: vi.fn(),
  transaction: vi.fn(),
  journalEntriesToArray: vi.fn(),
  journalEntriesBulkPut: vi.fn(),
  journalPhotosToArray: vi.fn(),
  journalPhotosBulkPut: vi.fn(),
  journalPhotosBulkDelete: vi.fn(),
  journalAudioToArray: vi.fn(),
  journalAudioBulkPut: vi.fn(),
  journalAudioBulkDelete: vi.fn(),
  mergeSyncTombstones: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

let protectedDiary = true;

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: mocks.from },
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}));

vi.mock("@/storage/eventSync", () => ({
  getPersistentDeviceId: mocks.getPersistentDeviceId,
  writeEventAndBroadcast: mocks.writeEventAndBroadcast,
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
        bulkDelete: mocks.journalPhotosBulkDelete,
      },
      journalAudio: {
        toArray: mocks.journalAudioToArray,
        bulkPut: mocks.journalAudioBulkPut,
        bulkDelete: mocks.journalAudioBulkDelete,
      },
      transaction: mocks.transaction,
    },
  };
});

import { pullFromCloud } from "@/storage/realtimeSync";
import { runWithJournalSecurityWriteLock } from "@/features/journal/journalSecurityWriteLock";
import { notifyAccountSessionTransition } from "@/storage/accountBoundaryRuntime";

function queryResult(data: unknown[]) {
  const response = { data, error: null };
  const promise = Promise.resolve(response);
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    delete: mocks.delete,
    then: promise.then.bind(promise),
  };
  return chain;
}

async function flushAsyncTurns(turns = 24): Promise<void> {
  for (let index = 0; index < turns; index += 1) {
    await Promise.resolve();
  }
}

describe("pullFromCloud diary privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    protectedDiary = true;
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.match.mockResolvedValue({ error: null });
    mocks.delete.mockReturnValue({ match: mocks.match });
    mocks.getPersistentDeviceId.mockResolvedValue("device-1");
    mocks.writeEventAndBroadcast.mockResolvedValue(undefined);
    mocks.settingsGet.mockImplementation((key: string) =>
      Promise.resolve(
        protectedDiary && key === "journal_password"
          ? { key, value: { hash: "local-lock" } }
          : protectedDiary && key === "journal_vault_key"
            ? { key, value: { wrappedKey: "local-vault", createdAt: 100, updatedAt: 101 } }
            : protectedDiary && key === "journal_vault_revision_v1"
              ? { key, value: 101 }
              : undefined
      )
    );
    mocks.settingsPut.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(
      async (_mode: string, _tables: unknown[], callback: () => Promise<void>) => callback()
    );
    mocks.journalEntriesToArray.mockResolvedValue([]);
    mocks.journalEntriesBulkPut.mockResolvedValue(undefined);
    mocks.journalPhotosToArray.mockResolvedValue([]);
    mocks.journalPhotosBulkPut.mockResolvedValue(undefined);
    mocks.journalPhotosBulkDelete.mockResolvedValue(undefined);
    mocks.journalAudioToArray.mockResolvedValue([]);
    mocks.journalAudioBulkPut.mockResolvedValue(undefined);
    mocks.journalAudioBulkDelete.mockResolvedValue(undefined);
    mocks.mergeSyncTombstones.mockResolvedValue({
      mood: new Set(),
      habit: new Set(),
      focus: new Set(),
      gratitude: new Set(),
      journal: new Set(),
    });
  });

  it("purges local media that a newer cloud parent no longer references", async () => {
    protectedDiary = false;
    mocks.journalEntriesToArray.mockResolvedValue([
      {
        id: "entry-parent",
        date: "2026-07-10",
        title: "Before",
        content: "old",
        stickers: [],
        tags: [],
        photoIds: ["photo-stale"],
        audioIds: ["audio-stale"],
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    mocks.journalPhotosToArray.mockResolvedValue([
      {
        id: "photo-stale",
        entryId: "entry-parent",
        data: "local-binary",
        thumbnail: "local-preview",
        width: 100,
        height: 80,
        createdAt: 1,
      },
    ]);
    mocks.journalAudioToArray.mockResolvedValue([
      {
        id: "audio-stale",
        entryId: "entry-parent",
        data: "local-audio",
        duration: 1,
        mimeType: "audio/webm",
        createdAt: 1,
      },
    ]);
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
          id: "entry-parent",
          date: "2026-07-10",
          title: "After",
          content: "new",
          stickers: [],
          mood: null,
          tags: [],
          template_id: null,
          habit_snapshot: null,
          photo_ids: [],
          audio_ids: [],
          created_at: 1,
          updated_at: 2,
        },
      ],
      journal_photos: [],
      journal_audio: [],
      sync_tombstones: [],
    };
    mocks.from.mockImplementation((table: string) => queryResult(dataByTable[table] ?? []));

    await expect(pullFromCloud("user-1")).resolves.toBe(true);

    expect(mocks.journalPhotosBulkDelete).toHaveBeenCalledWith(["photo-stale"]);
    expect(mocks.journalAudioBulkDelete).toHaveBeenCalledWith(["audio-stale"]);
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
          vault_revision: 101,
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
          storage_path: "user-1/photo-encrypted.v101.bin",
          vault_revision: 101,
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
          storage_path: "user-1/audio-encrypted.v101.bin",
          vault_revision: 101,
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
        vaultRevision: 101,
      }),
    ]);
    expect(mocks.journalPhotosBulkPut).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "photo-encrypted",
        entryId: "entry-encrypted",
        storagePath: "user-1/photo-encrypted.v101.bin",
        vaultRevision: 101,
      }),
    ]);
    expect(mocks.journalAudioBulkPut).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "audio-encrypted",
        entryId: "entry-encrypted",
        storagePath: "user-1/audio-encrypted.v101.bin",
        vaultRevision: 101,
      }),
    ]);
    expect(JSON.stringify(mocks.journalEntriesBulkPut.mock.calls)).not.toContain("entry-plain");
    expect(JSON.stringify(mocks.journalPhotosBulkPut.mock.calls)).not.toContain("photo-plain");
    expect(JSON.stringify(mocks.journalAudioBulkPut.mock.calls)).not.toContain("audio-plain");
  });

  it("rejects stale, missing, and path-mismatched vault epochs at the snapshot commit boundary", async () => {
    const encryptedEntry = (id: string, vaultRevision?: number) => ({
      id,
      date: "2026-08-03",
      title: "Protected",
      content: "encrypted-entry:ciphertext",
      stickers: [],
      mood: null,
      tags: [],
      template_id: null,
      habit_snapshot: null,
      photo_ids: [`photo-${id}`],
      audio_ids: [`audio-${id}`],
      vault_revision: vaultRevision,
      created_at: 1,
      updated_at: 2,
    });
    const dataByTable: Record<string, unknown[]> = {
      moods: [], habits: [], habit_completions: [], habit_reminders: [], focus_sessions: [],
      gratitude_entries: [], user_settings: [],
      journal_entries: [
        encryptedEntry("current", 101),
        encryptedEntry("stale", 100),
        encryptedEntry("missing"),
        encryptedEntry("path-mismatch", 101),
      ],
      journal_photos: [
        { id: "photo-current", entry_id: "current", width: 1, height: 1, created_at: 1, storage_path: "user-1/photo-current.v101.bin", vault_revision: 101 },
        { id: "photo-stale", entry_id: "stale", width: 1, height: 1, created_at: 1, storage_path: "user-1/photo-stale.v100.bin", vault_revision: 100 },
        { id: "photo-missing", entry_id: "missing", width: 1, height: 1, created_at: 1, storage_path: "user-1/photo-missing.v101.bin", vault_revision: null },
        { id: "photo-path-mismatch", entry_id: "path-mismatch", width: 1, height: 1, created_at: 1, storage_path: "user-1/photo-path-mismatch.v100.bin", vault_revision: 101 },
      ],
      journal_audio: [
        { id: "audio-current", entry_id: "current", duration: 1, mime_type: "audio/webm", created_at: 1, storage_path: "user-1/audio-current.v101.bin", vault_revision: 101 },
        { id: "audio-stale", entry_id: "stale", duration: 1, mime_type: "audio/webm", created_at: 1, storage_path: "user-1/audio-stale.v100.bin", vault_revision: 100 },
        { id: "audio-missing", entry_id: "missing", duration: 1, mime_type: "audio/webm", created_at: 1, storage_path: "user-1/audio-missing.v101.bin", vault_revision: null },
        { id: "audio-path-mismatch", entry_id: "path-mismatch", duration: 1, mime_type: "audio/webm", created_at: 1, storage_path: "user-1/audio-path-mismatch.v100.bin", vault_revision: 101 },
      ],
      sync_tombstones: [],
    };
    mocks.from.mockImplementation((table: string) => queryResult(dataByTable[table] ?? []));

    await expect(pullFromCloud("user-1")).resolves.toBe(true);

    expect(mocks.journalEntriesBulkPut).toHaveBeenCalledWith([
      expect.objectContaining({ id: "current", vaultRevision: 101 }),
      expect.objectContaining({ id: "path-mismatch", vaultRevision: 101 }),
    ]);
    expect(mocks.journalPhotosBulkPut).toHaveBeenCalledWith([
      expect.objectContaining({ id: "photo-current", vaultRevision: 101 }),
    ]);
    expect(mocks.journalAudioBulkPut).toHaveBeenCalledWith([
      expect.objectContaining({ id: "audio-current", vaultRevision: 101 }),
    ]);
    const committedEntries = JSON.stringify(mocks.journalEntriesBulkPut.mock.calls);
    const committedMedia = JSON.stringify([
      mocks.journalPhotosBulkPut.mock.calls,
      mocks.journalAudioBulkPut.mock.calls,
    ]);
    expect(committedEntries).not.toContain("stale");
    expect(committedEntries).not.toContain("missing");
    expect(committedMedia).not.toContain("stale");
    expect(committedMedia).not.toContain("missing");
    expect(committedMedia).not.toContain("path-mismatch");
  });

  it("discards an account A snapshot response when account B is active before local writes", async () => {
    mocks.getCurrentUserId.mockResolvedValueOnce("account-a").mockResolvedValue("account-b");
    mocks.from.mockImplementation(() => queryResult([]));

    await expect(pullFromCloud("account-a")).resolves.toBe(false);

    expect(mocks.mergeSyncTombstones).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.settingsPut).not.toHaveBeenCalled();
  });

  it("discards an ABA-stale snapshot when the account session changes during local preparation", async () => {
    mocks.from.mockImplementation(() => queryResult([]));
    mocks.mergeSyncTombstones.mockImplementationOnce(async () => {
      notifyAccountSessionTransition();
      return {
        mood: new Set(),
        habit: new Set(),
        focus: new Set(),
        gratitude: new Set(),
        journal: new Set(),
      };
    });

    await expect(pullFromCloud("user-1")).resolves.toBe(false);

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("keeps private snapshot failure text out of logs and failure event diagnostics", async () => {
    const privateCanary = "PRIVATE_SNAPSHOT_CANARY: journal prose";
    mocks.from.mockImplementation(() => queryResult([]));
    mocks.transaction.mockRejectedValueOnce(new Error(privateCanary));
    let failureDetail: unknown;
    const captureFailure = (event: Event) => {
      failureDetail = (event as CustomEvent<unknown>).detail;
    };
    window.addEventListener("zenflow:sync-transaction-failed", captureFailure);

    try {
      await expect(pullFromCloud("user-1")).resolves.toBe(false);
    } finally {
      window.removeEventListener("zenflow:sync-transaction-failed", captureFailure);
    }

    const diagnostics = JSON.stringify({
      errorLogs: mocks.loggerError.mock.calls,
      warningLogs: mocks.loggerWarn.mock.calls,
      failureDetail,
    });
    expect(diagnostics).not.toContain(privateCanary);
    expect(failureDetail).toMatchObject({ error: "SYNC_TRANSACTION_FAILED" });
  });

  it("does not resurrect a removed diary vault from a stale cloud snapshot", async () => {
    protectedDiary = false;
    mocks.settingsGet.mockImplementation((key: string) => {
      if (key === "journal_vault_revision_v1") {
        return Promise.resolve({ key, value: 101 });
      }
      return Promise.resolve(undefined);
    });
    const dataByTable: Record<string, unknown[]> = {
      moods: [],
      habits: [],
      habit_completions: [],
      habit_reminders: [],
      focus_sessions: [],
      gratitude_entries: [],
      user_settings: [
        {
          key: "journal_vault_key",
          value: { wrappedKey: "stale", createdAt: 100, updatedAt: 101 },
        },
      ],
      journal_entries: [],
      journal_photos: [],
      journal_audio: [],
      sync_tombstones: [],
    };
    mocks.from.mockImplementation((table: string) => queryResult(dataByTable[table] ?? []));

    await expect(pullFromCloud("user-1")).resolves.toBe(true);

    expect(mocks.settingsPut).not.toHaveBeenCalledWith({
      key: "journal_vault_key",
      value: expect.anything(),
    });
    expect(mocks.settingsPut).not.toHaveBeenCalledWith({
      key: "journal_vault_revision_v1",
      value: expect.anything(),
    });
  });

  it("purges a legacy cloud privacy row without applying it to this device", async () => {
    protectedDiary = false;
    const localPrivacy = JSON.stringify({ adConsent: false, pushNotifications: false });
    localStorage.setItem("zenflow-privacy", localPrivacy);
    const dataByTable: Record<string, unknown[]> = {
      moods: [],
      habits: [],
      habit_completions: [],
      habit_reminders: [],
      focus_sessions: [],
      gratitude_entries: [],
      user_settings: [
        {
          key: "zenflow-privacy",
          value: { adConsent: true, pushNotifications: true },
        },
      ],
      journal_entries: [],
      journal_photos: [],
      journal_audio: [],
      sync_tombstones: [],
    };
    mocks.from.mockImplementation((table: string) => queryResult(dataByTable[table] ?? []));

    await expect(pullFromCloud("user-1")).resolves.toBe(true);

    expect(mocks.settingsPut).not.toHaveBeenCalledWith({
      key: "zenflow-privacy",
      value: expect.anything(),
    });
    expect(mocks.match).toHaveBeenCalledWith({
      user_id: "user-1",
      key: "zenflow-privacy",
    });
    expect(localStorage.getItem("zenflow-privacy")).toBe(localPrivacy);
  });

  it("rechecks diary protection after waiting for activation before committing a pulled snapshot", async () => {
    protectedDiary = false;
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
          id: "entry-race",
          date: "2026-07-10",
          title: "Private",
          content: "plaintext fetched before activation",
          stickers: [],
          mood: null,
          tags: [],
          template_id: null,
          habit_snapshot: null,
          photo_ids: ["photo-race"],
          audio_ids: ["audio-race"],
          created_at: 1,
          updated_at: 2,
        },
      ],
      journal_photos: [
        {
          id: "photo-race",
          entry_id: "entry-race",
          width: 100,
          height: 80,
          created_at: 1,
          storage_path: "user-1/photo-race.jpg",
        },
      ],
      journal_audio: [
        {
          id: "audio-race",
          entry_id: "entry-race",
          duration: 5,
          mime_type: "audio/webm",
          created_at: 1,
          storage_path: "user-1/audio-race.webm",
        },
      ],
      sync_tombstones: [],
    };
    mocks.from.mockImplementation((table: string) => queryResult(dataByTable[table] ?? []));

    let releaseActivation!: () => void;
    let activationEntered!: () => void;
    const activationEnteredPromise = new Promise<void>((resolve) => {
      activationEntered = resolve;
    });
    const activationReleasePromise = new Promise<void>((resolve) => {
      releaseActivation = resolve;
    });
    const activation = runWithJournalSecurityWriteLock(async () => {
      activationEntered();
      await activationReleasePromise;
      protectedDiary = true;
    });
    await activationEnteredPromise;

    const pullPromise = pullFromCloud("user-1");
    await flushAsyncTurns();
    const transactionsCommittedDuringActivation = mocks.transaction.mock.calls.length;
    releaseActivation();
    await activation;

    await expect(pullPromise).resolves.toBe(true);
    expect(transactionsCommittedDuringActivation).toBe(0);
    expect(mocks.journalEntriesBulkPut).not.toHaveBeenCalled();
    expect(mocks.journalPhotosBulkPut).not.toHaveBeenCalled();
    expect(mocks.journalAudioBulkPut).not.toHaveBeenCalled();
  });
});
