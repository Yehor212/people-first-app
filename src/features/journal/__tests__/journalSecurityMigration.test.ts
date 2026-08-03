import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUserId: "account-a",
  enqueue: vi.fn(() => Promise.resolve()),
  syncSetting: vi.fn(() => Promise.resolve()),
  deleteSetting: vi.fn(() => Promise.resolve()),
  syncJournalEntry: vi.fn(() => Promise.resolve()),
  syncJournalPhoto: vi.fn(() => Promise.resolve()),
  syncJournalAudio: vi.fn(() => Promise.resolve()),
  uploadEncryptedPhoto: vi.fn(() =>
    Promise.resolve({ path: "account-a/photo-1.bin", signedUrl: "" })
  ),
  uploadEncryptedAudio: vi.fn(() =>
    Promise.resolve({ path: "account-a/audio-1.bin", signedUrl: "" })
  ),
  deleteStoragePath: vi.fn(() => Promise.resolve()),
  syncWithCloud: vi.fn(() => Promise.resolve({ status: "merged" })),
  encryptContent: vi.fn((value: string, key: string) =>
    Promise.resolve(`entry-enc:${key}:${value}`)
  ),
  decryptContent: vi.fn((value: string, key: string) => {
    const prefix = `entry-enc:${key}:`;
    if (!value.startsWith(prefix)) return Promise.reject(new Error("content authentication failed"));
    return Promise.resolve(value.slice(prefix.length));
  }),
  encryptMedia: vi.fn((value: string, key: string) => Promise.resolve(`media-enc:${key}:${value}`)),
  decryptMedia: vi.fn((value: string, key: string) => {
    const prefix = `media-enc:${key}:`;
    if (!value.startsWith(prefix)) return Promise.reject(new Error("media authentication failed"));
    return Promise.resolve(value.slice(prefix.length));
  }),
  vaultKey: null as string | null,
  vaultRevision: null as number | null,
}));

