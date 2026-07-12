import { beforeEach, describe, expect, it, vi } from "vitest";

const cryptoState = vi.hoisted(() => ({
  vaultKey: null as string | null,
  blockFirstMediaEncryption: false,
  mediaEncryptionCalls: 0,
  activeMediaEncryptions: 0,
  maxActiveMediaEncryptions: 0,
  firstMediaEncryptionStarted: null as (() => void) | null,
  mediaEncryptionGate: null as Promise<void> | null,
}));

const contentPrefix = (key: string) => `encrypted-entry:${key}:`;
const mediaPrefix = (key: string) => `encrypted-media:${key}:`;

vi.mock("@/lib/journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => cryptoState.vaultKey),
  consumeJournalReplaceAuthorization: vi.fn(() => true),
}));

vi.mock("@/features/journal/journalCrypto", () => ({
  encryptJournalContent: vi.fn((content: string, key: string) =>
    Promise.resolve(`${contentPrefix(key)}${content}`),
  ),
  decryptJournalContentIfNeeded: vi.fn((content: string, key: string) => {
    if (!content.startsWith("encrypted-entry:")) return Promise.resolve(content);
    const prefix = contentPrefix(key);
    if (!content.startsWith(prefix)) return Promise.reject(new Error("wrong journal key"));
    return Promise.resolve(content.slice(prefix.length));
  }),
  isEncryptedJournalContent: vi.fn((content: string) =>
    content.startsWith("encrypted-entry:"),
  ),
}));

vi.mock("@/features/journal/journalMediaCrypto", () => ({
  encryptJournalMediaDataUrl: vi.fn(async (dataUrl: string, key: string) => {
    cryptoState.mediaEncryptionCalls += 1;
    cryptoState.activeMediaEncryptions += 1;
    cryptoState.maxActiveMediaEncryptions = Math.max(
      cryptoState.maxActiveMediaEncryptions,
      cryptoState.activeMediaEncryptions,
    );
    try {
      if (cryptoState.blockFirstMediaEncryption && cryptoState.mediaEncryptionCalls === 1) {
        cryptoState.firstMediaEncryptionStarted?.();
        if (cryptoState.mediaEncryptionGate) await cryptoState.mediaEncryptionGate;
      }
      return `${mediaPrefix(key)}${dataUrl}`;
    } finally {
      cryptoState.activeMediaEncryptions -= 1;
    }
  }),
  decryptJournalMediaDataUrlIfNeeded: vi.fn((dataUrl: string, key: string | null) => {
    if (!dataUrl.startsWith("encrypted-media:")) return Promise.resolve(dataUrl);
    if (!key) return Promise.resolve("");
    const prefix = mediaPrefix(key);
    if (!dataUrl.startsWith(prefix)) return Promise.reject(new Error("wrong media key"));
    return Promise.resolve(dataUrl.slice(prefix.length));
  }),
  isEncryptedJournalMediaData: vi.fn((dataUrl: string) =>
    dataUrl.startsWith("encrypted-media:"),
  ),
  encryptedJournalMediaFromStorageDataUrl: vi.fn((dataUrl: string) =>
    dataUrl.startsWith("binary-encrypted:")
      ? `encrypted-media:${dataUrl.slice("binary-encrypted:".length)}`
      : dataUrl,
  ),
}));

import { SK } from "@/lib/storageKeys";
import { makeTestHabit } from "@/test/habitFixtures";
import type {
  JournalEntryLink,
  JournalHubPreferences,
  JournalPracticeSession,
  JournalSpace,
  JournalSpaceCapture,
} from "@/features/journal/types";
import { db } from "@/storage/db";
import {
  exportBackup,
  exportPortableBackup,
  exportPortableBackupArtifact,
  importBackup,
  type BackupPayloadV3,
} from "@/storage/backup";
import { DELETION_TRACKER_KEYS } from "@/storage/deletionTracker";

const emptyData = (): BackupPayloadV3["data"] => ({
  moods: [],
  habits: [],
  focusSessions: [],
  gratitudeEntries: [],
  settings: [],
  journalEntries: [],
  journalPhotos: [],
  journalAudio: [],
});

const makePayload = (data: BackupPayloadV3["data"]): BackupPayloadV3 => ({
  schemaVersion: 3,
  createdAt: "2026-07-11T00:00:00.000Z",
  deviceId: "backup-portability-test",
  data,
});

