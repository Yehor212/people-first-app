import { beforeEach, describe, expect, it, vi } from "vitest";

const backupCryptoMocks = vi.hoisted(() => ({
  vaultKey: null as string | null,
}));

vi.mock("@/features/journal/journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => backupCryptoMocks.vaultKey),
}));

vi.mock("@/features/journal/journalCrypto", () => ({
  encryptJournalContent: vi.fn((content: string, key: string) =>
    Promise.resolve(`encrypted-entry:${key}:${content}`)
  ),
  isEncryptedJournalContent: vi.fn((content: string) => content.startsWith("encrypted-entry:")),
}));

vi.mock("@/features/journal/journalMediaCrypto", () => ({
  encryptJournalMediaDataUrl: vi.fn((dataUrl: string, key: string) =>
    Promise.resolve(`encrypted-media:${key}:${dataUrl}`)
  ),
  isEncryptedJournalMediaData: vi.fn((dataUrl: string) => dataUrl.startsWith("encrypted-media:")),
}));
import { db } from "@/storage/db";
import { exportBackup, importBackup, type BackupPayloadV3 } from "@/storage/backup";
import {
  getDeletedHabitIds,
  mergeDeletedHabitIds,
  mergeDeletedJournalEntryIds,
} from "@/storage/deletionTracker";
import { makeTestHabit } from "@/test/habitFixtures";

