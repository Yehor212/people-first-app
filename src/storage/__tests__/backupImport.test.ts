import { beforeEach, describe, expect, it, vi } from "vitest";

const backupCryptoMocks = vi.hoisted(() => ({
  vaultKey: null as string | null,
}));

const backupOwnerMocks = vi.hoisted(() => ({
  validateSyncOwner: vi.fn(async (expectedOwnerUserId?: string) => expectedOwnerUserId ?? null),
}));

vi.mock("@/lib/journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => backupCryptoMocks.vaultKey),
  consumeJournalReplaceAuthorization: vi.fn(() => true),
}));

vi.mock("@/features/journal/journalCrypto", () => ({
  encryptJournalContent: vi.fn((content: string, key: string) =>
    Promise.resolve(`encrypted-entry:${key}:${content}`)
  ),
  decryptJournalContentIfNeeded: vi.fn((content: string, key: string) =>
    Promise.resolve(content.replace(`encrypted-entry:${key}:`, ""))
  ),
  isEncryptedJournalContent: vi.fn((content: string) => content.startsWith("encrypted-entry:")),
}));

vi.mock("@/features/journal/journalMediaCrypto", () => ({
  encryptJournalMediaDataUrl: vi.fn((dataUrl: string, key: string) =>
    Promise.resolve(`encrypted-media:${key}:${dataUrl}`)
  ),
  decryptJournalMediaDataUrlIfNeeded: vi.fn((dataUrl: string, key: string | null) =>
    Promise.resolve(key ? dataUrl.replace(`encrypted-media:${key}:`, "") : "")
  ),
  encryptedJournalMediaFromStorageDataUrl: vi.fn((dataUrl: string) => dataUrl),
  isEncryptedJournalMediaData: vi.fn((dataUrl: string) => dataUrl.startsWith("encrypted-media:")),
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: backupOwnerMocks.validateSyncOwner,
}));
import { db } from "@/storage/db";
import { consumeJournalReplaceAuthorization } from "@/lib/journalContentSession";
import {
  exportBackup,
  exportPortableBackup,
  importBackup,
  type BackupPayloadV1,
  type BackupPayloadV3,
} from "@/storage/backup";
import {
  DELETION_TRACKER_KEYS,
  getDeletedFocusSessionIds,
  getDeletedGratitudeIds,
  getDeletedHabitIds,
  getDeletedJournalEntryIds,
  getDeletedMoodIds,
  mergeDeletedFocusSessionIds,
  mergeDeletedGratitudeIds,
  mergeDeletedHabitIds,
  mergeDeletedJournalEntryIds,
  mergeDeletedMoodIds,
} from "@/storage/deletionTracker";
import { makeTestHabit } from "@/test/habitFixtures";
import { runWithJournalSecurityWriteLock } from "@/features/journal/journalSecurityWriteLock";
import { SK } from "@/lib/storageKeys";

const sortByPrimaryKey = <T extends { id: string }>(rows: T[]): T[] =>
  [...rows].sort((left, right) => left.id.localeCompare(right.id));

const readImportedCollectionsSnapshot = async () => ({
  moods: sortByPrimaryKey(await db.moods.toArray()),
  habits: sortByPrimaryKey(await db.habits.toArray()),
  focusSessions: sortByPrimaryKey(await db.focusSessions.toArray()),
  gratitudeEntries: sortByPrimaryKey(await db.gratitudeEntries.toArray()),
  settings: [...(await db.settings.toArray())].sort((left, right) =>
    left.key.localeCompare(right.key)
  ),
  journalEntries: sortByPrimaryKey(await db.journalEntries.toArray()),
  journalPhotos: sortByPrimaryKey(await db.journalPhotos.toArray()),
  journalAudio: sortByPrimaryKey(await db.journalAudio.toArray()),
  journalHubPreferences: sortByPrimaryKey(
    await db.journalHubPreferences.toArray(),
  ),
  journalSpaces: sortByPrimaryKey(await db.journalSpaces.toArray()),
  journalPracticeSessions: sortByPrimaryKey(
    await db.journalPracticeSessions.toArray(),
  ),
  journalEntryLinks: sortByPrimaryKey(await db.journalEntryLinks.toArray()),
  journalSpaceCaptures: sortByPrimaryKey(
    await db.journalSpaceCaptures.toArray(),
  ),
});

const readDeletionTrackerSnapshot = async () => ({
  moods: [...(await getDeletedMoodIds())].sort(),
  habits: [...(await getDeletedHabitIds())].sort(),
  focusSessions: [...(await getDeletedFocusSessionIds())].sort(),
  gratitudeEntries: [...(await getDeletedGratitudeIds())].sort(),
  journalEntries: [...(await getDeletedJournalEntryIds())].sort(),
});

const makeAtomicityCollections = (
  scope: "local" | "remote",
  reminderEnabled: boolean
): BackupPayloadV3["data"] => {
  const journalEntryId = `${scope}-atomic-journal`;
  return {
    moods: [
      {
        id: `${scope}-atomic-mood`,
        mood: scope === "local" ? "okay" : "good",
        date: scope === "local" ? "2026-07-10" : "2026-07-11",
        timestamp: scope === "local" ? 10 : 20,
        updatedAt: scope === "local" ? 10 : 20,
      },
    ],
    habits: [
      makeTestHabit({
        id: `${scope}-atomic-habit`,
        name: `${scope} atomic habit`,
        updatedAt: scope === "local" ? "2026-07-10T00:00:00.000Z" : "2026-07-11T00:00:00.000Z",
      }),
    ],
    focusSessions: [
      {
        id: `${scope}-atomic-focus`,
        duration: 600,
        completedAt: scope === "local" ? 10 : 20,
        date: scope === "local" ? "2026-07-10" : "2026-07-11",
        status: "completed",
        updatedAt: scope === "local" ? 10 : 20,
      },
    ],
    gratitudeEntries: [
      {
        id: `${scope}-atomic-gratitude`,
        text: `${scope} atomic gratitude`,
        date: scope === "local" ? "2026-07-10" : "2026-07-11",
        timestamp: scope === "local" ? 10 : 20,
        updatedAt: scope === "local" ? 10 : 20,
      },
    ],
    settings: [{ key: "mood-reminder-enabled", value: reminderEnabled }],
    journalEntries: [
      {
        id: journalEntryId,
        date: scope === "local" ? "2026-07-10" : "2026-07-11",
        title: `${scope} atomic journal`,
        content: `${scope} atomic content`,
        stickers: [],
        tags: [],
        photoIds: [`${scope}-atomic-photo`],
        audioIds: [`${scope}-atomic-audio`],
        createdAt: scope === "local" ? 10 : 20,
        updatedAt: scope === "local" ? 10 : 20,
      },
    ],
    journalPhotos: [
      {
        id: `${scope}-atomic-photo`,
        entryId: journalEntryId,
        data: `data:image/jpeg;base64,${scope}`,
        thumbnail: `data:image/jpeg;base64,${scope}-thumbnail`,
        width: 100,
        height: 80,
        createdAt: scope === "local" ? 10 : 20,
      },
    ],
    journalAudio: [
      {
        id: `${scope}-atomic-audio`,
        entryId: journalEntryId,
        data: `data:audio/webm;base64,${scope}`,
        mimeType: "audio/webm",
        duration: 1,
        createdAt: scope === "local" ? 10 : 20,
      },
    ],
  };
};