const hubRows: {
  preferences: JournalHubPreferences;
  space: JournalSpace;
  practice: JournalPracticeSession;
  link: JournalEntryLink;
  capture: JournalSpaceCapture;
} = {
  preferences: {
    id: "default" as const,
    homeView: "spaces" as const,
    visibleViews: ["today", "spaces"],
    dockActions: ["write", "quickNote"],
    density: "calm" as const,
    motion: "quiet" as const,
    background: "clean" as const,
    updatedAt: 101,
  },
  space: {
    id: "space-real-user",
    name: "Therapy reflections",
    description: "Private notes I want to keep",
    iconKey: "heart" as const,
    accent: "rose" as const,
    private: true,
    kind: "user" as const,
    sortOrder: 1,
    createdAt: 102,
    updatedAt: 103,
  },
  practice: {
    id: "practice-real-user",
    practiceId: "quiet-release",
    entryId: "entry-real-user",
    durationSeconds: 120,
    startedAt: 104,
    completedAt: 105,
  },
  link: {
    id: "link-real-user",
    entryId: "entry-real-user",
    targetType: "space" as const,
    targetId: "space-real-user",
    createdAt: 106,
  },
  capture: {
    id: "capture-real-user",
    spaceId: "space-real-user",
    spaceName: "Therapy reflections",
    mode: "reflection",
    title: "What helped",
    fields: [{ prompt: "What changed?", value: "I asked for support." }],
    date: "2026-07-11",
    createdAt: 107,
    updatedAt: 108,
    entryId: "entry-real-user",
  },
};

const journalEntry = {
  id: "entry-real-user",
  date: "2026-07-11",
  title: "Private entry",
  content: "A readable private thought",
  stickers: [],
  tags: [],
  photoIds: [],
  audioIds: [],
  createdAt: 100,
  updatedAt: 100,
};