describe("importBackup deletion precedence", () => {
  beforeEach(async () => {
    backupCryptoMocks.vaultKey = null;
    await db.open();
    await db.moods.clear();
    await db.habits.clear();
    await db.focusSessions.clear();
    await db.gratitudeEntries.clear();
    await db.settings.clear();
    await db.journalEntries.clear();
    await db.journalPhotos.clear();
    await db.journalAudio.clear();
  });

  it("keeps diary security settings local-only in full backup export", async () => {
    await db.settings.bulkPut([
      { key: "journal_password", value: { hash: "secret-verifier" } },
      { key: "journal_vault_key", value: { wrappedKey: "wrapped-key" } },
      { key: "journal_password_cooldown", value: { failedAttempts: 3 } },
      { key: "journal_biometric", value: true },
      { key: "mood-reminder-enabled", value: true },
    ]);

    const backup = await exportBackup();

    expect(backup.data.settings.map((setting) => setting.key).sort()).toEqual([
      "mood-reminder-enabled",
    ]);
  });

  it("preserves local diary security settings during replace backup import", async () => {
    await db.settings.bulkPut([
      { key: "journal_password", value: { hash: "local-verifier" } },
      { key: "journal_vault_key", value: { wrappedKey: "local-wrapped-key" } },
      { key: "mood-reminder-enabled", value: false },
    ]);
    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-05-11T10:01:00.000Z",
      deviceId: "device-test",
      data: {
        moods: [],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [
          { key: "journal_password", value: { hash: "remote-verifier" } },
          { key: "journal_vault_key", value: { wrappedKey: "remote-wrapped-key" } },
          { key: "journal_password_cooldown", value: { failedAttempts: 9 } },
          { key: "mood-reminder-enabled", value: true },
        ],
        journalEntries: [],
        journalPhotos: [],
        journalAudio: [],
      },
    };

    const report = await importBackup(payload, "replace");

    await expect(db.settings.get("journal_password")).resolves.toEqual({
      key: "journal_password",
      value: { hash: "local-verifier" },
    });
    await expect(db.settings.get("journal_vault_key")).resolves.toEqual({
      key: "journal_vault_key",
      value: { wrappedKey: "local-wrapped-key" },
    });
    await expect(db.settings.get("journal_password_cooldown")).resolves.toBeUndefined();
    await expect(db.settings.get("mood-reminder-enabled")).resolves.toEqual({
      key: "mood-reminder-enabled",
      value: true,
    });
    expect(report.settings).toEqual({ added: 1, updated: 0, skipped: 3 });
  });

  it("keeps tombstones authoritative in replace mode when backup still contains the habit", async () => {
    const deletedHabit = makeTestHabit({
      id: "habit-deleted-from-v2",
      name: "Deleted from V2",
      updatedAt: "2026-05-11T10:00:00.000Z",
    });
    const liveHabit = makeTestHabit({
      id: "habit-live",
      name: "Still active",
      updatedAt: "2026-05-11T10:00:00.000Z",
    });
    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-05-11T10:01:00.000Z",
      deviceId: "device-test",
      data: {
        moods: [],
        habits: [deletedHabit, liveHabit],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [],
        journalPhotos: [],
        journalAudio: [],
      },
      deletedHabitIds: [deletedHabit.id],
    };

    const report = await importBackup(payload, "replace");

    const stored = await db.habits.toArray();
    expect(stored.map((habit) => habit.id)).toEqual([liveHabit.id]);
    expect(report.habits).toEqual({ added: 1, updated: 0, skipped: 1 });
    expect((await getDeletedHabitIds()).has(deletedHabit.id)).toBe(true);
  });

  it("accepts large permanent tombstone lists so old deletions stay authoritative", async () => {
    const deletedHabit = makeTestHabit({
      id: "habit-deleted-after-legacy-limit",
      name: "Deleted after legacy limit",
      updatedAt: "2026-05-11T10:00:00.000Z",
    });
    const tombstones = Array.from({ length: 10001 }, (_, index) => `habit-tombstone-${index}`);
    tombstones[0] = deletedHabit.id;
    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-05-11T10:01:00.000Z",
      deviceId: "device-test",
      data: {
        moods: [],
        habits: [deletedHabit],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [],
        journalPhotos: [],
        journalAudio: [],
      },
      deletedHabitIds: tombstones,
    };

    const report = await importBackup(payload, "replace");

    expect(await db.habits.toArray()).toEqual([]);
    expect(report.habits).toEqual({ added: 0, updated: 0, skipped: 1 });
    const deletedIds = await getDeletedHabitIds();
    expect(deletedIds.size).toBe(tombstones.length);
    expect(deletedIds.has(deletedHabit.id)).toBe(true);
    expect(deletedIds.has(tombstones[tombstones.length - 1])).toBe(true);
  });

  it("skips plaintext journal rows during locked protected backup import", async () => {
    await db.settings.put({ key: "journal_password", value: { hash: "local-verifier" } });
    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-05-11T10:01:00.000Z",
      deviceId: "device-test",
      data: {
        moods: [],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [
          {
            id: "journal-plaintext",
            date: "2026-05-25",
            title: "Imported",
            content: "plaintext should not land while locked",
            stickers: [],
            tags: [],
            photoIds: ["photo-plaintext"],
            audioIds: ["audio-plaintext"],
            createdAt: 1,
            updatedAt: 2,
          },
        ],
        journalPhotos: [
          {
            id: "photo-plaintext",
            entryId: "journal-plaintext",
            data: "data:image/jpeg;base64,plain",
            thumbnail: "data:image/jpeg;base64,plain-thumb",
            width: 100,
            height: 80,
            createdAt: 1,
          },
        ],
        journalAudio: [
          {
            id: "audio-plaintext",
            entryId: "journal-plaintext",
            data: "data:audio/webm;base64,plain",
            mimeType: "audio/webm",
            duration: 1,
            createdAt: 1,
          },
        ],
      },
    };

    const report = await importBackup(payload, "replace");

    await expect(db.journalEntries.get("journal-plaintext")).resolves.toBeUndefined();
    await expect(db.journalPhotos.get("photo-plaintext")).resolves.toBeUndefined();
    await expect(db.journalAudio.get("audio-plaintext")).resolves.toBeUndefined();
    expect(report.journalEntries).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect(report.journalPhotos).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect(report.journalAudio).toEqual({ added: 0, updated: 0, skipped: 1 });
  });

  it("encrypts plaintext journal backup rows when a diary vault key is active", async () => {
    backupCryptoMocks.vaultKey = "vault-key-1";
    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-05-11T10:01:00.000Z",
      deviceId: "device-test",
      data: {
        moods: [],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [
          {
            id: "journal-imported",
            date: "2026-05-25",
            title: "Imported",
            content: "private cloud backup entry",
            stickers: [],
            tags: [],
            photoIds: ["photo-imported"],
            audioIds: ["audio-imported"],
            createdAt: 1,
            updatedAt: 2,
          },
        ],
        journalPhotos: [
          {
            id: "photo-imported",
            entryId: "journal-imported",
            data: "data:image/jpeg;base64,abc",
            thumbnail: "data:image/jpeg;base64,thumb",
            width: 100,
            height: 80,
            createdAt: 1,
          },
        ],
        journalAudio: [
          {
            id: "audio-imported",
            entryId: "journal-imported",
            data: "data:audio/webm;base64,abc",
            mimeType: "audio/webm",
            duration: 1,
            createdAt: 1,
          },
        ],
      },
    };

    await importBackup(payload, "replace");

    const entry = await db.journalEntries.get("journal-imported");
    const photo = await db.journalPhotos.get("photo-imported");
    const audio = await db.journalAudio.get("audio-imported");
    expect(entry?.content).toBe("encrypted-entry:vault-key-1:private cloud backup entry");
    expect(photo?.data).toBe("encrypted-media:vault-key-1:data:image/jpeg;base64,abc");
    expect(photo?.thumbnail).toBe("encrypted-media:vault-key-1:data:image/jpeg;base64,thumb");
    expect(audio?.data).toBe("encrypted-media:vault-key-1:data:audio/webm;base64,abc");
  });

  it("retains journal media data when storagePath does not match encryption state", async () => {
    await db.journalPhotos.bulkAdd([
      {
        id: "photo-encrypted-old-path",
        entryId: "journal-live",
        data: "encrypted-media:vault-key-1:data:image/jpeg;base64,photo",
        thumbnail: "encrypted-media:vault-key-1:data:image/jpeg;base64,thumb",
        width: 100,
        height: 80,
        storagePath: "user-1/photo-encrypted-old-path.jpg",
        createdAt: 1,
      },
      {
        id: "photo-plain-old-encrypted-path",
        entryId: "journal-live",
        data: "data:image/jpeg;base64,photo",
        thumbnail: "data:image/jpeg;base64,thumb",
        width: 100,
        height: 80,
        storagePath: "user-1/photo-plain-old-encrypted-path.bin",
        createdAt: 1,
      },
    ]);
    await db.journalAudio.bulkAdd([
      {
        id: "audio-encrypted-old-path",
        entryId: "journal-live",
        data: "encrypted-media:vault-key-1:data:audio/webm;base64,voice",
        mimeType: "audio/webm",
        duration: 1,
        storagePath: "user-1/audio-encrypted-old-path.webm",
        createdAt: 1,
      },
      {
        id: "audio-plain-old-encrypted-path",
        entryId: "journal-live",
        data: "data:audio/webm;base64,voice",
        mimeType: "audio/webm",
        duration: 1,
        storagePath: "user-1/audio-plain-old-encrypted-path.bin",
        createdAt: 1,
      },
    ]);

    const backup = await exportBackup();

    expect(backup.data.journalPhotos?.map((photo) => photo.data)).toEqual([
      "encrypted-media:vault-key-1:data:image/jpeg;base64,photo",
      "data:image/jpeg;base64,photo",
    ]);
    expect(backup.data.journalAudio?.map((audio) => audio.data)).toEqual([
      "encrypted-media:vault-key-1:data:audio/webm;base64,voice",
      "data:audio/webm;base64,voice",
    ]);
  });

  it("does not export locally tombstoned habits or journal media from stale IndexedDB rows", async () => {
    const deletedHabit = makeTestHabit({ id: "habit-stale", name: "Stale deleted" });
    const liveHabit = makeTestHabit({ id: "habit-live", name: "Live" });
    await db.habits.bulkAdd([deletedHabit, liveHabit]);
    await db.journalEntries.bulkAdd([
      {
        id: "journal-stale",
        date: "2026-05-25",
        title: "Deleted",
        content: "stale",
        stickers: [],
        tags: [],
        photoIds: ["photo-stale"],
        audioIds: ["audio-stale"],
        createdAt: 1,
        updatedAt: 2,
      },
      {
        id: "journal-live",
        date: "2026-05-25",
        title: "Live",
        content: "keep",
        stickers: [],
        tags: [],
        photoIds: ["photo-live"],
        audioIds: ["audio-live"],
        createdAt: 1,
        updatedAt: 2,
      },
    ]);
    await db.journalPhotos.bulkAdd([
      {
        id: "photo-stale",
        entryId: "journal-stale",
        data: "x",
        thumbnail: "x",
        createdAt: 1,
      },
      { id: "photo-live", entryId: "journal-live", data: "x", thumbnail: "x", createdAt: 1 } as any,
    ]);
    await db.journalAudio.bulkAdd([
      {
        id: "audio-stale",
        entryId: "journal-stale",
        data: "x",
        mimeType: "audio/webm",
        duration: 1,
        createdAt: 1,
      },
      {
        id: "audio-live",
        entryId: "journal-live",
        data: "x",
        mimeType: "audio/webm",
        duration: 1,
        createdAt: 1,
      },
    ]);
    await mergeDeletedHabitIds([deletedHabit.id]);
    await mergeDeletedJournalEntryIds(["journal-stale"]);

    const backup = await exportBackup();

    expect(backup.data.habits.map((habit) => habit.id)).toEqual([liveHabit.id]);
    expect(backup.data.journalEntries?.map((entry) => entry.id)).toEqual(["journal-live"]);
    expect(backup.data.journalPhotos?.map((photo) => photo.id)).toEqual(["photo-live"]);
    expect(backup.data.journalAudio?.map((audio) => audio.id)).toEqual(["audio-live"]);
    expect(backup.deletedHabitIds).toContain(deletedHabit.id);
    expect(backup.deletedJournalEntryIds).toContain("journal-stale");
  });
});