const seedImportedCollections = async (data: BackupPayloadV3["data"]): Promise<void> => {
  await db.moods.bulkPut(data.moods);
  await db.habits.bulkPut(data.habits);
  await db.focusSessions.bulkPut(data.focusSessions);
  await db.gratitudeEntries.bulkPut(data.gratitudeEntries);
  await db.settings.bulkPut(data.settings);
  await db.journalEntries.bulkPut(data.journalEntries ?? []);
  await db.journalPhotos.bulkPut(data.journalPhotos ?? []);
  await db.journalAudio.bulkPut(data.journalAudio ?? []);
};

describe("importBackup deletion precedence", () => {
  beforeEach(async () => {
    backupCryptoMocks.vaultKey = null;
    vi.mocked(consumeJournalReplaceAuthorization).mockClear();
    backupOwnerMocks.validateSyncOwner.mockReset();
    backupOwnerMocks.validateSyncOwner.mockImplementation(
      async (expectedOwnerUserId?: string) => expectedOwnerUserId ?? null
    );
    await db.open();
    await db.moods.clear();
    await db.habits.clear();
    await db.focusSessions.clear();
    await db.gratitudeEntries.clear();
    await db.settings.clear();
    await db.journalEntries.clear();
    await db.journalPhotos.clear();
    await db.journalAudio.clear();
    await db.journalHubPreferences.clear();
    await db.journalSpaces.clear();
    await db.journalPracticeSessions.clear();
    await db.journalEntryLinks.clear();
    await db.journalSpaceCaptures.clear();
  });

  it("keeps diary security settings local-only in full backup export", async () => {
    await db.settings.bulkPut([
      { key: "journal_password", value: { hash: "secret-verifier" } },
      { key: "journal_vault_key", value: { wrappedKey: "wrapped-key" } },
      { key: "journal_password_cooldown", value: { failedAttempts: 3 } },
      { key: "journal_biometric", value: true },
      {
        key: SK.PRIVACY,
        value: { adConsent: true, pushNotifications: true },
      },
      { key: "mood-reminder-enabled", value: true },
    ]);

    const backup = await exportBackup();

    expect(backup.data.settings.map((setting) => setting.key).sort()).toEqual([
      "mood-reminder-enabled",
    ]);
  });

  it("preserves local diary security settings during replace backup import", async () => {
    backupCryptoMocks.vaultKey = "active-local-vault-key";
    await db.settings.bulkPut([
      { key: "journal_password", value: { hash: "local-verifier" } },
      {
        key: "journal_vault_key",
        value: { wrappedKey: "local-wrapped-key", createdAt: 1, updatedAt: 2 },
      },
      { key: "mood-reminder-enabled", value: false },
      {
        key: SK.PRIVACY,
        value: { adConsent: false, pushNotifications: false },
      },
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
          {
            key: SK.PRIVACY,
            value: { adConsent: true, pushNotifications: true },
          },
          { key: "mood-reminder-enabled", value: true },
        ],
        journalEntries: [],
        journalPhotos: [],
        journalAudio: [],
      },
    };

    const report = await importBackup(payload, "replace", {
      journalReplaceAuthorization: {
        id: "test-authorization",
        expiresAt: 10,
        vaultRevision: 2,
        sessionGeneration: 1,
      },
      now: 3,
    });

    await expect(db.settings.get("journal_password")).resolves.toEqual({
      key: "journal_password",
      value: { hash: "local-verifier" },
    });
    await expect(db.settings.get("journal_vault_key")).resolves.toEqual({
      key: "journal_vault_key",
      value: { wrappedKey: "local-wrapped-key", createdAt: 1, updatedAt: 2 },
    });
    await expect(db.settings.get("journal_password_cooldown")).resolves.toBeUndefined();
    await expect(db.settings.get("mood-reminder-enabled")).resolves.toEqual({
      key: "mood-reminder-enabled",
      value: true,
    });
    await expect(db.settings.get(SK.PRIVACY)).resolves.toEqual({
      key: SK.PRIVACY,
      value: { adConsent: false, pushNotifications: false },
    });
    expect(report.settings).toEqual({ added: 1, updated: 0, skipped: 4 });
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

  it.each([
    ["deletedMoodIds", "not-an-array"],
    ["deletedHabitIds", ["valid-id", 7]],
    ["deletedFocusSessionIds", [""]],
    ["deletedGratitudeIds", ["x".repeat(101)]],
    ["deletedJournalEntryIds", null],
  ] as const)(
    "rejects a present but invalid %s field before opening a write transaction",
    async (field, invalidValue) => {
      const localHabit = makeTestHabit({
        id: `keep-${field}`,
        name: `Keep ${field}`,
      });
      await db.habits.put(localHabit);
      await mergeDeletedHabitIds([`local-tombstone-${field}`]);
      const collectionsBefore = await readImportedCollectionsSnapshot();
      const tombstonesBefore = await readDeletionTrackerSnapshot();
      const transactionSpy = vi.spyOn(db, "transaction");
      const payload = {
        schemaVersion: 3,
        createdAt: "2026-07-18T00:00:00.000Z",
        deviceId: "invalid-tombstone-field",
        data: {
          moods: [],
          habits: [],
          focusSessions: [],
          gratitudeEntries: [],
          settings: [],
        },
        [field]: invalidValue,
      };

      try {
        await expect(importBackup(payload as never, "replace")).rejects.toMatchObject({
          code: "BACKUP_DELETION_HISTORY_INVALID",
        });
        expect(consumeJournalReplaceAuthorization).not.toHaveBeenCalled();
        expect(transactionSpy).not.toHaveBeenCalled();
        await expect(readImportedCollectionsSnapshot()).resolves.toEqual(
          collectionsBefore,
        );
        await expect(readDeletionTrackerSnapshot()).resolves.toEqual(
          tombstonesBefore,
        );
      } finally {
        transactionSpy.mockRestore();
      }
    },
  );

  it("rejects a deletion history above the 100000-item boundary without mutation", async () => {
    const localHabit = makeTestHabit({
      id: "keep-over-limit-tombstones",
      name: "Keep over-limit tombstones",
    });
    await db.habits.put(localHabit);
    await mergeDeletedHabitIds(["local-over-limit-tombstone"]);
    const collectionsBefore = await readImportedCollectionsSnapshot();
    const tombstonesBefore = await readDeletionTrackerSnapshot();
    const transactionSpy = vi.spyOn(db, "transaction");
    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-07-18T00:00:00.000Z",
      deviceId: "over-limit-tombstones",
      data: {
        moods: [],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
      },
      deletedHabitIds: Array.from(
        { length: 100001 },
        (_, index) => `deleted-habit-${index}`,
      ),
    };

    try {
      await expect(importBackup(payload, "replace")).rejects.toMatchObject({
        code: "BACKUP_DELETION_HISTORY_INVALID",
      });
      expect(consumeJournalReplaceAuthorization).not.toHaveBeenCalled();
      expect(transactionSpy).not.toHaveBeenCalled();
      await expect(readImportedCollectionsSnapshot()).resolves.toEqual(
        collectionsBefore,
      );
      await expect(readDeletionTrackerSnapshot()).resolves.toEqual(
        tombstonesBefore,
      );
    } finally {
      transactionSpy.mockRestore();
    }
  });

  it("accepts exactly 100000 unique valid deletion IDs", async () => {
    const tombstones = Array.from(
      { length: 100000 },
      (_, index) => `deleted-mood-boundary-${index}`,
    );
    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-07-18T00:00:00.000Z",
      deviceId: "max-valid-tombstones",
      data: {
        moods: [],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
      },
      deletedMoodIds: tombstones,
    };

    await expect(importBackup(payload, "merge")).resolves.toMatchObject({
      mode: "merge",
    });
    expect((await getDeletedMoodIds()).size).toBe(100000);
  });

  it("requires an unlocked protected journal before replace and preserves every seeded collection", async () => {
    const localMood = {
      id: "local-mood",
      mood: "good" as const,
      date: "2026-05-24",
      timestamp: 10,
      updatedAt: 20,
    };
    const localHabit = makeTestHabit({ id: "local-habit", name: "Keep local habit" });
    const localFocus = {
      id: "local-focus",
      duration: 1500,
      completedAt: 20,
      date: "2026-05-24",
      status: "completed" as const,
      updatedAt: 20,
    };
    const localGratitude = {
      id: "local-gratitude",
      text: "Keep local gratitude",
      date: "2026-05-24",
      timestamp: 10,
      updatedAt: 20,
    };
    const localEntry = {
      id: "local-journal",
      date: "2026-05-24",
      title: "Keep local journal",
      content: "encrypted-entry:local-key:ciphertext",
      stickers: [],
      tags: ["private"],
      photoIds: ["local-photo"],
      audioIds: ["local-audio"],
      createdAt: 10,
      updatedAt: 20,
    };
    const localPhoto = {
      id: "local-photo",
      entryId: localEntry.id,
      data: "encrypted-media:local-key:photo",
      thumbnail: "encrypted-media:local-key:thumbnail",
      width: 100,
      height: 80,
      createdAt: 10,
    };
    const localAudio = {
      id: "local-audio",
      entryId: localEntry.id,
      data: "encrypted-media:local-key:audio",
      mimeType: "audio/webm",
      duration: 4,
      createdAt: 10,
    };

    await db.settings.bulkPut([
      { key: "journal_password", value: { hash: "local-verifier" } },
      { key: "mood-reminder-enabled", value: true },
    ]);
    await db.moods.put(localMood);
    await db.habits.put(localHabit);
    await db.focusSessions.put(localFocus);
    await db.gratitudeEntries.put(localGratitude);
    await db.journalEntries.put(localEntry);
    await db.journalPhotos.put(localPhoto);
    await db.journalAudio.put(localAudio);
    await db.journalHubPreferences.put({
      id: "default",
      homeView: "entries",
      visibleViews: ["entries", "spaces"],
      dockActions: ["write"],
      density: "balanced",
      motion: "system",
      background: "clean",
      updatedAt: 20,
    });
    await db.journalSpaces.put({
      id: "local-space",
      name: "Keep local space",
      iconKey: "folder",
      accent: "primary",
      private: true,
      sortOrder: 0,
      createdAt: 10,
      updatedAt: 20,
    });
    await db.journalPracticeSessions.put({
      id: "local-practice",
      practiceId: "reflection",
      entryId: localEntry.id,
      startedAt: 10,
      completedAt: 20,
    });
    await db.journalEntryLinks.put({
      id: "local-link",
      entryId: localEntry.id,
      targetType: "space",
      targetId: "local-space",
      createdAt: 10,
    });
    await db.journalSpaceCaptures.put({
      id: "local-capture",
      spaceId: "local-space",
      spaceName: "Keep local space",
      mode: "reflection",
      title: "Keep local capture",
      fields: [{ prompt: "Prompt", value: "Private answer" }],
      date: "2026-05-24",
      createdAt: 10,
      updatedAt: 20,
      entryId: localEntry.id,
    });
    await mergeDeletedHabitIds(["existing-local-tombstone"]);

    const snapshot = {
      moods: await db.moods.toArray(),
      habits: await db.habits.toArray(),
      focusSessions: await db.focusSessions.toArray(),
      gratitudeEntries: await db.gratitudeEntries.toArray(),
      settings: await db.settings.toArray(),
      journalEntries: await db.journalEntries.toArray(),
      journalPhotos: await db.journalPhotos.toArray(),
      journalAudio: await db.journalAudio.toArray(),
      journalHubPreferences: await db.journalHubPreferences.toArray(),
      journalSpaces: await db.journalSpaces.toArray(),
      journalPracticeSessions: await db.journalPracticeSessions.toArray(),
      journalEntryLinks: await db.journalEntryLinks.toArray(),
      journalSpaceCaptures: await db.journalSpaceCaptures.toArray(),
    };

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
      deletedHabitIds: ["remote-delete-must-not-merge"],
    };

    const tombstonesBefore = await getDeletedHabitIds();
    const transactionSpy = vi.spyOn(db, "transaction");
    let importError: unknown;
    try {
      await importBackup(payload, "replace");
    } catch (error) {
      importError = error;
    }

    expect(importError).toMatchObject({ code: "JOURNAL_UNLOCK_REQUIRED" });
    expect(transactionSpy).not.toHaveBeenCalled();
    await expect(db.moods.toArray()).resolves.toEqual(snapshot.moods);
    await expect(db.habits.toArray()).resolves.toEqual(snapshot.habits);
    await expect(db.focusSessions.toArray()).resolves.toEqual(snapshot.focusSessions);
    await expect(db.gratitudeEntries.toArray()).resolves.toEqual(snapshot.gratitudeEntries);
    await expect(db.settings.toArray()).resolves.toEqual(snapshot.settings);
    await expect(db.journalEntries.toArray()).resolves.toEqual(snapshot.journalEntries);
    await expect(db.journalPhotos.toArray()).resolves.toEqual(snapshot.journalPhotos);
    await expect(db.journalAudio.toArray()).resolves.toEqual(snapshot.journalAudio);
    await expect(db.journalHubPreferences.toArray()).resolves.toEqual(
      snapshot.journalHubPreferences
    );
    await expect(db.journalSpaces.toArray()).resolves.toEqual(snapshot.journalSpaces);
    await expect(db.journalPracticeSessions.toArray()).resolves.toEqual(
      snapshot.journalPracticeSessions
    );
    await expect(db.journalEntryLinks.toArray()).resolves.toEqual(snapshot.journalEntryLinks);
    await expect(db.journalSpaceCaptures.toArray()).resolves.toEqual(snapshot.journalSpaceCaptures);
    await expect(getDeletedHabitIds()).resolves.toEqual(tombstonesBefore);
    transactionSpy.mockRestore();
  });

  it("blocks replace for a locked vault-only journal before clearing local data", async () => {
    const localHabit = makeTestHabit({ id: "vault-only-habit", name: "Keep vault-only data" });
    const localEntry = {
      id: "vault-only-journal",
      date: "2026-05-24",
      title: "Keep vault-only journal",
      content: "encrypted-entry:remote-key:ciphertext",
      stickers: [],
      tags: [],
      photoIds: [],
      audioIds: [],
      createdAt: 10,
      updatedAt: 20,
    };
    await db.settings.put({
      key: "journal_vault_key",
      value: { wrappedKey: "synced-wrapped-key", createdAt: 10, updatedAt: 20 },
    });
    await db.habits.put(localHabit);
    await db.journalEntries.put(localEntry);

    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-05-25T10:00:00.000Z",
      deviceId: "device-remote",
      data: {
        moods: [],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [],
        journalPhotos: [],
        journalAudio: [],
      },
    };

    await expect(importBackup(payload, "replace")).rejects.toMatchObject({
      code: "JOURNAL_UNLOCK_REQUIRED",
    });
    await expect(db.habits.toArray()).resolves.toEqual([localHabit]);
    await expect(db.journalEntries.toArray()).resolves.toEqual([localEntry]);
  });

  it("keeps locked merge non-destructive while accepting safe non-journal collections", async () => {
    const localEntry = {
      id: "locked-merge-local",
      date: "2026-05-24",
      title: "Keep locked merge journal",
      content: "encrypted-entry:local-key:ciphertext",
      stickers: [],
      tags: [],
      photoIds: [],
      audioIds: [],
      createdAt: 10,
      updatedAt: 20,
    };
    const incomingHabit = makeTestHabit({ id: "locked-merge-habit", name: "Safe habit" });
    await db.settings.put({ key: "journal_password", value: { hash: "local-verifier" } });
    await db.journalEntries.put(localEntry);

    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-05-25T10:00:00.000Z",
      deviceId: "device-remote",
      data: {
        moods: [],
        habits: [incomingHabit],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [
          {
            id: "locked-merge-plaintext",
            date: "2026-05-25",
            title: "Unsafe while locked",
            content: "plaintext must not be stored while locked",
            stickers: [],
            tags: [],
            photoIds: [],
            audioIds: [],
            createdAt: 30,
            updatedAt: 30,
          },
        ],
        journalPhotos: [],
        journalAudio: [],
      },
    };

    const report = await importBackup(payload, "merge");

    await expect(db.habits.get(incomingHabit.id)).resolves.toEqual(incomingHabit);
    await expect(db.journalEntries.get(localEntry.id)).resolves.toEqual(localEntry);
    await expect(db.journalEntries.get("locked-merge-plaintext")).resolves.toBeUndefined();
    expect(report.journalEntries).toEqual({ added: 0, updated: 0, skipped: 1 });
  });

  it("requires unlock before merge can authenticate incoming encrypted diary audio", async () => {
    const localEntry = {
      id: "locked-encrypted-local",
      date: "2026-05-24",
      title: "Keep local diary",
      content: "encrypted-entry:local-key:ciphertext",
      stickers: [],
      tags: [],
      photoIds: [],
      audioIds: [],
      createdAt: 10,
      updatedAt: 20,
    };
    const incomingHabit = makeTestHabit({
      id: "locked-encrypted-habit",
      name: "Do not partially import",
    });
    await db.settings.put({ key: "journal_password", value: { hash: "local-verifier" } });
    await db.journalEntries.put(localEntry);

    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-05-25T10:00:00.000Z",
      deviceId: "device-remote",
      data: {
        moods: [],
        habits: [incomingHabit],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [
          {
            id: "locked-encrypted-incoming",
            date: "2026-05-25",
            title: "Protected import",
            content: "encrypted-entry:foreign-key:ciphertext",
            stickers: [],
            tags: [],
            photoIds: [],
            audioIds: ["locked-encrypted-audio"],
            createdAt: 30,
            updatedAt: 30,
          },
        ],
        journalPhotos: [],
        journalAudio: [
          {
            id: "locked-encrypted-audio",
            entryId: "locked-encrypted-incoming",
            data: "encrypted-media:foreign-key:ciphertext",
            mimeType: "audio/webm",
            duration: 1,
            createdAt: 30,
          },
        ],
      },
    };

    await expect(importBackup(payload, "merge")).rejects.toMatchObject({
      code: "JOURNAL_UNLOCK_REQUIRED",
    });
    await expect(db.habits.get(incomingHabit.id)).resolves.toBeUndefined();
    await expect(db.journalEntries.toArray()).resolves.toEqual([localEntry]);
    await expect(db.journalAudio.count()).resolves.toBe(0);
  });

  it("preserves journal collections when a legacy Replace payload never contained them", async () => {
    const localEntry = {
      id: "legacy-replace-local-journal",
      date: "2026-05-24",
      title: "Keep legacy journal",
      content: "A legacy backup has no journal fields.",
      stickers: [],
      tags: [],
      photoIds: ["legacy-replace-photo"],
      audioIds: ["legacy-replace-audio"],
      createdAt: 10,
      updatedAt: 20,
    };
    const localPhoto = {
      id: "legacy-replace-photo",
      entryId: localEntry.id,
      data: "data:image/jpeg;base64,local",
      thumbnail: "data:image/jpeg;base64,local-thumb",
      width: 100,
      height: 80,
      createdAt: 10,
    };
    const localAudio = {
      id: "legacy-replace-audio",
      entryId: localEntry.id,
      data: "data:audio/webm;base64,local",
      mimeType: "audio/webm",
      duration: 1,
      createdAt: 10,
    };
    await db.journalEntries.put(localEntry);
    await db.journalPhotos.put(localPhoto);
    await db.journalAudio.put(localAudio);

    const legacyPayload: BackupPayloadV1 = {
      schemaVersion: 1,
      exportedAt: "2026-05-25T10:00:00.000Z",
      data: {
        moods: [],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
      },
    };

    await importBackup(legacyPayload, "replace");

    await expect(db.journalEntries.toArray()).resolves.toEqual([localEntry]);
    await expect(db.journalPhotos.toArray()).resolves.toEqual([localPhoto]);
    await expect(db.journalAudio.toArray()).resolves.toEqual([localAudio]);
  });

  it("keeps existing entries addressable when partial V3 Replace contains only journal media", async () => {
    const localEntry = {
      id: "partial-v3-existing-entry",
      date: "2026-05-24",
      title: "Existing entry",
      content: "The partial backup adds media to this entry.",
      stickers: [],
      tags: [],
      photoIds: [],
      audioIds: [],
      createdAt: 10,
      updatedAt: 20,
    };
    const incomingPhoto = {
      id: "partial-v3-photo",
      entryId: localEntry.id,
      data: "data:image/jpeg;base64,incoming",
      thumbnail: "data:image/jpeg;base64,incoming-thumb",
      width: 100,
      height: 80,
      createdAt: 30,
    };
    await db.journalEntries.put(localEntry);

    const partialPayload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-05-25T10:00:00.000Z",
      deviceId: "device-test",
      data: {
        moods: [],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalPhotos: [incomingPhoto],
      },
    };

    await importBackup(partialPayload, "replace");

    await expect(db.journalEntries.get(localEntry.id)).resolves.toEqual(localEntry);
    await expect(db.journalPhotos.get(incomingPhoto.id)).resolves.toEqual(incomingPhoto);
  });

  it.each(["moods", "settings", "journalEntries"] as const)(
    "rejects a non-array %s collection before mutating local data",
    async (collection) => {
      const seededMood = { id: "seeded-mood", timestamp: 1 };
      const seededSetting = { key: "seeded-setting", value: "keep" };
      const seededEntry = {
        id: "seeded-entry",
        date: "2026-05-24",
        title: "Keep",
        content: "Keep",
        stickers: [],
        tags: [],
        photoIds: [],
        audioIds: [],
        createdAt: 1,
        updatedAt: 1,
      };
      await db.moods.put(seededMood as any);
      await db.settings.put(seededSetting);
      await db.journalEntries.put(seededEntry);

      const malformed = {
        schemaVersion: 3,
        createdAt: "2026-05-25T10:00:00.000Z",
        deviceId: "device-test",
        data: {
          moods: [],
          habits: [],
          focusSessions: [],
          gratitudeEntries: [],
          settings: [],
          journalEntries: [],
          journalPhotos: [],
          journalAudio: [],
          [collection]: { not: "an array" },
        },
      };

      await expect(importBackup(malformed as any, "replace")).rejects.toThrow(
        new RegExp(collection, "i")
      );
      await expect(db.moods.toArray()).resolves.toEqual([seededMood]);
      await expect(db.settings.get(seededSetting.key)).resolves.toEqual(seededSetting);
      await expect(db.journalEntries.get(seededEntry.id)).resolves.toEqual(seededEntry);
    }
  );

  it("skips malformed journal rows instead of writing broken backup data", async () => {
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
            id: "journal-bad-arrays",
            date: "2026-05-25",
            title: "Bad arrays",
            content: "This row should not be imported",
            stickers: "not-an-array",
            tags: "not-an-array",
            photoIds: [],
            createdAt: 1,
            updatedAt: 2,
          } as any,
        ],
        journalPhotos: [],
        journalAudio: [],
      },
    };

    const report = await importBackup(payload, "replace");

    await expect(db.journalEntries.get("journal-bad-arrays")).resolves.toBeUndefined();
    expect(report.journalEntries).toEqual({ added: 0, updated: 0, skipped: 1 });
  });

  it("normalizes diary visual state from a full backup before persistence", async () => {
    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-07-13T00:00:00.000Z",
      deviceId: "device-visual-state",
      data: {
        moods: [],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [
          {
            id: "journal-visual-state",
            date: "2026-07-13",
            title: "Imported visual state",
            content: "The entry remains readable.",
            stickers: [],
            tags: [],
            photoIds: ["photo-linked"],
            createdAt: 1,
            updatedAt: 2,
            theme: "unknown-theme",
            font: "missing-font",
            inkColor: "javascript:alert(1)",
            paperTexture: "plastic",
            bgPattern: "unknown-pattern",
            paperColor: "neon",
            bgIntensity: "maximum",
            particleSpeed: "fast",
            fontSize: "huge",
            photoLayout: {
              "photo-linked": { x: 150, y: -20, width: 900 },
              "photo-orphan": { x: 20, y: 30, width: 200 },
            },
          } as any,
        ],
        journalPhotos: [],
        journalAudio: [],
      },
    };

    await importBackup(payload, "replace");

    await expect(db.journalEntries.get("journal-visual-state")).resolves.toMatchObject({
      title: "Imported visual state",
      photoIds: [],
    });
    const imported = await db.journalEntries.get("journal-visual-state");
    expect(imported).not.toHaveProperty("photoLayout");
    expect(imported).not.toHaveProperty("theme");
    expect(imported).not.toHaveProperty("font");
    expect(imported).not.toHaveProperty("inkColor");
    expect(imported).not.toHaveProperty("paperTexture");
    expect(imported).not.toHaveProperty("bgPattern");
    expect(imported).not.toHaveProperty("paperColor");
    expect(imported).not.toHaveProperty("bgIntensity");
    expect(imported).not.toHaveProperty("particleSpeed");
    expect(imported).not.toHaveProperty("fontSize");
  });

  it("keeps imported photo references, media, and layout within the shared five-photo limit", async () => {
    const photoIds = Array.from({ length: 6 }, (_, index) => `photo-${index + 1}`);
    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-07-13T00:00:00.000Z",
      deviceId: "device-photo-limit",
      data: {
        moods: [],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [
          {
            id: "journal-photo-limit",
            date: "2026-07-13",
            title: "Imported photo limit",
            content: "The first five linked photos stay consistent.",
            stickers: [],
            tags: [],
            photoIds,
            createdAt: 1,
            updatedAt: 2,
            photoLayout: Object.fromEntries(
              photoIds.map((photoId, index) => [
                photoId,
                { x: index * 10, y: index * 12, width: 220 },
              ])
            ),
          },
        ],
        journalPhotos: photoIds.map((photoId, index) => ({
          id: photoId,
          entryId: "journal-photo-limit",
          data: `data:image/jpeg;base64,full-${index + 1}`,
          thumbnail: `data:image/jpeg;base64,thumb-${index + 1}`,
          width: 1200,
          height: 800,
          createdAt: index + 1,
        })),
        journalAudio: [],
      },
    };

    const report = await importBackup(payload, "replace");

    const expectedPhotoIds = photoIds.slice(0, 5);
    const importedEntry = await db.journalEntries.get("journal-photo-limit");
    expect(importedEntry?.photoIds).toEqual(expectedPhotoIds);
    expect(Object.keys(importedEntry?.photoLayout ?? {})).toEqual(expectedPhotoIds);
    await expect(db.journalPhotos.toCollection().primaryKeys()).resolves.toEqual(expectedPhotoIds);
    expect(report.journalPhotos).toEqual({ added: 5, updated: 0, skipped: 1 });
  });

  it("skips orphan journal media that does not point to a valid imported or local entry", async () => {
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
        journalEntries: [],
        journalPhotos: [
          {
            id: "photo-orphan",
            entryId: "missing-entry",
            data: "data:image/jpeg;base64,abc",
            thumbnail: "data:image/jpeg;base64,thumb",
            width: 100,
            height: 80,
            createdAt: 1,
          },
        ],
        journalAudio: [
          {
            id: "audio-orphan",
            entryId: "missing-entry",
            data: "data:audio/webm;base64,abc",
            mimeType: "audio/webm",
            duration: 1,
            createdAt: 1,
          },
        ],
      },
    };

    const report = await importBackup(payload, "replace");

    await expect(db.journalPhotos.get("photo-orphan")).resolves.toBeUndefined();
    await expect(db.journalAudio.get("audio-orphan")).resolves.toBeUndefined();
    expect(report.journalPhotos).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect(report.journalAudio).toEqual({ added: 0, updated: 0, skipped: 1 });
  });

  it("rejects unsafe audio and imports only referenced rows within the entry limit", async () => {
    const audioIds = ["audio-one", "audio-two", "audio-three", "audio-four"];
    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-05-11T10:01:00.000Z",
      deviceId: "device-audio-validation",
      data: {
        moods: [],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [{
          id: "journal-audio-validation",
          date: "2026-05-11",
          title: "Imported",
          content: "Imported entry",
          stickers: [],
          tags: [],
          photoIds: [],
          audioIds: [...audioIds, "audio-unsafe"],
          createdAt: 1,
          updatedAt: 1,
        }],
        journalPhotos: [],
        journalAudio: [
          ...audioIds.map((id, index) => ({
            id,
            entryId: "journal-audio-validation",
            data: "data:audio/webm;base64,YQ==",
            mimeType: "audio/webm",
            duration: 1,
            createdAt: index + 1,
          })),
          {
            id: "audio-unsafe",
            entryId: "journal-audio-validation",
            data: "https://example.invalid/private-audio",
            mimeType: "audio/webm",
            duration: 1,
            createdAt: 9,
          },
          {
            id: "audio-unreferenced",
            entryId: "journal-audio-validation",
            data: "data:audio/webm;base64,YQ==",
            mimeType: "audio/webm",
            duration: 1,
            createdAt: 10,
          },
        ],
      },
    };

    const report = await importBackup(payload, "replace");

    await expect(db.journalEntries.get("journal-audio-validation")).resolves.toMatchObject({
      audioIds: audioIds.slice(0, 3),
    });
    await expect(db.journalAudio.toCollection().primaryKeys()).resolves.toEqual(
      expect.arrayContaining(audioIds.slice(0, 3)),
    );
    await expect(db.journalAudio.count()).resolves.toBe(3);
    expect(report.journalAudio).toEqual({ added: 3, updated: 0, skipped: 3 });
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

  it("waits for password activation before deciding how imported diary content is stored", async () => {
    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-07-11T00:00:00.000Z",
      deviceId: "device-security-race",
      data: {
        moods: [],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [
          {
            id: "journal-during-password-activation",
            date: "2026-07-11",
            title: "Imported during activation",
            content: "private plaintext",
            stickers: [],
            tags: [],
            photoIds: [],
            audioIds: [],
            createdAt: 1,
            updatedAt: 2,
          },
        ],
        journalPhotos: [],
        journalAudio: [],
      },
    };

    let releaseActivation!: () => void;
    const activationGate = new Promise<void>((resolve) => {
      releaseActivation = resolve;
    });
    let markActivationEntered!: () => void;
    const activationEntered = new Promise<void>((resolve) => {
      markActivationEntered = resolve;
    });
    const activation = runWithJournalSecurityWriteLock(async () => {
      markActivationEntered();
      await activationGate;
      backupCryptoMocks.vaultKey = "activated-vault-key";
      await db.settings.put({
        key: "journal_vault_key",
        value: { wrappedKey: "wrapped", createdAt: 1, updatedAt: 2 },
      });
    });

    await activationEntered;
    let importSettled = false;
    const imported = importBackup(payload, "merge").finally(() => {
      importSettled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const settledBeforeActivationCompleted = importSettled;

    releaseActivation();
    await activation;
    await imported;

    expect(settledBeforeActivationCompleted).toBe(false);
    await expect(
      db.journalEntries.get("journal-during-password-activation")
    ).resolves.toMatchObject({
      content: "encrypted-entry:activated-vault-key:private plaintext",
    });
  });

  it("keeps an import transaction active across a delayed owner check", async () => {
    backupOwnerMocks.validateSyncOwner.mockImplementation(async (expectedOwnerUserId?: string) => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      return expectedOwnerUserId ?? null;
    });
    const remoteMood = {
      id: "owner-checked-mood",
      mood: "good" as const,
      date: "2026-07-11",
      timestamp: 1,
      updatedAt: 2,
    };
    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-07-11T00:00:00.000Z",
      deviceId: "device-owner-check",
      data: {
        moods: [remoteMood],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [],
        journalPhotos: [],
        journalAudio: [],
      },
    };

    await importBackup(payload, "replace", { expectedOwnerUserId: "owner-a" });

    await expect(db.moods.get(remoteMood.id)).resolves.toMatchObject({
      id: remoteMood.id,
      mood: remoteMood.mood,
      date: remoteMood.date,
      timestamp: remoteMood.timestamp,
    });
  });

  it("rolls back every imported row when the owner changes before commit", async () => {
    const localMood = {
      id: "local-before-owner-change",
      mood: "okay" as const,
      date: "2026-07-10",
      timestamp: 1,
      updatedAt: 2,
    };
    const remoteMood = {
      id: "remote-after-owner-change",
      mood: "good" as const,
      date: "2026-07-11",
      timestamp: 3,
      updatedAt: 4,
    };
    await db.moods.put(localMood);

    let ownerChanged = false;
    backupOwnerMocks.validateSyncOwner.mockImplementation(async (expectedOwnerUserId?: string) => {
      if (!ownerChanged) return expectedOwnerUserId ?? null;
      await new Promise((resolve) => setTimeout(resolve, 0));
      throw new Error("owner changed during import");
    });
    const markOwnerChanged = () => {
      ownerChanged = true;
    };
    db.moods.hook("creating", markOwnerChanged);

    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-07-11T00:00:00.000Z",
      deviceId: "device-owner-rollback",
      data: {
        moods: [remoteMood],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [],
        journalPhotos: [],
        journalAudio: [],
      },
    };

    try {
      await expect(
        importBackup(payload, "replace", { expectedOwnerUserId: "owner-a" })
      ).rejects.toThrow("owner changed during import");
    } finally {
      db.moods.hook("creating").unsubscribe(markOwnerChanged);
    }

    await expect(db.moods.toArray()).resolves.toEqual([localMood]);
  });

  it("rolls back a local-only import when its verified realm changes during the transaction", async () => {
    const localMood = {
      id: "local-before-realm-change",
      mood: "okay" as const,
      date: "2026-07-10",
      timestamp: 1,
      updatedAt: 2,
    };
    const remoteMood = {
      id: "remote-after-realm-change",
      mood: "good" as const,
      date: "2026-07-11",
      timestamp: 3,
      updatedAt: 4,
    };
    await db.moods.put(localMood);

    let realmCurrent = true;
    const assertExternalOwnerRealmCurrent = vi.fn(async () => {
      if (!realmCurrent) throw new Error("local realm changed during import");
    });
    const markRealmChanged = () => {
      realmCurrent = false;
    };
    db.moods.hook("creating", markRealmChanged);

    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-07-11T00:00:00.000Z",
      deviceId: "device-local-realm-rollback",
      data: {
        moods: [remoteMood],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [],
        journalPhotos: [],
        journalAudio: [],
      },
    };

    try {
      await expect(
        importBackup(payload, "replace", { assertExternalOwnerRealmCurrent }),
      ).rejects.toThrow("local realm changed during import");
    } finally {
      db.moods.hook("creating").unsubscribe(markRealmChanged);
    }

    expect(assertExternalOwnerRealmCurrent).toHaveBeenCalled();
    await expect(db.moods.toArray()).resolves.toEqual([localMood]);
  });

  it("aborts a local-only import when its realm is invalidated after the final assertion but before commit", async () => {
    const localMood = {
      id: "local-before-commit-invalidation",
      mood: "okay" as const,
      date: "2026-07-10",
      timestamp: 1,
      updatedAt: 2,
    };
    const remoteMood = {
      id: "remote-before-commit-invalidation",
      mood: "good" as const,
      date: "2026-07-11",
      timestamp: 3,
      updatedAt: 4,
    };
    await db.moods.put(localMood);

    let invalidateRealm: (() => void) | null = null;
    const unsubscribe = vi.fn();
    const subscribeOwnerRealmInvalidation = vi.fn((listener: () => void) => {
      invalidateRealm = listener;
      return unsubscribe;
    });
    let externalAssertionCount = 0;
    const assertExternalOwnerRealmCurrent = vi.fn(async () => {
      externalAssertionCount += 1;
      if (externalAssertionCount === 4) {
        queueMicrotask(() => invalidateRealm?.());
      }
    });
    const assertDataOwnerRealmCurrent = vi.fn(async () => undefined);
    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-07-11T00:00:00.000Z",
      deviceId: "device-commit-invalidation",
      data: {
        moods: [remoteMood],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [],
        journalPhotos: [],
        journalAudio: [],
      },
    };

    await expect(
      importBackup(payload, "replace", {
        assertExternalOwnerRealmCurrent,
        assertDataOwnerRealmCurrent,
        subscribeOwnerRealmInvalidation,
      }),
    ).rejects.toBeDefined();

    expect(externalAssertionCount).toBe(4);
    expect(subscribeOwnerRealmInvalidation).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    await expect(db.moods.toArray()).resolves.toEqual([localMood]);
  });

  it("exports portable journal media when legacy storage paths do not match encryption state", async () => {
    backupCryptoMocks.vaultKey = "vault-key-1";
    await db.journalEntries.put({
      id: "journal-live",
      date: "2026-06-17",
      title: "Live",
      content: "saved",
      stickers: [],
      tags: [],
      photoIds: ["photo-encrypted-old-path", "photo-plain-old-encrypted-path"],
      audioIds: ["audio-encrypted-old-path", "audio-plain-old-encrypted-path"],
      createdAt: 1,
      updatedAt: 2,
    });
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

    const backup = await exportPortableBackup();

    expect(backup.data.journalPhotos?.map((photo) => photo.data)).toEqual([
      "data:image/jpeg;base64,photo",
      "data:image/jpeg;base64,photo",
    ]);
    expect(backup.data.journalAudio?.map((audio) => audio.data)).toEqual([
      "data:audio/webm;base64,voice",
      "data:audio/webm;base64,voice",
    ]);
    expect(backup.data.journalPhotos?.every((photo) => !photo.storagePath)).toBe(true);
    expect(backup.data.journalAudio?.every((audio) => !audio.storagePath)).toBe(true);
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

  it("excludes draft, legacy, and unreferenced journal media from backup export", async () => {
    await db.journalEntries.put({
      id: "journal-saved",
      date: "2026-06-17",
      title: "Saved",
      content: "saved",
      stickers: [],
      tags: [],
      photoIds: ["photo-saved"],
      audioIds: ["audio-saved"],
      createdAt: 1,
      updatedAt: 2,
    });
    await db.journalPhotos.bulkAdd([
      { id: "photo-saved", entryId: "journal-saved", data: "x", thumbnail: "x", createdAt: 1 },
      {
        id: "photo-unreferenced",
        entryId: "journal-saved",
        data: "x",
        thumbnail: "x",
        createdAt: 1,
      },
      { id: "photo-draft", entryId: "__draft__:new", data: "x", thumbnail: "x", createdAt: 1 },
      { id: "photo-legacy", entryId: "__draft__", data: "x", thumbnail: "x", createdAt: 1 },
    ] as any[]);
    await db.journalAudio.bulkAdd([
      {
        id: "audio-saved",
        entryId: "journal-saved",
        data: "x",
        mimeType: "audio/webm",
        duration: 1,
        createdAt: 1,
      },
      {
        id: "audio-unreferenced",
        entryId: "journal-saved",
        data: "x",
        mimeType: "audio/webm",
        duration: 1,
        createdAt: 1,
      },
      {
        id: "audio-draft",
        entryId: "__draft__:new",
        data: "x",
        mimeType: "audio/webm",
        duration: 1,
        createdAt: 1,
      },
      {
        id: "audio-legacy",
        entryId: "__draft__",
        data: "x",
        mimeType: "audio/webm",
        duration: 1,
        createdAt: 1,
      },
    ]);

    const backup = await exportBackup();

    expect(backup.data.journalPhotos?.map((photo) => photo.id)).toEqual(["photo-saved"]);
    expect(backup.data.journalAudio?.map((audio) => audio.id)).toEqual(["audio-saved"]);
  });

  it("rolls back every merge collection and deletion tracker when ownership changes between the primary write and tombstone purge", async () => {
    await seedImportedCollections(makeAtomicityCollections("local", false));
    await mergeDeletedMoodIds(["local-atomic-mood-tombstone"]);
    await mergeDeletedHabitIds(["local-atomic-habit-tombstone"]);
    await mergeDeletedFocusSessionIds(["local-atomic-focus-tombstone"]);
    await mergeDeletedGratitudeIds(["local-atomic-gratitude-tombstone"]);
    await mergeDeletedJournalEntryIds(["local-atomic-journal-tombstone"]);

    const collectionsBefore = await readImportedCollectionsSnapshot();
    const trackersBefore = await readDeletionTrackerSnapshot();
    let ownerValidationCount = 0;
    backupOwnerMocks.validateSyncOwner.mockImplementation(async (expectedOwnerUserId?: string) => {
      ownerValidationCount += 1;
      if (ownerValidationCount === 4) {
        throw new Error("owner changed between backup merge phases");
      }
      return expectedOwnerUserId ?? null;
    });

    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-07-11T00:00:00.000Z",
      deviceId: "device-merge-atomicity",
      data: makeAtomicityCollections("remote", true),
      deletedMoodIds: ["remote-atomic-mood-tombstone"],
      deletedHabitIds: ["remote-atomic-habit-tombstone"],
      deletedFocusSessionIds: ["remote-atomic-focus-tombstone"],
      deletedGratitudeIds: ["remote-atomic-gratitude-tombstone"],
      deletedJournalEntryIds: ["remote-atomic-journal-tombstone"],
    };

    await expect(
      importBackup(payload, "merge", { expectedOwnerUserId: "owner-a" })
    ).rejects.toThrow("owner changed between backup merge phases");

    expect.soft(await readImportedCollectionsSnapshot()).toEqual(collectionsBefore);
    expect(await readDeletionTrackerSnapshot()).toEqual(trackersBefore);
  });

  it("rolls back a replace import when its authoritative tombstone tracker cannot be committed", async () => {
    await seedImportedCollections(makeAtomicityCollections("local", false));
    const collectionsBefore = await readImportedCollectionsSnapshot();
    const trackersBefore = await readDeletionTrackerSnapshot();
    const remoteTombstoneId = "remote-replace-habit-tombstone";
    const trackerWriteError = new Error("habit tombstone tracker write failed");
    const failHabitTrackerWrite = (primaryKey: string) => {
      if (primaryKey === DELETION_TRACKER_KEYS.habit) {
        throw trackerWriteError;
      }
    };
    db.settings.hook("creating", failHabitTrackerWrite);

    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-07-11T00:00:00.000Z",
      deviceId: "device-replace-atomicity",
      data: makeAtomicityCollections("remote", true),
      deletedHabitIds: [remoteTombstoneId],
    };

    let importError: unknown;
    try {
      try {
        await importBackup(payload, "replace");
      } catch (error) {
        importError = error;
      }

      expect.soft(importError).toBe(trackerWriteError);
      expect.soft(await readImportedCollectionsSnapshot()).toEqual(collectionsBefore);
      expect(await readDeletionTrackerSnapshot()).toEqual(trackersBefore);
    } finally {
      db.settings.hook("creating").unsubscribe(failHabitTrackerWrite);
      // Prove the failed write did not poison a later real merge, then remove
      // the persisted test row so this fault-injection case stays isolated.
      await mergeDeletedHabitIds([remoteTombstoneId]);
      await db.settings.delete(DELETION_TRACKER_KEYS.habit);
    }
  });

  it("reports merge counts from rows that remain committed after tombstone precedence", async () => {
    const tombstoned = makeAtomicityCollections("remote", true);
    const moodId = tombstoned.moods[0].id;
    const habitId = tombstoned.habits[0].id;
    const focusId = tombstoned.focusSessions[0].id;
    const gratitudeId = tombstoned.gratitudeEntries[0].id;
    const journalEntryId = tombstoned.journalEntries?.[0].id;
    if (!journalEntryId) throw new Error("Atomicity fixture must contain a journal entry");

    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-07-11T00:00:00.000Z",
      deviceId: "device-report-tombstone-counts",
      data: {
        ...tombstoned,
        settings: [],
      },
      deletedMoodIds: [moodId],
      deletedHabitIds: [habitId],
      deletedFocusSessionIds: [focusId],
      deletedGratitudeIds: [gratitudeId],
      deletedJournalEntryIds: [journalEntryId],
    };

    const report = await importBackup(payload, "merge");

    await expect(db.moods.toArray()).resolves.toEqual([]);
    await expect(db.habits.toArray()).resolves.toEqual([]);
    await expect(db.focusSessions.toArray()).resolves.toEqual([]);
    await expect(db.gratitudeEntries.toArray()).resolves.toEqual([]);
    await expect(db.journalEntries.toArray()).resolves.toEqual([]);
    await expect(db.journalPhotos.toArray()).resolves.toEqual([]);
    await expect(db.journalAudio.toArray()).resolves.toEqual([]);
    expect.soft(report.moods).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect.soft(report.habits).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect.soft(report.focusSessions).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect.soft(report.gratitudeEntries).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect.soft(report.journalEntries).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect.soft(report.journalPhotos).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect(report.journalAudio).toEqual({ added: 0, updated: 0, skipped: 1 });
  });
});