describe("portable backup integrity", () => {
  beforeEach(async () => {
    cryptoState.vaultKey = null;
    cryptoState.blockFirstMediaEncryption = false;
    cryptoState.mediaEncryptionCalls = 0;
    cryptoState.activeMediaEncryptions = 0;
    cryptoState.maxActiveMediaEncryptions = 0;
    cryptoState.firstMediaEncryptionStarted = null;
    cryptoState.mediaEncryptionGate = null;
    await db.open();
    await db.transaction(
      "rw",
      [
        db.moods,
        db.habits,
        db.focusSessions,
        db.gratitudeEntries,
        db.settings,
        db.journalEntries,
        db.journalPhotos,
        db.journalAudio,
        db.journalHubPreferences,
        db.journalSpaces,
        db.journalPracticeSessions,
        db.journalEntryLinks,
        db.journalSpaceCaptures,
      ],
      async () => {
        await Promise.all([
          db.moods.clear(),
          db.habits.clear(),
          db.focusSessions.clear(),
          db.gratitudeEntries.clear(),
          db.settings.clear(),
          db.journalEntries.clear(),
          db.journalPhotos.clear(),
          db.journalAudio.clear(),
          db.journalHubPreferences.clear(),
          db.journalSpaces.clear(),
          db.journalPracticeSessions.clear(),
          db.journalEntryLinks.clear(),
          db.journalSpaceCaptures.clear(),
        ]);
      },
    );
  });

  it("keeps protected diary and Spaces ciphertext in the default cloud-safe backup", async () => {
    const vaultKey = "cloud-safe-vault-key";
    cryptoState.vaultKey = vaultKey;
    await db.settings.bulkPut([
      { key: SK.JOURNAL_PASSWORD, value: { hash: "local-password-verifier" } },
      { key: SK.JOURNAL_VAULT_KEY, value: { wrappedKey: "local-wrapped-key" } },
    ]);
    await db.journalEntries.put({
      ...journalEntry,
      content: `${contentPrefix(vaultKey)}${journalEntry.content}`,
      photoIds: ["photo-cloud-safe"],
      audioIds: ["audio-cloud-safe"],
    });
    await db.journalPhotos.put({
      id: "photo-cloud-safe",
      entryId: journalEntry.id,
      data: `${mediaPrefix(vaultKey)}data:image/jpeg;base64,cGhvdG8=`,
      thumbnail: `${mediaPrefix(vaultKey)}data:image/jpeg;base64,dGh1bWI=`,
      width: 100,
      height: 80,
      createdAt: 101,
    });
    await db.journalAudio.put({
      id: "audio-cloud-safe",
      entryId: journalEntry.id,
      data: `${mediaPrefix(vaultKey)}data:audio/webm;base64,YXVkaW8=`,
      mimeType: "audio/webm",
      duration: 1,
      createdAt: 102,
    });
    await db.journalSpaces.put({
      ...hubRows.space,
      name: `${contentPrefix(vaultKey)}${hubRows.space.name}`,
      description: `${contentPrefix(vaultKey)}${hubRows.space.description}`,
    });
    await db.journalSpaceCaptures.put({
      ...hubRows.capture,
      spaceName: `${contentPrefix(vaultKey)}${hubRows.capture.spaceName}`,
      title: `${contentPrefix(vaultKey)}${hubRows.capture.title}`,
      fields: hubRows.capture.fields.map((field) => ({
        prompt: `${contentPrefix(vaultKey)}${field.prompt}`,
        value: `${contentPrefix(vaultKey)}${field.value}`,
      })),
    });

    const backup = await exportBackup();

    expect(backup.data.journalEntries?.[0].content).toBe(
      `${contentPrefix(vaultKey)}${journalEntry.content}`,
    );
    expect(backup.data.journalPhotos?.[0].data).toBe(
      `${mediaPrefix(vaultKey)}data:image/jpeg;base64,cGhvdG8=`,
    );
    expect(backup.data.journalAudio?.[0].data).toBe(
      `${mediaPrefix(vaultKey)}data:audio/webm;base64,YXVkaW8=`,
    );
    expect(backup.data.journalSpaces?.[0].name).toBe(
      `${contentPrefix(vaultKey)}${hubRows.space.name}`,
    );
    expect(backup.data.journalSpaceCaptures?.[0].fields[0].value).toBe(
      `${contentPrefix(vaultKey)}${hubRows.capture.fields[0].value}`,
    );
    expect(backup.data.settings.map(({ key }) => key)).not.toContain(SK.JOURNAL_PASSWORD);
    expect(backup.data.settings.map(({ key }) => key)).not.toContain(SK.JOURNAL_VAULT_KEY);
  });

  it("exports protected diary rows as portable plaintext while omitting local key material", async () => {
    const vaultKey = "portable-vault-key";
    cryptoState.vaultKey = vaultKey;
    await db.settings.bulkPut([
      { key: SK.JOURNAL_PASSWORD, value: { hash: "local-password-verifier" } },
      { key: SK.JOURNAL_VAULT_KEY, value: { wrappedKey: "local-wrapped-key" } },
    ]);
    await db.journalEntries.put({
      ...journalEntry,
      content: `${contentPrefix(vaultKey)}${journalEntry.content}`,
      photoIds: ["photo-real-user"],
      audioIds: ["audio-real-user"],
    });
    await db.journalPhotos.put({
      id: "photo-real-user",
      entryId: journalEntry.id,
      data: `${mediaPrefix(vaultKey)}data:image/jpeg;base64,cGhvdG8=`,
      thumbnail: `${mediaPrefix(vaultKey)}data:image/jpeg;base64,dGh1bWI=`,
      width: 100,
      height: 80,
      createdAt: 101,
      storagePath: "owner/photo-real-user.bin",
      storageUrl: "https://storage.invalid/signed-secret",
    });
    await db.journalAudio.put({
      id: "audio-real-user",
      entryId: journalEntry.id,
      data: `${mediaPrefix(vaultKey)}data:audio/webm;base64,YXVkaW8=`,
      mimeType: "audio/webm",
      duration: 1,
      createdAt: 102,
      storagePath: "owner/audio-real-user.bin",
      storageUrl: "https://storage.invalid/signed-secret",
    });

    const backup = await exportPortableBackup();

    expect(backup.data.journalEntries?.[0].content).toBe(journalEntry.content);
    expect(backup.data.journalPhotos?.[0]).toMatchObject({
      data: "data:image/jpeg;base64,cGhvdG8=",
      thumbnail: "data:image/jpeg;base64,dGh1bWI=",
    });
    expect(backup.data.journalPhotos?.[0]).not.toHaveProperty("storagePath");
    expect(backup.data.journalPhotos?.[0]).not.toHaveProperty("storageUrl");
    expect(backup.data.journalAudio?.[0]).toMatchObject({
      data: "data:audio/webm;base64,YXVkaW8=",
    });
    expect(backup.data.journalAudio?.[0]).not.toHaveProperty("storagePath");
    expect(backup.data.journalAudio?.[0]).not.toHaveProperty("storageUrl");
    expect(backup.data.settings.map(({ key }) => key)).not.toContain(SK.JOURNAL_PASSWORD);
    expect(backup.data.settings.map(({ key }) => key)).not.toContain(SK.JOURNAL_VAULT_KEY);
  });

  it("fails closed when encrypted diary rows exist but the current session is locked", async () => {
    await db.settings.put({
      key: SK.JOURNAL_VAULT_KEY,
      value: { wrappedKey: "wrapped-but-locked" },
    });
    await db.journalEntries.put({
      ...journalEntry,
      content: "encrypted-entry:unknown-key:ciphertext",
    });

    await expect(exportPortableBackup()).rejects.toMatchObject({
      name: "BackupExportBlockedError",
      code: "JOURNAL_UNLOCK_REQUIRED",
    });
  });

  it("fails closed instead of claiming a portable backup when attached media bytes are absent", async () => {
    await db.journalEntries.put({
      ...journalEntry,
      photoIds: ["photo-without-bytes"],
    });
    await db.journalPhotos.put({
      id: "photo-without-bytes",
      entryId: journalEntry.id,
      data: "",
      thumbnail: "",
      width: 100,
      height: 80,
      createdAt: 101,
    });

    await expect(exportPortableBackup()).rejects.toMatchObject({
      name: "BackupExportBlockedError",
      code: "JOURNAL_MEDIA_UNAVAILABLE",
    });
  });

  it("rejects unreadable ciphertext instead of reporting success on an unprotected target", async () => {
    const payload = makePayload({
      ...emptyData(),
      journalEntries: [
        {
          ...journalEntry,
          content: "encrypted-entry:foreign-key:ciphertext",
        },
      ],
    });

    await expect(importBackup(payload, "replace")).rejects.toMatchObject({
      code: "JOURNAL_BACKUP_UNREADABLE",
    });
    await expect(db.journalEntries.count()).resolves.toBe(0);
  });

  it("rejects an encrypted binary media envelope on an unprotected target", async () => {
    const payload = makePayload({
      ...emptyData(),
      journalEntries: [
        {
          ...journalEntry,
          photoIds: ["photo-binary-encrypted"],
        },
      ],
      journalPhotos: [
        {
          id: "photo-binary-encrypted",
          entryId: journalEntry.id,
          data: "binary-encrypted:foreign-key:ciphertext",
          thumbnail: "binary-encrypted:foreign-key:thumbnail",
          width: 100,
          height: 80,
          createdAt: 101,
        },
      ],
    });

    await expect(importBackup(payload, "replace")).rejects.toMatchObject({
      code: "JOURNAL_BACKUP_UNREADABLE",
    });
    await expect(db.journalEntries.count()).resolves.toBe(0);
    await expect(db.journalPhotos.count()).resolves.toBe(0);
  });

  it("encrypts portable media sequentially to bound peak import memory", async () => {
    cryptoState.vaultKey = "bounded-import-vault-key";
    let markFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    cryptoState.blockFirstMediaEncryption = true;
    cryptoState.firstMediaEncryptionStarted = markFirstStarted;
    cryptoState.mediaEncryptionGate = firstGate;

    const payload = makePayload({
      ...emptyData(),
      journalEntries: [
        {
          ...journalEntry,
          photoIds: ["photo-one", "photo-two"],
          audioIds: ["audio-one"],
        },
      ],
      journalPhotos: ["photo-one", "photo-two"].map((id, index) => ({
        id,
        entryId: journalEntry.id,
        data: `data:image/jpeg;base64,cGhvdG8t${index}`,
        thumbnail: `data:image/jpeg;base64,dGh1bWIt${index}`,
        width: 100,
        height: 80,
        createdAt: 101 + index,
      })),
      journalAudio: [
        {
          id: "audio-one",
          entryId: journalEntry.id,
          data: "data:audio/webm;base64,YXVkaW8=",
          mimeType: "audio/webm",
          duration: 1,
          createdAt: 103,
        },
      ],
    });

    const importing = importBackup(payload, "merge");
    await firstStarted;
    await Promise.resolve();
    await Promise.resolve();

    expect(cryptoState.maxActiveMediaEncryptions).toBe(1);
    releaseFirst();
    await importing;
  });

  it.each(["replace", "merge"] as const)(
    "normalizes imported journal media references to rows actually committed in %s mode",
    async (mode) => {
      const payload = makePayload({
        ...emptyData(),
        journalEntries: [
          {
            ...journalEntry,
            photoIds: ["photo-valid", "photo-rejected", "photo-absent"],
            audioIds: ["audio-absent"],
          },
        ],
        journalPhotos: [
          {
            id: "photo-valid",
            entryId: journalEntry.id,
            data: "data:image/jpeg;base64,cGhvdG8=",
            thumbnail: "data:image/jpeg;base64,dGh1bWI=",
            width: 100,
            height: 80,
            createdAt: 101,
          },
          {
            id: "photo-rejected",
            entryId: journalEntry.id,
            data: "data:image/jpeg;base64,YmFk",
            thumbnail: "data:image/jpeg;base64,YmFk",
            width: "not-a-number",
            height: 80,
            createdAt: 102,
          } as never,
        ],
      });

      const report = await importBackup(payload, mode);

      await expect(db.journalEntries.get(journalEntry.id)).resolves.toMatchObject({
        photoIds: ["photo-valid"],
        audioIds: [],
      });
      expect(report.journalEntries).toEqual({ added: 1, updated: 0, skipped: 0 });
      expect(report.journalPhotos).toEqual({ added: 1, updated: 0, skipped: 1 });
      expect(report.journalAudio).toEqual({ added: 0, updated: 0, skipped: 0 });
    },
  );

  it("counts an older merge row as skipped when the newer local row remains committed", async () => {
    await db.moods.put({
      id: "mood-newer-local",
      mood: "good",
      date: "2026-07-11",
      timestamp: 200,
      updatedAt: 200,
    });
    const payload = makePayload({
      ...emptyData(),
      moods: [
        {
          id: "mood-newer-local",
          mood: "bad",
          date: "2026-07-10",
          timestamp: 100,
          updatedAt: 100,
        },
      ],
    });

    const report = await importBackup(payload, "merge");

    await expect(db.moods.get("mood-newer-local")).resolves.toMatchObject({
      mood: "good",
      updatedAt: 200,
    });
    expect(report.moods).toEqual({ added: 0, updated: 0, skipped: 1 });
  });

  it("snapshots deletion trackers in the same transaction as exported rows", async () => {
    const habit = makeTestHabit({ id: "habit-snapshot-race", name: "Snapshot race" });
    await db.habits.put(habit);
    await db.settings.put({ key: DELETION_TRACKER_KEYS.habit, value: [] });

    let mutationScheduled = false;
    let mutationPromise: Promise<void> | null = null;
    const waitForMutation = (): Promise<void> => mutationPromise ?? Promise.resolve();
    const scheduleConcurrentDelete = (row: { key?: string } | undefined) => {
      if (row?.key === DELETION_TRACKER_KEYS.habit && !mutationScheduled) {
        mutationScheduled = true;
        queueMicrotask(() => {
          mutationPromise = db.transaction("rw", [db.settings, db.habits], async () => {
            await db.settings.put({
              key: DELETION_TRACKER_KEYS.habit,
              value: [habit.id],
            });
            await db.habits.delete(habit.id);
          });
        });
      }
      return row;
    };
    db.settings.hook("reading", scheduleConcurrentDelete);

    try {
      const backup = await exportBackup();
      await waitForMutation();

      expect(mutationScheduled).toBe(true);
      const exportedHabit = backup.data.habits.some(({ id }) => id === habit.id);
      const exportedTombstone = backup.deletedHabitIds?.includes(habit.id) ?? false;
      expect(
        (exportedHabit && !exportedTombstone) || (!exportedHabit && exportedTombstone),
      ).toBe(true);
    } finally {
      db.settings.hook("reading").unsubscribe(scheduleConcurrentDelete);
      await waitForMutation();
    }
  });

  it("round-trips every real Journal Hub and Spaces table with exact reports", async () => {
    await db.journalEntries.put(journalEntry);
    await db.journalHubPreferences.put(hubRows.preferences);
    await db.journalSpaces.put(hubRows.space);
    await db.journalPracticeSessions.put(hubRows.practice);
    await db.journalEntryLinks.put(hubRows.link);
    await db.journalSpaceCaptures.put(hubRows.capture);

    const artifact = await exportPortableBackupArtifact();
    const backup = JSON.parse(artifact.json) as BackupPayloadV3;

    expect(artifact.payload).toEqual(backup);

    expect((backup.data as any).journalHubPreferences).toEqual([hubRows.preferences]);
    expect((backup.data as any).journalSpaces).toEqual([hubRows.space]);
    expect((backup.data as any).journalPracticeSessions).toEqual([hubRows.practice]);
    expect((backup.data as any).journalEntryLinks).toEqual([hubRows.link]);
    expect((backup.data as any).journalSpaceCaptures).toEqual([hubRows.capture]);

    await db.transaction(
      "rw",
      [
        db.journalEntries,
        db.journalHubPreferences,
        db.journalSpaces,
        db.journalPracticeSessions,
        db.journalEntryLinks,
        db.journalSpaceCaptures,
      ],
      async () => {
        await Promise.all([
          db.journalEntries.clear(),
          db.journalHubPreferences.clear(),
          db.journalSpaces.clear(),
          db.journalPracticeSessions.clear(),
          db.journalEntryLinks.clear(),
          db.journalSpaceCaptures.clear(),
        ]);
      },
    );

    const report = await importBackup(backup, "replace");

    await expect(db.journalHubPreferences.toArray()).resolves.toEqual([hubRows.preferences]);
    await expect(db.journalSpaces.toArray()).resolves.toEqual([hubRows.space]);
    await expect(db.journalPracticeSessions.toArray()).resolves.toEqual([hubRows.practice]);
    await expect(db.journalEntryLinks.toArray()).resolves.toEqual([hubRows.link]);
    await expect(db.journalSpaceCaptures.toArray()).resolves.toEqual([hubRows.capture]);
    expect(report).toMatchObject({
      journalHubPreferences: { added: 1, updated: 0, skipped: 0 },
      journalSpaces: { added: 1, updated: 0, skipped: 0 },
      journalPracticeSessions: { added: 1, updated: 0, skipped: 0 },
      journalEntryLinks: { added: 1, updated: 0, skipped: 0 },
      journalSpaceCaptures: { added: 1, updated: 0, skipped: 0 },
    });
  });

  it("uses the Journal Hub protection boundary without encrypting a space cover URL", async () => {
    cryptoState.vaultKey = "hub-vault-key";
    const space = {
      ...hubRows.space,
      coverImage: "https://images.invalid/user-cover.webp",
    };
    const payload = makePayload({
      ...emptyData(),
      journalSpaces: [space],
    });

    await importBackup(payload, "merge");

    await expect(db.journalSpaces.get(space.id)).resolves.toMatchObject({
      name: `${contentPrefix("hub-vault-key")}${space.name}`,
      description: `${contentPrefix("hub-vault-key")}${space.description}`,
      coverImage: space.coverImage,
    });
  });

  it("rolls back the whole replace when a Journal Hub table cannot commit", async () => {
    const localHabit = makeTestHabit({ id: "habit-local-before-hub-failure", name: "Keep" });
    await db.habits.put(localHabit);
    const failCapture = () => {
      throw new Error("space capture write failed");
    };
    db.journalSpaceCaptures.hook("creating", failCapture);
    const payload = makePayload({
      ...emptyData(),
      habits: [makeTestHabit({ id: "habit-remote-hub-failure", name: "Remote" })],
      journalEntries: [journalEntry],
      journalHubPreferences: [hubRows.preferences],
      journalSpaces: [hubRows.space],
      journalPracticeSessions: [hubRows.practice],
      journalEntryLinks: [hubRows.link],
      journalSpaceCaptures: [hubRows.capture],
    });

    try {
      await expect(importBackup(payload, "replace")).rejects.toThrow(
        "space capture write failed",
      );
      await expect(db.habits.toArray()).resolves.toEqual([localHabit]);
      await expect(db.journalHubPreferences.count()).resolves.toBe(0);
      await expect(db.journalSpaces.count()).resolves.toBe(0);
      await expect(db.journalPracticeSessions.count()).resolves.toBe(0);
      await expect(db.journalEntryLinks.count()).resolves.toBe(0);
      await expect(db.journalSpaceCaptures.count()).resolves.toBe(0);
    } finally {
      db.journalSpaceCaptures.hook("creating").unsubscribe(failCapture);
    }
  });
});