vi.mock("@/lib/cloudSyncSettings", () => ({ isCloudSyncEnabled: () => true }));
vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: () => Promise.resolve(mocks.currentUserId),
  getCurrentUserId: () => Promise.resolve(mocks.currentUserId),
}));
vi.mock("@/lib/offlineQueue", () => ({ offlineQueue: { enqueue: mocks.enqueue } }));
vi.mock("@/storage/sync/syncSettings", () => ({
  syncSetting: mocks.syncSetting,
  deleteSettingFromCloud: mocks.deleteSetting,
}));
vi.mock("@/storage/realtimeSync", () => ({
  syncJournalEntry: mocks.syncJournalEntry,
  syncJournalPhoto: mocks.syncJournalPhoto,
  syncJournalAudio: mocks.syncJournalAudio,
}));
vi.mock("@/storage/journalStorageService", () => ({
  uploadEncryptedPhoto: mocks.uploadEncryptedPhoto,
  uploadEncryptedAudio: mocks.uploadEncryptedAudio,
  deleteJournalMediaStoragePath: mocks.deleteStoragePath,
}));
vi.mock("@/storage/cloudSync", () => ({ syncWithCloud: mocks.syncWithCloud }));
vi.mock("../journalCrypto", () => ({
  encryptJournalContent: mocks.encryptContent,
  decryptJournalContentIfNeeded: mocks.decryptContent,
  isEncryptedJournalContent: (value: string) => value.startsWith("entry-enc:"),
}));
vi.mock("../journalMediaCrypto", () => ({
  encryptJournalMediaDataUrl: mocks.encryptMedia,
  decryptJournalMediaDataUrlIfNeeded: mocks.decryptMedia,
  isEncryptedJournalMediaData: (value: string) => value.startsWith("media-enc:"),
  encryptedJournalMediaToStorageBlob: (value: string) =>
    new Blob([value], { type: "application/octet-stream" }),
}));
vi.mock("../journalContentSession", () => ({
  getJournalContentVaultKey: () => mocks.vaultKey,
  getJournalContentVaultRevision: () => mocks.vaultRevision,
  setJournalContentVaultKey: (value: string | null, revision: number | null = null) => {
    mocks.vaultKey = value;
    mocks.vaultRevision = value ? revision : null;
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}));

import { db } from "@/storage/db";
import { SK } from "@/lib/storageKeys";
import {
  activateJournalPasswordProtection as activateJournalPasswordProtectionWithBoundary,
  captureJournalSecurityBoundary,
  ensureJournalSecurityRemovalQueued,
  getJournalSecurityMigrationIntent,
  getJournalSecurityRemovalIntent,
  removeJournalPasswordProtectionAtomically,
  removeDeletedJournalArtifactsFromSecurityMigration,
  runWithJournalSecurityBoundary,
  runJournalSecurityMigration,
} from "../journalSecurityMigration";
import { runWithJournalSecurityWriteLock } from "../journalSecurityWriteLock";

async function activateJournalPasswordProtection(
  input: Parameters<typeof activateJournalPasswordProtectionWithBoundary>[0]
): ReturnType<typeof activateJournalPasswordProtectionWithBoundary> {
  const boundary = await captureJournalSecurityBoundary();
  return activateJournalPasswordProtectionWithBoundary(input, boundary);
}

const passwordData = {
  hash: "hash",
  salt: "salt",
  iterations: 600_000,
  createdAt: 100,
};
const vaultSetting = {
  wrappedKey: "wrapped-vault-key",
  createdAt: 100,
  updatedAt: 101,
};

async function seedPlaintextDiary(): Promise<void> {
  await db.journalEntries.put({
    id: "entry-1",
    date: "2026-07-10",
    title: "Private",
    content: "plaintext entry",
    stickers: [],
    tags: [],
    photoIds: ["photo-1"],
    audioIds: ["audio-1"],
    createdAt: 1,
    updatedAt: 1,
  });
  await db.journalPhotos.put({
    id: "photo-1",
    entryId: "entry-1",
    data: "data:image/jpeg;base64,plain",
    thumbnail: "data:image/jpeg;base64,thumb",
    width: 100,
    height: 80,
    createdAt: 1,
    storagePath: "account-a/photo-1.jpg",
  });
  await db.journalAudio.put({
    id: "audio-1",
    entryId: "entry-1",
    data: "data:audio/webm;base64,plain",
    duration: 10,
    mimeType: "audio/webm",
    createdAt: 1,
    storagePath: "account-a/audio-1.webm",
  });
}

async function seedPlaintextDraftAndSpaces(): Promise<void> {
  await db.settings.put({
    key: SK.journalDraft("new"),
    value: {
      title: "Draft title",
      date: "2026-07-11",
      content: "Private draft body",
      stickers: [],
      photoIds: [],
      tags: [],
      savedAt: 1,
    },
  });
  await db.journalSpaces.put({
    id: "space-private-project",
    name: "Private project",
    description: "Custom private description",
    iconKey: "folder",
    accent: "violet",
    private: true,
    kind: "user",
    sortOrder: 10,
    createdAt: 1,
    updatedAt: 1,
  });
  await db.journalSpaceCaptures.put({
    id: "capture-private-project",
    spaceId: "space-private-project",
    spaceName: "Private project",
    mode: "guided",
    title: "Secret capture title",
    fields: [{ prompt: "Private prompt", value: "Private captured answer" }],
    date: "2026-07-11",
    createdAt: 1,
    updatedAt: 1,
  });
}

describe("journal password protection migration", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.currentUserId = "account-a";
    mocks.vaultKey = null;
    mocks.vaultRevision = null;
    mocks.enqueue.mockResolvedValue(undefined);
    mocks.encryptContent.mockImplementation((value: string, key: string) =>
      Promise.resolve(`entry-enc:${key}:${value}`)
    );
    mocks.encryptMedia.mockImplementation((value: string, key: string) =>
      Promise.resolve(`media-enc:${key}:${value}`)
    );
    mocks.decryptContent.mockImplementation((value: string, key: string) => {
      const prefix = `entry-enc:${key}:`;
      if (!value.startsWith(prefix)) return Promise.reject(new Error("content authentication failed"));
      return Promise.resolve(value.slice(prefix.length));
    });
    mocks.decryptMedia.mockImplementation((value: string, key: string) => {
      const prefix = `media-enc:${key}:`;
      if (!value.startsWith(prefix)) return Promise.reject(new Error("media authentication failed"));
      return Promise.resolve(value.slice(prefix.length));
    });
    mocks.uploadEncryptedPhoto.mockResolvedValue({
      path: "account-a/photo-1.bin",
      signedUrl: "",
    });
    mocks.uploadEncryptedAudio.mockResolvedValue({
      path: "account-a/audio-1.bin",
      signedUrl: "",
    });
    mocks.deleteStoragePath.mockResolvedValue(undefined);
    mocks.syncWithCloud.mockResolvedValue({ status: "merged" });
    await db.transaction(
      "rw",
      [
        db.settings,
        db.journalEntries,
        db.journalPhotos,
        db.journalAudio,
        db.journalSpaces,
        db.journalSpaceCaptures,
        db.offlineQueue,
      ],
      async () => {
        await db.settings.clear();
        await db.journalEntries.clear();
        await db.journalPhotos.clear();
        await db.journalAudio.clear();
        await db.journalSpaces.clear();
        await db.journalSpaceCaptures.clear();
        await db.offlineQueue.clear();
      }
    );
  });

  afterAll(() => {
    db.close();
  });

  it("leaves password metadata and diary rows untouched when encryption preparation fails", async () => {
    await seedPlaintextDiary();
    mocks.encryptMedia.mockRejectedValueOnce(new Error("crypto unavailable"));

    await expect(
      activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" })
    ).rejects.toThrow("crypto unavailable");

    expect(await db.settings.get(SK.JOURNAL_PASSWORD)).toBeUndefined();
    expect(await db.settings.get(SK.JOURNAL_VAULT_KEY)).toBeUndefined();
    expect(await getJournalSecurityMigrationIntent()).toBeNull();
    expect((await db.journalEntries.get("entry-1"))?.content).toBe("plaintext entry");
    expect((await db.journalPhotos.get("photo-1"))?.data).toContain("base64,plain");
  });

  it("commits local ciphertext and an exact owner-bound cloud intent before reporting success", async () => {
    await seedPlaintextDiary();

    await expect(
      activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" })
    ).resolves.toMatchObject({ cloudMigrationPending: true, vaultRevision: 101 });

    expect((await db.journalEntries.get("entry-1"))?.content).toBe(
      "entry-enc:vault-key:plaintext entry"
    );
    expect((await db.journalPhotos.get("photo-1"))?.data).toContain("media-enc:vault-key:");
    expect(await getJournalSecurityMigrationIntent()).toMatchObject({
      ownerUserId: "account-a",
      status: "queued",
      entryIds: ["entry-1"],
      photos: [{ id: "photo-1", previousStoragePath: "account-a/photo-1.jpg" }],
      audios: [{ id: "audio-1", previousStoragePath: "account-a/audio-1.webm" }],
      backupPending: true,
    });
    expect(mocks.enqueue).toHaveBeenCalledWith(
      "MIGRATE_JOURNAL_SECURITY",
      expect.stringMatching(/^journal-security:/),
      expect.objectContaining({ revision: expect.any(String) }),
      expect.objectContaining({
        expectedOwnerUserId: "account-a",
        priority: "critical",
      })
    );
  });

  it("atomically encrypts an existing draft, custom Space, and Capture with password activation", async () => {
    await seedPlaintextDiary();
    await seedPlaintextDraftAndSpaces();

    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });

    await expect(db.settings.get(SK.journalDraft("new"))).resolves.toMatchObject({
      value: expect.objectContaining({
        content: "entry-enc:vault-key:Private draft body",
      }),
    });
    await expect(db.journalSpaces.get("space-private-project")).resolves.toMatchObject({
      name: "entry-enc:vault-key:Private project",
      description: "entry-enc:vault-key:Custom private description",
    });
    await expect(db.journalSpaceCaptures.get("capture-private-project")).resolves.toMatchObject({
      spaceName: "entry-enc:vault-key:Private project",
      title: "entry-enc:vault-key:Secret capture title",
      fields: [
        {
          prompt: "entry-enc:vault-key:Private prompt",
          value: "entry-enc:vault-key:Private captured answer",
        },
      ],
    });
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeDefined();
  });

  it("allocates a persisted monotonic vault revision across remove and re-enable in the same millisecond", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(500);
    try {
      await db.settings.put({ key: "journal_vault_revision_v1", value: 500 });

      await activateJournalPasswordProtection({
        passwordData,
        vaultSetting: { ...vaultSetting, createdAt: 500, updatedAt: 500 },
        vaultKey: "first-vault-key",
      });
      await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toMatchObject({
        value: expect.objectContaining({ updatedAt: 501 }),
      });
      await expect(db.settings.get("journal_vault_revision_v1")).resolves.toMatchObject({
        value: 501,
      });

      await db.settings.bulkDelete([
        SK.JOURNAL_PASSWORD,
        SK.JOURNAL_VAULT_KEY,
        SK.JOURNAL_SECURITY_MIGRATION,
      ]);
      mocks.vaultKey = null;
      await activateJournalPasswordProtection({
        passwordData,
        vaultSetting: { ...vaultSetting, createdAt: 500, updatedAt: 500 },
        vaultKey: "second-vault-key",
      });

      await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toMatchObject({
        value: expect.objectContaining({ updatedAt: 502 }),
      });
      await expect(db.settings.get("journal_vault_revision_v1")).resolves.toMatchObject({
        value: 502,
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("refuses to re-enable protection while a durable cloud removal is pending", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);
    const removalIntent = await getJournalSecurityRemovalIntent();

    await expect(
      activateJournalPasswordProtection({
        passwordData: { ...passwordData, hash: "replacement-hash" },
        vaultSetting: {
          wrappedKey: "replacement-wrapped-key",
          createdAt: 200,
          updatedAt: 200,
        },
        vaultKey: "replacement-vault-key",
      })
    ).rejects.toThrow(/removal.*pending/i);

    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeUndefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeUndefined();
    await expect(db.journalEntries.get("entry-1")).resolves.toMatchObject({
      content: "plaintext entry",
    });
    await expect(getJournalSecurityRemovalIntent()).resolves.toEqual(removalIntent);
  });

  it("commits all local password-removal plaintext and metadata deletion in one transaction", async () => {
    await seedPlaintextDiary();
    await seedPlaintextDraftAndSpaces();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);

    const boundary = await captureJournalSecurityBoundary();
    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", boundary)
    ).resolves.toEqual({ cloudMigrationPending: true });

    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeUndefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeUndefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_REVISION)).resolves.toMatchObject({
      value: 101,
    });
    await expect(db.journalEntries.get("entry-1")).resolves.toMatchObject({
      content: "plaintext entry",
    });
    await expect(db.journalPhotos.get("photo-1")).resolves.toMatchObject({
      data: "data:image/jpeg;base64,plain",
      thumbnail: "data:image/jpeg;base64,thumb",
      storagePath: undefined,
    });
    await expect(db.settings.get(SK.journalDraft("new"))).resolves.toMatchObject({
      value: expect.objectContaining({ content: "Private draft body" }),
    });
    await expect(db.journalSpaces.get("space-private-project")).resolves.toMatchObject({
      name: "Private project",
      description: "Custom private description",
    });
    await expect(db.journalSpaceCaptures.get("capture-private-project")).resolves.toMatchObject({
      title: "Secret capture title",
      fields: [{ prompt: "Private prompt", value: "Private captured answer" }],
    });
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      ownerUserId: "account-a",
      status: "pending",
    });
  });

  it("allows a verified empty diary lock to be removed without an in-memory vault key", async () => {
    await db.settings.bulkPut([
      { key: SK.JOURNAL_PASSWORD, value: passwordData },
      { key: SK.JOURNAL_VAULT_KEY, value: vaultSetting },
      { key: SK.JOURNAL_VAULT_REVISION, value: vaultSetting.updatedAt },
    ]);

    const boundary = await captureJournalSecurityBoundary();
    await expect(
      removeJournalPasswordProtectionAtomically(null, boundary)
    ).resolves.toEqual({ cloudMigrationPending: true });

    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeUndefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeUndefined();
  });

  it("keeps a locked encrypted draft protected when no vault key is available", async () => {
    await db.settings.bulkPut([
      { key: SK.JOURNAL_PASSWORD, value: passwordData },
      { key: SK.JOURNAL_VAULT_KEY, value: vaultSetting },
      { key: SK.JOURNAL_VAULT_REVISION, value: vaultSetting.updatedAt },
      {
        key: SK.journalDraft("new"),
        value: {
          title: "",
          date: "2026-07-11",
          content: "entry-enc:vault-key:private draft",
          stickers: [],
          photoIds: [],
          tags: [],
          savedAt: 1,
        },
      },
    ]);

    const boundary = await captureJournalSecurityBoundary();
    await expect(
      removeJournalPasswordProtectionAtomically(null, boundary)
    ).rejects.toThrow(/unlock your diary/i);

    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeDefined();
  });

  it("leaves every protected row and unlock record untouched when removal preparation fails", async () => {
    await seedPlaintextDiary();
    await seedPlaintextDraftAndSpaces();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    mocks.decryptContent.mockImplementation(async (value: string, key: string) => {
      if (value.includes("Secret capture title")) throw new Error("capture authentication failed");
      const prefix = `entry-enc:${key}:`;
      return value.startsWith(prefix) ? value.slice(prefix.length) : value;
    });

    const boundary = await captureJournalSecurityBoundary();
    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", boundary)
    ).rejects.toThrow("capture authentication failed");

    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeDefined();
    await expect(db.journalEntries.get("entry-1")).resolves.toMatchObject({
      content: "entry-enc:vault-key:plaintext entry",
    });
    await expect(db.settings.get(SK.journalDraft("new"))).resolves.toMatchObject({
      value: expect.objectContaining({
        content: "entry-enc:vault-key:Private draft body",
      }),
    });
    await expect(db.journalSpaceCaptures.get("capture-private-project")).resolves.toMatchObject({
      title: "entry-enc:vault-key:Secret capture title",
    });
    await expect(getJournalSecurityRemovalIntent()).resolves.toBeNull();
  });

  it("rolls back earlier table writes when the atomic removal transaction fails", async () => {
    await seedPlaintextDiary();
    await seedPlaintextDraftAndSpaces();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const captureWrite = vi
      .spyOn(db.journalSpaceCaptures, "bulkPut")
      .mockRejectedValueOnce(new Error("capture write unavailable"));

    const boundary = await captureJournalSecurityBoundary();
    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", boundary)
    ).rejects.toThrow("capture write unavailable");

    expect(captureWrite).toHaveBeenCalled();
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeDefined();
    await expect(db.journalEntries.get("entry-1")).resolves.toMatchObject({
      content: "entry-enc:vault-key:plaintext entry",
    });
    await expect(db.journalPhotos.get("photo-1")).resolves.toMatchObject({
      data: expect.stringContaining("media-enc:vault-key:"),
      storagePath: "account-a/photo-1.jpg",
    });
    await expect(db.settings.get(SK.journalDraft("new"))).resolves.toMatchObject({
      value: expect.objectContaining({
        content: "entry-enc:vault-key:Private draft body",
      }),
    });
    await expect(getJournalSecurityRemovalIntent()).resolves.toBeNull();
  });

  it("leaves draft and Space rows plaintext when Capture encryption preparation fails", async () => {
    await seedPlaintextDraftAndSpaces();
    mocks.encryptContent.mockImplementation(async (value: string, key: string) => {
      if (value === "Secret capture title") throw new Error("capture crypto unavailable");
      return `entry-enc:${key}:${value}`;
    });

    await expect(
      activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" })
    ).rejects.toThrow("capture crypto unavailable");

    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeUndefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeUndefined();
    await expect(db.settings.get(SK.journalDraft("new"))).resolves.toMatchObject({
      value: expect.objectContaining({ content: "Private draft body" }),
    });
    await expect(db.journalSpaces.get("space-private-project")).resolves.toMatchObject({
      name: "Private project",
      description: "Custom private description",
    });
    await expect(db.journalSpaceCaptures.get("capture-private-project")).resolves.toMatchObject({
      title: "Secret capture title",
      fields: [{ prompt: "Private prompt", value: "Private captured answer" }],
    });
  });

  it("serializes a concurrent diary write so no plaintext row can slip past activation", async () => {
    await seedPlaintextDiary();
    let releaseEncryption!: () => void;
    const encryptionGate = new Promise<void>((resolve) => {
      releaseEncryption = resolve;
    });
    let encryptionStarted!: () => void;
    const encryptionStartedPromise = new Promise<void>((resolve) => {
      encryptionStarted = resolve;
    });
    mocks.encryptContent.mockImplementationOnce(async (value: string, key: string) => {
      encryptionStarted();
      await encryptionGate;
      return `entry-enc:${key}:${value}`;
    });

    const activation = activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await encryptionStartedPromise;

    const concurrentWrite = runWithJournalSecurityWriteLock(async () => {
      const content = mocks.vaultKey
        ? await mocks.encryptContent("concurrent plaintext", mocks.vaultKey)
        : "concurrent plaintext";
      await db.journalEntries.put({
        id: "entry-2",
        date: "2026-07-10",
        title: "Written during activation",
        content,
        stickers: [],
        tags: [],
        photoIds: [],
        audioIds: [],
        createdAt: 2,
        updatedAt: 2,
      });
    });
    releaseEncryption();
    await Promise.all([activation, concurrentWrite]);

    expect((await db.journalEntries.get("entry-2"))?.content).not.toBe("concurrent plaintext");
  });

  it("serializes a concurrent delete without resurrecting the entry or blocking its intent", async () => {
    await seedPlaintextDiary();
    let releaseEncryption!: () => void;
    const encryptionGate = new Promise<void>((resolve) => {
      releaseEncryption = resolve;
    });
    let encryptionStarted!: () => void;
    const encryptionStartedPromise = new Promise<void>((resolve) => {
      encryptionStarted = resolve;
    });
    mocks.encryptContent.mockImplementationOnce(async (value: string, key: string) => {
      encryptionStarted();
      await encryptionGate;
      return `entry-enc:${key}:${value}`;
    });

    const activation = activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await encryptionStartedPromise;
    const concurrentDelete = runWithJournalSecurityWriteLock(async () => {
      await db.journalEntries.delete("entry-1");
      await removeDeletedJournalArtifactsFromSecurityMigration({ entryIds: ["entry-1"] });
    });

    releaseEncryption();
    await Promise.all([activation, concurrentDelete]);

    expect(await db.journalEntries.get("entry-1")).toBeUndefined();
    expect((await getJournalSecurityMigrationIntent())?.entryIds).not.toContain("entry-1");
  });

  it("keeps an explicit durable pending state when the queue is unavailable", async () => {
    await seedPlaintextDiary();
    mocks.enqueue.mockRejectedValueOnce(new Error("queue full"));

    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });

    expect(await getJournalSecurityMigrationIntent()).toMatchObject({
      status: "enqueue-failed",
      lastError: "queue full",
      ownerUserId: "account-a",
    });
    expect((await db.journalEntries.get("entry-1"))?.content).toContain("entry-enc:vault-key:");
  });

  it("rolls back password activation when the authenticated account changes before commit", async () => {
    await seedPlaintextDiary();
    let markEncryptionStarted!: () => void;
    const encryptionStarted = new Promise<void>((resolve) => {
      markEncryptionStarted = resolve;
    });
    let releaseEncryption!: () => void;
    const encryptionGate = new Promise<void>((resolve) => {
      releaseEncryption = resolve;
    });
    mocks.encryptContent.mockImplementationOnce(async (value: string, key: string) => {
      markEncryptionStarted();
      await encryptionGate;
      return `entry-enc:${key}:${value}`;
    });

    const activation = activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await encryptionStarted;
    mocks.currentUserId = "account-b";
    releaseEncryption();

    await expect(activation).rejects.toThrow(/account boundary/i);
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeUndefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeUndefined();
    expect((await db.journalEntries.get("entry-1"))?.content).toBe("plaintext entry");
    expect(await getJournalSecurityMigrationIntent()).toBeNull();
  });

  it("rejects a boundary captured before slow password crypto when account A becomes account B", async () => {
    await seedPlaintextDiary();
    const boundaryBeforeCrypto = await captureJournalSecurityBoundary();

    // Password hashing and key wrapping happen outside this module. The caller
    // must preserve the pre-crypto boundary instead of silently recapturing B.
    await Promise.resolve();
    mocks.currentUserId = "account-b";

    await expect(
      activateJournalPasswordProtectionWithBoundary(
        { passwordData, vaultSetting, vaultKey: "vault-key" },
        boundaryBeforeCrypto
      )
    ).rejects.toThrow(/account boundary/i);

    expect(await db.settings.get(SK.JOURNAL_PASSWORD)).toBeUndefined();
    expect(await db.settings.get(SK.JOURNAL_VAULT_KEY)).toBeUndefined();
    expect((await db.journalEntries.get("entry-1"))?.content).toBe("plaintext entry");
    expect(await getJournalSecurityMigrationIntent()).toBeNull();
  });

  it("does not enter a generic journal security mutation after the initiating account changes", async () => {
    const boundary = await captureJournalSecurityBoundary();
    const mutation = vi.fn(() => Promise.resolve("mutated"));
    mocks.currentUserId = "account-b";

    await expect(runWithJournalSecurityBoundary(boundary, mutation)).rejects.toThrow(
      /account boundary/i
    );

    expect(mutation).not.toHaveBeenCalled();
  });

  it("keeps the wrapped-vault migration pending when no remote commit is possible", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    const intent = await getJournalSecurityMigrationIntent();
    expect(intent).not.toBeNull();
    mocks.syncSetting.mockRejectedValueOnce(new Error("Supabase client unavailable"));

    await expect(
      runJournalSecurityMigration({ revision: intent!.revision }, "account-a")
    ).rejects.toThrow("Supabase client unavailable");

    expect(mocks.syncSetting).toHaveBeenCalledWith(
      SK.JOURNAL_VAULT_KEY,
      expect.objectContaining({ wrappedKey: "wrapped-vault-key" }),
      "account-a",
      { requireRemoteCommit: true }
    );
    await expect(getJournalSecurityMigrationIntent()).resolves.toMatchObject({
      revision: intent!.revision,
      vaultSettingPending: true,
      backupPending: true,
    });
    expect(mocks.syncWithCloud).not.toHaveBeenCalled();
  });

  it("preserves the exact old path and intent across upload/delete failure, then drains idempotently", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    const intent = await getJournalSecurityMigrationIntent();
    expect(intent).not.toBeNull();
    const payload = { revision: intent!.revision };

    mocks.deleteStoragePath.mockRejectedValueOnce(new Error("storage delete unavailable"));
    await expect(runJournalSecurityMigration(payload, "account-a")).rejects.toThrow(
      "storage delete unavailable"
    );

    expect((await db.journalPhotos.get("photo-1"))?.storagePath).toBe("account-a/photo-1.jpg");
    expect(await getJournalSecurityMigrationIntent()).toMatchObject({
      photos: [{ id: "photo-1", previousStoragePath: "account-a/photo-1.jpg" }],
    });

    await runJournalSecurityMigration(payload, "account-a");

    expect(mocks.deleteStoragePath).toHaveBeenCalledWith(
      "journal-photos",
      "account-a/photo-1.jpg",
      "account-a"
    );
    expect(mocks.deleteStoragePath).toHaveBeenCalledWith(
      "journal-audio",
      "account-a/audio-1.webm",
      "account-a"
    );
    expect((await db.journalPhotos.get("photo-1"))?.storagePath).toBe("account-a/photo-1.bin");
    expect((await db.journalAudio.get("audio-1"))?.storagePath).toBe("account-a/audio-1.bin");
    expect(mocks.syncWithCloud).toHaveBeenCalledWith("merge", "account-a");
    expect(await getJournalSecurityMigrationIntent()).toBeNull();
  });

  it("runs the backup merge outside the journal lock so a protected import cannot deadlock", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    const intent = await getJournalSecurityMigrationIntent();
    expect(intent).not.toBeNull();

    mocks.syncWithCloud.mockImplementationOnce(async () => {
      const nestedLock = runWithJournalSecurityWriteLock(async () => {
        // A protected cloud import must be able to acquire JOURNAL after the
        // local migration phase released it.
      });
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          nestedLock,
          new Promise<never>((_resolve, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error("nested journal lock is blocked")),
              1_000
            );
          }),
        ]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
      return { status: "merged" };
    });

    await expect(
      runJournalSecurityMigration({ revision: intent!.revision }, "account-a")
    ).resolves.toBeUndefined();
    expect(await getJournalSecurityMigrationIntent()).toBeNull();
  });

  it("completes durable removal by syncing plaintext backup before deleting the remote vault", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);
    const removalIntent = await getJournalSecurityRemovalIntent();
    expect(removalIntent).not.toBeNull();

    await runJournalSecurityMigration(
      { mode: "remove", revision: removalIntent!.revision },
      "account-a"
    );

    expect(mocks.syncWithCloud).toHaveBeenCalledWith("merge", "account-a");
    expect(mocks.deleteSetting).toHaveBeenCalledWith(
      "journal_vault_key",
      "account-a",
      {
        journalSecurityRemovalRevision: removalIntent!.revision,
        queueOnNetworkError: false,
      }
    );
    expect(await getJournalSecurityRemovalIntent()).toBeNull();
  });

  it("keeps old encrypted media paths until plaintext backup and deletion both complete", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const encryptedPhotoPath = (await db.journalPhotos.get("photo-1"))?.storagePath;
    const encryptedAudioPath = (await db.journalAudio.get("audio-1"))?.storagePath;
    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);
    const removalIntent = await getJournalSecurityRemovalIntent();

    expect(removalIntent).toMatchObject({
      photos: [{ id: "photo-1", previousStoragePath: encryptedPhotoPath }],
      audios: [{ id: "audio-1", previousStoragePath: encryptedAudioPath }],
    });

    mocks.deleteStoragePath.mockRejectedValueOnce(new Error("encrypted media delete unavailable"));
    await expect(
      runJournalSecurityMigration(
        { mode: "remove", revision: removalIntent!.revision },
        "account-a",
      ),
    ).rejects.toThrow("encrypted media delete unavailable");
    expect(await getJournalSecurityRemovalIntent()).toMatchObject({
      revision: removalIntent!.revision,
      photos: [{ id: "photo-1", previousStoragePath: encryptedPhotoPath }],
    });
    expect(mocks.deleteSetting).not.toHaveBeenCalled();

    await runJournalSecurityMigration(
      { mode: "remove", revision: removalIntent!.revision },
      "account-a",
    );
    expect(mocks.deleteStoragePath).toHaveBeenCalledWith(
      "journal-photos",
      encryptedPhotoPath,
      "account-a",
    );
    expect(mocks.deleteStoragePath).toHaveBeenCalledWith(
      "journal-audio",
      encryptedAudioPath,
      "account-a",
    );
    expect(await getJournalSecurityRemovalIntent()).toBeNull();
  });

  it("keeps the durable removal intent when plaintext backup completion fails", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);
    const removalIntent = await getJournalSecurityRemovalIntent();
    mocks.syncWithCloud.mockRejectedValueOnce(new Error("backup unavailable"));

    await expect(
      runJournalSecurityMigration(
        { mode: "remove", revision: removalIntent!.revision },
        "account-a"
      )
    ).rejects.toThrow("backup unavailable");

    expect(mocks.deleteSetting).not.toHaveBeenCalled();
    expect(await getJournalSecurityRemovalIntent()).toMatchObject({
      revision: removalIntent!.revision,
      ownerUserId: "account-a",
    });
  });

  it("never deletes the remote vault when local protection reappears before removal completion", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);
    const removalIntent = await getJournalSecurityRemovalIntent();
    await db.settings.bulkPut([
      { key: SK.JOURNAL_PASSWORD, value: { ...passwordData, hash: "new-local-hash" } },
      {
        key: SK.JOURNAL_VAULT_KEY,
        value: {
          wrappedKey: "new-local-wrapped-key",
          createdAt: 500,
          updatedAt: 500,
        },
      },
      { key: SK.JOURNAL_VAULT_REVISION, value: 500 },
    ]);

    await expect(
      runJournalSecurityMigration(
        { mode: "remove", revision: removalIntent!.revision },
        "account-a"
      )
    ).rejects.toThrow(/protection.*re-enabled/i);

    expect(mocks.syncWithCloud).not.toHaveBeenCalled();
    expect(mocks.deleteSetting).not.toHaveBeenCalled();
    await expect(getJournalSecurityRemovalIntent()).resolves.toEqual(removalIntent);
  });

  it("keeps an explicit durable removal state when its queue enqueue fails", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);
    mocks.enqueue.mockRejectedValueOnce(new Error("removal queue full"));

    await expect(ensureJournalSecurityRemovalQueued()).rejects.toThrow("removal queue full");
    expect(await getJournalSecurityRemovalIntent()).toMatchObject({
      ownerUserId: "account-a",
      status: "enqueue-failed",
      lastError: "removal queue full",
    });
  });

  it("rejects a delayed account-A migration before any account-B mutation", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    const intent = await getJournalSecurityMigrationIntent();
    mocks.currentUserId = "account-b";

    await expect(
      runJournalSecurityMigration({ revision: intent!.revision }, "account-a")
    ).rejects.toThrow("account boundary");

    expect(mocks.syncSetting).not.toHaveBeenCalled();
    expect(mocks.uploadEncryptedPhoto).not.toHaveBeenCalled();
    expect((await db.journalPhotos.get("photo-1"))?.storagePath).toBe("account-a/photo-1.jpg");
    expect(await getJournalSecurityMigrationIntent()).not.toBeNull();
  });
});
