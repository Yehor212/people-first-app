import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalRemovalBeginInput } from "@/storage/sync/journalRemovalRemote";

const mocks = vi.hoisted(() => ({
  currentUserId: "account-a",
  enqueue: vi.fn(() => Promise.resolve()),
  syncSetting: vi.fn(() => Promise.resolve()),
  deleteSetting: vi.fn(() => Promise.resolve()),
  beginRemoteRemoval: vi.fn((_input: JournalRemovalBeginInput) =>
    Promise.resolve("ready" as const)
  ),
  finalizeRemoteRemoval: vi.fn(() => Promise.resolve({ status: "committed" })),
  patchJournalBackup: vi.fn(() => Promise.resolve({ status: "committed" })),
  verifyRemoteUnprotected: vi.fn(() => Promise.resolve({ status: "committed" })),
  syncJournalEntry: vi.fn(() => Promise.resolve()),
  syncJournalPhoto: vi.fn(() => Promise.resolve()),
  syncJournalAudio: vi.fn(() => Promise.resolve()),
  uploadEncryptedPhoto: vi.fn(() =>
    Promise.resolve({ path: "account-a/photo-1.bin", signedUrl: "" })
  ),
  uploadEncryptedAudio: vi.fn(() =>
    Promise.resolve({ path: "account-a/audio-1.bin", signedUrl: "" })
  ),
  uploadPhoto: vi.fn(() =>
    Promise.resolve({ path: "account-a/photo-1.jpg", signedUrl: "" })
  ),
  uploadAudio: vi.fn(() =>
    Promise.resolve({ path: "account-a/audio-1.webm", signedUrl: "" })
  ),
  deleteStoragePath: vi.fn(() => Promise.resolve()),
  downloadMedia: vi.fn(),
  readMediaIdentity: vi.fn(
    (bucket: "journal-photos" | "journal-audio", path: string) =>
      Promise.resolve({
        bucket,
        path,
        objectId: `${bucket}-object`,
        version: "storage-version-1",
        etag: "etag-1",
        size: 128,
      }),
  ),
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
vi.mock("@/storage/sync/journalRemovalRemote", () => ({
  beginRemoteJournalPasswordRemoval: mocks.beginRemoteRemoval,
  finalizeRemoteJournalPasswordRemoval: mocks.finalizeRemoteRemoval,
  patchJournalBackupForPasswordRemoval: mocks.patchJournalBackup,
  verifyRemoteJournalIsUnprotected: mocks.verifyRemoteUnprotected,
}));
vi.mock("@/storage/realtimeSync", () => ({
  syncJournalEntry: mocks.syncJournalEntry,
  syncJournalPhoto: mocks.syncJournalPhoto,
  syncJournalAudio: mocks.syncJournalAudio,
}));
vi.mock("@/storage/journalStorageService", () => ({
  uploadEncryptedPhoto: mocks.uploadEncryptedPhoto,
  uploadEncryptedAudio: mocks.uploadEncryptedAudio,
  uploadPhoto: mocks.uploadPhoto,
  uploadAudio: mocks.uploadAudio,
  deleteJournalMediaStoragePath: mocks.deleteStoragePath,
  downloadAsBase64: mocks.downloadMedia,
  readJournalMediaStorageIdentity: mocks.readMediaIdentity,
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
  encryptedJournalMediaFromStorageDataUrl: (value: string) => value,
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
  canonicalJournalInventoryJson,
  journalInventorySecurityProjection,
  ensureOwnerBoundJournalSecurityMigration,
  ensureJournalSecurityRemovalQueued,
  getJournalSecurityMigrationIntent,
  getJournalSecurityRemovalIntent,
  hasPendingInstallationJournalSecurityRemoval,
  normalizeJournalDataForActiveVault,
  preflightJournalPasswordRemoval,
  recordOrphanedRemoteJournalPasswordRemoval,
  recordJournalSecurityRemovalNativeCleanup,
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
  it("canonicalizes inventory object keys by UTF-8 byte order without host locale", () => {
    expect(
      canonicalJournalInventoryJson({
        "ä": 1,
        "𐀀": 2,
        z: 3,
      }),
    ).toBe('{"z":3,"ä":1,"𐀀":2}');
  });

  it("hashes only cross-runtime security fields and stringifies the vault epoch", () => {
    const entry = {
      id: "entry-unicode-𐀀",
      content: "entry-enc:vault-key:private content",
      vaultRevision: 9007199254740991,
      photoLayout: {
        photo: { x: -0, y: 1e-7, width: 33.333333333333336 },
      },
      createdAt: 1e21,
      updatedAt: 0.000001,
    };

    expect(journalInventorySecurityProjection("entry-row", entry)).toEqual({
      id: "entry-unicode-𐀀",
      content: "entry-enc:vault-key:private content",
      vault_revision: "9007199254740991",
    });
    expect(
      canonicalJournalInventoryJson(
        journalInventorySecurityProjection("entry-row", entry),
      ),
    ).toBe(
      '{"content":"entry-enc:vault-key:private content","id":"entry-unicode-𐀀","vault_revision":"9007199254740991"}',
    );

    expect(
      journalInventorySecurityProjection("entry-row", {
        ...entry,
        photoLayout: { photo: { x: 999.5, y: -1e-20, width: 0 } },
        createdAt: -0,
      }),
    ).toEqual(journalInventorySecurityProjection("entry-row", entry));
    expect(
      journalInventorySecurityProjection("entry-row", {
        ...entry,
        content: "entry-enc:vault-key:changed content",
      }),
    ).not.toEqual(journalInventorySecurityProjection("entry-row", entry));
  });

  it("keeps every encrypted backup field in the security projection", () => {
    expect(
      journalInventorySecurityProjection("photo-backup", {
        id: "photo-1",
        entryId: "entry-1",
        data: "media-enc:key:full",
        thumbnail: "media-enc:key:thumb",
        storagePath: "account-a/photo-1.v7.bin",
        vaultRevision: 7,
        width: 3024.125,
        height: 4032.5,
      }),
    ).toEqual({
      id: "photo-1",
      entryId: "entry-1",
      data: "media-enc:key:full",
      thumbnail: "media-enc:key:thumb",
      storagePath: "account-a/photo-1.v7.bin",
      vaultRevision: "7",
    });
    expect(
      journalInventorySecurityProjection("photo-backup", {
        id: "photo-storage-only",
        entryId: "entry-1",
        storagePath: "account-a/photo-storage-only.v7.bin",
        vaultRevision: 7,
      }),
    ).toEqual({
      id: "photo-storage-only",
      entryId: "entry-1",
      data: null,
      thumbnail: null,
      storagePath: "account-a/photo-storage-only.v7.bin",
      vaultRevision: "7",
    });

    expect(
      journalInventorySecurityProjection("capture-backup", {
        id: "capture-1",
        spaceId: "space-1",
        spaceName: "entry-enc:key:space",
        title: "entry-enc:key:title",
        fields: [
          { prompt: "entry-enc:key:prompt", value: "entry-enc:key:value" },
        ],
        entryId: "entry-1",
        vaultRevision: 7,
        createdAt: 1e21,
      }),
    ).toEqual({
      id: "capture-1",
      spaceId: "space-1",
      spaceName: "entry-enc:key:space",
      title: "entry-enc:key:title",
      fields: [
        { prompt: "entry-enc:key:prompt", value: "entry-enc:key:value" },
      ],
      entryId: "entry-1",
      vaultRevision: "7",
    });
  });

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
    mocks.uploadPhoto.mockResolvedValue({
      path: "account-a/photo-1.jpg",
      signedUrl: "",
    });
    mocks.uploadAudio.mockResolvedValue({
      path: "account-a/audio-1.webm",
      signedUrl: "",
    });
    mocks.deleteStoragePath.mockResolvedValue(undefined);
    mocks.downloadMedia.mockResolvedValue(null);
    mocks.readMediaIdentity.mockImplementation(
      (bucket: "journal-photos" | "journal-audio", path: string) =>
        Promise.resolve({
          bucket,
          path,
          objectId: `${bucket}-object`,
          version: "storage-version-1",
          etag: "etag-1",
          size: 128,
        }),
    );
    mocks.beginRemoteRemoval.mockResolvedValue("ready");
    mocks.finalizeRemoteRemoval.mockResolvedValue({ status: "committed" });
    mocks.patchJournalBackup.mockResolvedValue({ status: "committed" });
    mocks.verifyRemoteUnprotected.mockResolvedValue({ status: "committed" });
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

  it("encrypts an empty body so a title-only entry remains valid in the protected epoch", async () => {
    await db.journalEntries.put({
      id: "entry-title-only",
      date: "2026-07-10",
      title: "Private title",
      content: "",
      stickers: [],
      tags: [],
      photoIds: [],
      audioIds: [],
      createdAt: 1,
      updatedAt: 1,
    });

    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });

    await expect(db.journalEntries.get("entry-title-only")).resolves.toMatchObject({
      content: "entry-enc:vault-key:",
      vaultRevision: 101,
    });
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

  it("binds decryptable legacy ciphertext to the explicit active vault revision", async () => {
    await db.settings.bulkPut([
      { key: SK.JOURNAL_PASSWORD, value: passwordData },
      { key: SK.JOURNAL_VAULT_KEY, value: vaultSetting },
      { key: SK.JOURNAL_VAULT_REVISION, value: vaultSetting.updatedAt },
      {
        key: SK.journalDraft("legacy"),
        value: {
          title: "Legacy draft",
          date: "2026-07-11",
          content: "entry-enc:vault-key:legacy draft",
          stickers: [],
          photoIds: [],
          tags: [],
          savedAt: 1,
        },
      },
    ]);
    await db.journalEntries.put({
      id: "entry-legacy",
      date: "2026-07-10",
      title: "Legacy",
      content: "entry-enc:vault-key:legacy entry",
      stickers: [],
      tags: [],
      photoIds: [],
      audioIds: [],
      createdAt: 1,
      updatedAt: 1,
    });
    await db.journalSpaces.put({
      id: "space-legacy",
      name: "entry-enc:vault-key:legacy space",
      description: "entry-enc:vault-key:legacy description",
      iconKey: "folder",
      accent: "violet",
      private: true,
      kind: "user",
      sortOrder: 1,
      createdAt: 1,
      updatedAt: 1,
    });

    const boundary = await captureJournalSecurityBoundary();
    await expect(
      normalizeJournalDataForActiveVault("vault-key", 101, boundary),
    ).resolves.toMatchObject({ changedCount: 3, unboundMediaCount: 0 });

    await expect(db.journalEntries.get("entry-legacy")).resolves.toMatchObject({
      content: "entry-enc:vault-key:legacy entry",
      vaultRevision: 101,
    });
    await expect(db.settings.get(SK.journalDraft("legacy"))).resolves.toMatchObject({
      value: expect.objectContaining({
        content: "entry-enc:vault-key:legacy draft",
        vaultRevision: 101,
      }),
    });
    await expect(db.journalSpaces.get("space-legacy")).resolves.toMatchObject({
      name: "entry-enc:vault-key:legacy space",
      vaultRevision: 101,
    });
  });

  it("does not mutate any row when one legacy ciphertext belongs to another vault key", async () => {
    await db.settings.bulkPut([
      { key: SK.JOURNAL_PASSWORD, value: passwordData },
      { key: SK.JOURNAL_VAULT_KEY, value: vaultSetting },
      { key: SK.JOURNAL_VAULT_REVISION, value: vaultSetting.updatedAt },
    ]);
    await db.journalEntries.bulkPut([
      {
        id: "entry-current",
        date: "2026-07-10",
        title: "Current",
        content: "entry-enc:vault-key:current",
        stickers: [],
        tags: [],
        photoIds: [],
        audioIds: [],
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "entry-stale",
        date: "2026-07-10",
        title: "Stale",
        content: "entry-enc:old-vault-key:stale",
        stickers: [],
        tags: [],
        photoIds: [],
        audioIds: [],
        createdAt: 2,
        updatedAt: 2,
      },
    ]);
    const before = await db.journalEntries.toArray();
    const boundary = await captureJournalSecurityBoundary();

    await expect(
      normalizeJournalDataForActiveVault("vault-key", 101, boundary),
    ).rejects.toThrow("content authentication failed");
    expect(await db.journalEntries.toArray()).toEqual(before);
  });

  it("uses the explicit vault revision for plaintext drafts before a session key exists", async () => {
    await db.settings.bulkPut([
      { key: SK.JOURNAL_PASSWORD, value: passwordData },
      { key: SK.JOURNAL_VAULT_KEY, value: vaultSetting },
      { key: SK.JOURNAL_VAULT_REVISION, value: vaultSetting.updatedAt },
      {
        key: SK.journalDraft("plaintext"),
        value: {
          title: "Draft",
          date: "2026-07-11",
          content: "plaintext before unlock",
          stickers: [],
          photoIds: [],
          tags: [],
          savedAt: 1,
        },
      },
    ]);
    mocks.vaultKey = null;
    mocks.vaultRevision = null;
    const boundary = await captureJournalSecurityBoundary();

    await normalizeJournalDataForActiveVault("vault-key", 101, boundary);

    await expect(db.settings.get(SK.journalDraft("plaintext"))).resolves.toMatchObject({
      value: expect.objectContaining({
        content: "entry-enc:vault-key:plaintext before unlock",
        vaultRevision: 101,
      }),
    });
  });

  it("leaves remote-only legacy media unbound when its bytes cannot be authenticated", async () => {
    await db.settings.bulkPut([
      { key: SK.JOURNAL_PASSWORD, value: passwordData },
      { key: SK.JOURNAL_VAULT_KEY, value: vaultSetting },
      { key: SK.JOURNAL_VAULT_REVISION, value: vaultSetting.updatedAt },
    ]);
    await db.journalPhotos.put({
      id: "photo-remote-only",
      entryId: "entry-remote-only",
      data: "",
      thumbnail: "",
      width: 100,
      height: 80,
      createdAt: 1,
      storagePath: "account-a/photo-remote-only.bin",
    });
    mocks.downloadMedia.mockResolvedValueOnce(null);
    const boundary = await captureJournalSecurityBoundary();

    await expect(
      normalizeJournalDataForActiveVault("vault-key", 101, boundary),
    ).resolves.toMatchObject({
      changedCount: 0,
      unboundMediaCount: 1,
    });
    await expect(db.journalPhotos.get("photo-remote-only")).resolves.toMatchObject({
      data: "",
      storagePath: "account-a/photo-remote-only.bin",
    });
    expect((await db.journalPhotos.get("photo-remote-only"))?.vaultRevision).toBeUndefined();
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

  it("normalizes a supported version-1 removal intent without dropping cleanup paths", async () => {
    await db.settings.bulkPut([
      { key: SK.JOURNAL_VAULT_REVISION, value: 321 },
      {
        key: SK.JOURNAL_SECURITY_REMOVAL,
        value: {
          version: 1,
          revision: "legacy-removal-1",
          ownerUserId: "account-a",
          createdAt: 100,
          status: "queued",
          photos: [{ id: "photo-legacy", previousStoragePath: "account-a/old-photo.bin" }],
          audios: [{ id: "audio-legacy", previousStoragePath: "account-a/old-audio.bin" }],
        },
      },
    ]);

    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      version: 2,
      operationRevision: "legacy-removal-1",
      expectedVaultRevision: 321,
      ownerUserId: "account-a",
      phase: "cleanup-pending",
      cloudCleanup: {
        photos: [
          expect.objectContaining({
            id: "photo-legacy",
            previousStoragePath: "account-a/old-photo.bin",
          }),
        ],
        audios: [
          expect.objectContaining({
            id: "audio-legacy",
            previousStoragePath: "account-a/old-audio.bin",
          }),
        ],
      },
    });
  });

  it("fails closed on a future removal intent and never overwrites it", async () => {
    const unsupported = {
      version: 99,
      operationRevision: "future-operation",
      ownerUserId: "account-a",
    };
    await db.settings.put({ key: SK.JOURNAL_SECURITY_REMOVAL, value: unsupported });
    const boundary = await captureJournalSecurityBoundary();

    await expect(
      preflightJournalPasswordRemoval("vault-key", boundary)
    ).resolves.toEqual({ status: "storage-failed", recoveryAction: "retry" });

    await expect(
      activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" })
    ).rejects.toThrow(/unsupported|malformed/i);
    await expect(db.settings.get(SK.JOURNAL_SECURITY_REMOVAL)).resolves.toEqual({
      key: SK.JOURNAL_SECURITY_REMOVAL,
      value: unsupported,
    });
    await expect(hasPendingInstallationJournalSecurityRemoval()).resolves.toBe(true);
  });

  it("distinguishes installation-bound cleanup from an account-owned removal", async () => {
    await db.settings.put({
      key: SK.JOURNAL_SECURITY_REMOVAL,
      value: {
        version: 1,
        revision: "installation-removal",
        ownerUserId: "installation-local",
        createdAt: 1,
        status: "pending",
      },
    });
    await expect(hasPendingInstallationJournalSecurityRemoval()).resolves.toBe(true);

    await db.settings.put({
      key: SK.JOURNAL_SECURITY_REMOVAL,
      value: {
        version: 1,
        revision: "account-removal",
        ownerUserId: "account-a",
        createdAt: 2,
        status: "pending",
      },
    });
    await expect(hasPendingInstallationJournalSecurityRemoval()).resolves.toBe(false);
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
    ).resolves.toMatchObject({
      cloudMigrationPending: true,
      removalRevision: expect.any(String),
    });

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

  it("acquires the owner-bound remote fence before deleting the local vault or ciphertext", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    mocks.beginRemoteRemoval.mockImplementationOnce(async () => {
      await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
      await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeDefined();
      await expect(db.journalEntries.get("entry-1")).resolves.toMatchObject({
        content: "entry-enc:vault-key:plaintext entry",
        vaultRevision: vaultSetting.updatedAt,
      });
      return "ready";
    });

    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);

    expect(mocks.beginRemoteRemoval).toHaveBeenCalledTimes(1);
    expect(mocks.beginRemoteRemoval).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedOwnerUserId: "account-a",
        expectedVaultRevision: vaultSetting.updatedAt,
        operationRevision: expect.any(String),
        inventory: expect.objectContaining({ version: 1 }),
      }),
    );
    const fenceInventory = mocks.beginRemoteRemoval.mock.calls[0]?.[0]?.inventory;
    expect(fenceInventory).toMatchObject({
      entries: [
        expect.objectContaining({
          id: "entry-1",
          rowSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
          backupSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        }),
      ],
    });
    expect(JSON.stringify(fenceInventory)).not.toContain("plaintext entry");
    expect(JSON.stringify(fenceInventory)).not.toContain("entry-enc:");
  });

  it("leaves the local vault and every protected row unchanged when the remote fence is unavailable", async () => {
    await seedPlaintextDiary();
    await seedPlaintextDraftAndSpaces();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const before = {
      password: await db.settings.get(SK.JOURNAL_PASSWORD),
      vault: await db.settings.get(SK.JOURNAL_VAULT_KEY),
      entry: await db.journalEntries.get("entry-1"),
      photo: await db.journalPhotos.get("photo-1"),
      audio: await db.journalAudio.get("audio-1"),
      draft: await db.settings.get(SK.journalDraft("new")),
      space: await db.journalSpaces.get("space-private-project"),
      capture: await db.journalSpaceCaptures.get("capture-private-project"),
    };
    mocks.beginRemoteRemoval.mockRejectedValueOnce(new Error("network unavailable"));

    const boundary = await captureJournalSecurityBoundary();
    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", boundary),
    ).rejects.toThrow();

    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toEqual(before.password);
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toEqual(before.vault);
    await expect(db.journalEntries.get("entry-1")).resolves.toEqual(before.entry);
    await expect(db.journalPhotos.get("photo-1")).resolves.toEqual(before.photo);
    await expect(db.journalAudio.get("audio-1")).resolves.toEqual(before.audio);
    await expect(db.settings.get(SK.journalDraft("new"))).resolves.toEqual(before.draft);
    await expect(db.journalSpaces.get("space-private-project")).resolves.toEqual(before.space);
    await expect(db.journalSpaceCaptures.get("capture-private-project")).resolves.toEqual(
      before.capture,
    );
  });

  it("does not acquire the fence or remove the key when a protected blob version changes during preflight", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    await db.journalPhotos.update("photo-1", {
      storagePath: "account-a/photo-1.v101.bin",
    });
    mocks.downloadMedia.mockResolvedValue(
      "media-enc:vault-key:data:image/jpeg;base64,plain",
    );
    mocks.readMediaIdentity
      .mockResolvedValueOnce({
        bucket: "journal-photos",
        path: "account-a/photo-1.v101.bin",
        objectId: "photo-object",
        version: "storage-version-1",
        etag: "etag-1",
        size: 128,
      })
      .mockResolvedValueOnce({
        bucket: "journal-photos",
        path: "account-a/photo-1.v101.bin",
        objectId: "photo-object",
        version: "storage-version-2",
        etag: "etag-2",
        size: 128,
      });

    const before = await db.journalPhotos.get("photo-1");
    const boundary = await captureJournalSecurityBoundary();
    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", boundary),
    ).rejects.toMatchObject({ code: "decrypt-media" });

    expect(mocks.beginRemoteRemoval).not.toHaveBeenCalled();
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeDefined();
    await expect(db.journalPhotos.get("photo-1")).resolves.toEqual(before);
  });

  it("converts an offline protected device after another device completed the server epoch", async () => {
    await db.settings.put({ key: SK.DATA_OWNER_ID, value: "account-a" });
    await seedPlaintextDiary();
    await seedPlaintextDraftAndSpaces();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();
    const disposition = await recordOrphanedRemoteJournalPasswordRemoval(
      {
        operationRevision: "100:orphanoperation",
        vaultRevision: vaultSetting.updatedAt,
        remoteStatus: "complete",
      },
      boundary,
    );

    expect(disposition).toBe("recorded");

    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      phase: "remote-recovery",
      operationRevision: "100:orphanoperation",
      blocker: "unlock-required",
      cloudCleanup: { status: "complete" },
    });

    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", boundary),
    ).resolves.toMatchObject({
      cloudMigrationPending: true,
      removalRevision: "100:orphanoperation",
    });

    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeUndefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeUndefined();
    await expect(db.journalEntries.get("entry-1")).resolves.toMatchObject({
      content: "plaintext entry",
    });
    await expect(db.journalSpaceCaptures.get("capture-private-project")).resolves.toMatchObject({
      title: "Secret capture title",
    });
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      phase: "local-committed",
      operationRevision: "100:orphanoperation",
      expectedVaultRevision: vaultSetting.updatedAt,
    });
  });

  it("consumes an older server removal as stale without blocking a newer local vault", async () => {
    await db.settings.put({ key: SK.DATA_OWNER_ID, value: "account-a" });
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();

    await expect(
      recordOrphanedRemoteJournalPasswordRemoval(
        {
          operationRevision: "99:olderoperation",
          vaultRevision: vaultSetting.updatedAt - 1,
          remoteStatus: "complete",
        },
        boundary,
      ),
    ).resolves.toBe("stale");

    await expect(getJournalSecurityRemovalIntent()).resolves.toBeNull();
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toMatchObject({
      value: vaultSetting,
    });
  });

  it("consumes the matching server event without resetting pending native cleanup", async () => {
    await db.settings.put({ key: SK.DATA_OWNER_ID, value: "account-a" });
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);
    const committed = await getJournalSecurityRemovalIntent();
    expect(committed).not.toBeNull();
    await recordJournalSecurityRemovalNativeCleanup(
      committed!.operationRevision,
      "failed",
    );

    await expect(
      recordOrphanedRemoteJournalPasswordRemoval(
        {
          operationRevision: committed!.operationRevision,
          vaultRevision: committed!.expectedVaultRevision,
          remoteStatus: "complete",
        },
        boundary,
      ),
    ).resolves.toBe("recorded");

    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      phase: "cleanup-pending",
      operationRevision: committed!.operationRevision,
      nativeCleanup: { status: "failed", attemptCount: 1 },
      cloudCleanup: { status: "complete", stage: "complete" },
    });
  });

  it("preserves resumable cloud cleanup progress when the matching server recovery remains manual", async () => {
    const operationRevision = "101:cleanupretry";
    const cloudCleanup = {
      status: "blocked" as const,
      stage: "photos" as const,
      entryIds: ["entry-pending"],
      photos: [
        {
          id: "photo-pending",
          previousStoragePath: "account-a/photo-old.bin",
          replacementStoragePath: "account-a/photo-new.jpg",
          replacementUploaded: true,
          metadataCommitted: false,
          previousBlobDeleted: false,
        },
      ],
      audios: [
        {
          id: "audio-pending",
          previousStoragePath: "account-a/audio-old.bin",
          replacementUploaded: false,
          metadataCommitted: false,
          previousBlobDeleted: false,
        },
      ],
      backupPending: true,
      attemptCount: 3,
      blocker: "offline" as const,
    };
    await db.settings.bulkPut([
      { key: SK.DATA_OWNER_ID, value: "account-a" },
      {
        key: SK.JOURNAL_SECURITY_REMOVAL,
        value: {
          version: 2,
          revision: operationRevision,
          operationRevision,
          expectedVaultRevision: 101,
          ownerUserId: "account-a",
          createdAt: 100,
          updatedAt: 100,
          phase: "cleanup-pending",
          attemptCount: 4,
          nativeCleanup: { status: "failed", attemptCount: 2 },
          cloudCleanup,
          status: "queued",
          photos: cloudCleanup.photos,
          audios: cloudCleanup.audios,
        },
      },
    ]);
    const boundary = await captureJournalSecurityBoundary();

    await expect(
      recordOrphanedRemoteJournalPasswordRemoval(
        {
          operationRevision,
          vaultRevision: 101,
          remoteStatus: "manual-recovery-required",
        },
        boundary,
      ),
    ).resolves.toBe("recorded");

    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      phase: "cleanup-pending",
      nativeCleanup: { status: "failed", attemptCount: 2 },
      cloudCleanup,
      photos: cloudCleanup.photos,
      audios: cloudCleanup.audios,
    });
  });

  it("rebuilds a signed-out protection intent and commits the vault before adopted ciphertext", async () => {
    mocks.currentUserId = null as unknown as string;
    await seedPlaintextDiary();
    await seedPlaintextDraftAndSpaces();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await expect(getJournalSecurityMigrationIntent()).resolves.toBeNull();

    mocks.currentUserId = "account-a";
    await db.settings.put({ key: SK.DATA_OWNER_ID, value: "account-a" });
    const intent = await ensureOwnerBoundJournalSecurityMigration("account-a");

    expect(intent).toMatchObject({
      ownerUserId: "account-a",
      vaultSettingPending: true,
      backupPending: true,
      entryIds: ["entry-1"],
      photos: [expect.objectContaining({ id: "photo-1" })],
      audios: [expect.objectContaining({ id: "audio-1" })],
    });

    await runJournalSecurityMigration({ revision: intent!.revision }, "account-a");

    expect(mocks.syncSetting).toHaveBeenCalledWith(
      SK.JOURNAL_VAULT_KEY,
      expect.objectContaining({ updatedAt: vaultSetting.updatedAt }),
      "account-a",
      { requireRemoteCommit: true },
    );
    expect(mocks.syncJournalEntry).toHaveBeenCalled();
    expect(mocks.syncSetting.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.syncJournalEntry.mock.invocationCallOrder[0],
    );
    await expect(getJournalSecurityMigrationIntent()).resolves.toBeNull();
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
    ).resolves.toMatchObject({
      cloudMigrationPending: true,
      removalRevision: expect.any(String),
    });

    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeUndefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeUndefined();
  });

  it("returns a read-only vault-revision blocker before password removal", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    await db.settings.put({ key: SK.JOURNAL_VAULT_REVISION, value: 999 });
    const before = await db.journalEntries.get("entry-1");

    const boundary = await captureJournalSecurityBoundary();
    await expect(
      preflightJournalPasswordRemoval("vault-key", boundary)
    ).resolves.toMatchObject({
      status: "vault-revision-mismatch",
      recoveryAction: "reload",
    });

    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeDefined();
    await expect(getJournalSecurityRemovalIntent()).resolves.toBeNull();
    await expect(db.journalEntries.get("entry-1")).resolves.toEqual(before);
  });

  it("returns a privacy-safe decrypt-entry blocker without mutating any row", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const before = await db.journalEntries.get("entry-1");
    mocks.decryptContent.mockRejectedValueOnce(new Error("entry-1 authentication failed"));

    const boundary = await captureJournalSecurityBoundary();
    const result = await preflightJournalPasswordRemoval("vault-key", boundary);

    expect(result).toEqual({
      status: "decrypt-entry",
      recoveryAction: "retry",
    });
    expect(JSON.stringify(result)).not.toContain("entry-1");
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeDefined();
    await expect(db.journalEntries.get("entry-1")).resolves.toEqual(before);
  });

  it("downloads and decrypts metadata-only protected media before local removal", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    await Promise.all([
      db.journalPhotos.update("photo-1", {
        data: undefined,
        thumbnail: undefined,
        storagePath: "account-a/photo-1.bin",
      }),
      db.journalAudio.update("audio-1", {
        data: undefined,
        storagePath: "account-a/audio-1.bin",
      }),
    ]);
    mocks.downloadMedia.mockImplementation(async (bucket: string) =>
      bucket === "journal-photos"
        ? "media-enc:vault-key:data:image/jpeg;base64,plain"
        : "media-enc:vault-key:data:audio/webm;base64,plain"
    );

    const boundary = await captureJournalSecurityBoundary();
    await expect(
      preflightJournalPasswordRemoval("vault-key", boundary)
    ).resolves.toMatchObject({ status: "ready" });
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);

    await expect(db.journalPhotos.get("photo-1")).resolves.toMatchObject({
      data: "data:image/jpeg;base64,plain",
      storagePath: undefined,
    });
    await expect(db.journalAudio.get("audio-1")).resolves.toMatchObject({
      data: "data:audio/webm;base64,plain",
      storagePath: undefined,
    });
    expect(mocks.downloadMedia).toHaveBeenCalledTimes(4);
  });

  it("aborts without overwriting a direct Dexie row change between prepare and commit", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);

    let markDecryptStarted!: () => void;
    const decryptStarted = new Promise<void>((resolve) => {
      markDecryptStarted = resolve;
    });
    let releaseDecrypt!: () => void;
    const decryptGate = new Promise<void>((resolve) => {
      releaseDecrypt = resolve;
    });
    mocks.decryptContent.mockImplementationOnce(async (value: string, key: string) => {
      markDecryptStarted();
      await decryptGate;
      return value.replace(`entry-enc:${key}:`, "");
    });

    const boundary = await captureJournalSecurityBoundary();
    const removal = removeJournalPasswordProtectionAtomically("vault-key", boundary);
    await decryptStarted;
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      ownerUserId: "account-a",
      phase: "preflight-pending",
      blocker: undefined,
      cloudCleanup: expect.objectContaining({ status: "not-started" }),
      nativeCleanup: { status: "not-started" },
    });
    await db.journalEntries.update("entry-1", { title: "Concurrent title" });
    releaseDecrypt();

    await expect(removal).rejects.toMatchObject({
      name: "JournalPasswordRemovalBlockedError",
      code: "vault-revision-mismatch",
    });
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeDefined();
    await expect(db.journalEntries.get("entry-1")).resolves.toMatchObject({
      title: "Concurrent title",
      content: "entry-enc:vault-key:plaintext entry",
    });
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
    ).rejects.toMatchObject({
      name: "JournalPasswordRemovalBlockedError",
      code: "unlock-required",
    });

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
    ).rejects.toMatchObject({
      name: "JournalPasswordRemovalBlockedError",
      code: "decrypt-capture",
    });

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
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      ownerUserId: "account-a",
      phase: "blocked",
      blocker: "decrypt-capture",
      nativeCleanup: { status: "not-started" },
      cloudCleanup: expect.objectContaining({ status: "not-started" }),
    });
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
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      ownerUserId: "account-a",
      phase: "blocked",
      blocker: "storage-failed",
      nativeCleanup: { status: "not-started" },
      cloudCleanup: expect.objectContaining({ status: "not-started" }),
    });
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

  it("reconciles permanent deletes with a pending password-removal cleanup", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);

    await db.transaction(
      "rw",
      [db.settings, db.journalEntries, db.journalPhotos, db.journalAudio],
      async () => {
        await db.journalEntries.delete("entry-1");
        await db.journalPhotos.delete("photo-1");
        await db.journalAudio.delete("audio-1");
        await removeDeletedJournalArtifactsFromSecurityMigration({
          entryIds: ["entry-1"],
          photoIds: ["photo-1"],
          audioIds: ["audio-1"],
        });
      },
    );

    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      cloudCleanup: {
        entryIds: [],
        photos: [],
        audios: [],
      },
      photos: [],
      audios: [],
    });
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
      lastError: "enqueue-failed",
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

  it("preserves the old blob identity in the intent across cleanup failure, then drains idempotently", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    const intent = await getJournalSecurityMigrationIntent();
    expect(intent).not.toBeNull();
    const payload = { revision: intent!.revision };

    mocks.deleteStoragePath.mockRejectedValueOnce(new Error("storage delete unavailable"));
    await expect(runJournalSecurityMigration(payload, "account-a")).rejects.toThrow(
      "storage delete unavailable"
    );

    expect((await db.journalPhotos.get("photo-1"))?.storagePath).toBe("account-a/photo-1.bin");
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

  it("keeps the previous protected blob until replacement metadata is remotely committed", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    const intent = await getJournalSecurityMigrationIntent();
    expect(intent).not.toBeNull();
    const payload = { revision: intent!.revision };

    mocks.syncJournalPhoto.mockRejectedValueOnce(new Error("photo metadata unavailable"));

    await expect(runJournalSecurityMigration(payload, "account-a")).rejects.toThrow(
      "photo metadata unavailable",
    );

    expect((await db.journalPhotos.get("photo-1"))?.storagePath).toBe(
      "account-a/photo-1.jpg",
    );
    expect(mocks.deleteStoragePath).not.toHaveBeenCalledWith(
      "journal-photos",
      "account-a/photo-1.jpg",
      "account-a",
    );
    await expect(getJournalSecurityMigrationIntent()).resolves.toMatchObject({
      photos: [{ id: "photo-1", previousStoragePath: "account-a/photo-1.jpg" }],
    });
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

  it("completes journal-scoped plaintext commits and CAS backup before deleting the remote vault", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);
    let removalIntent = await getJournalSecurityRemovalIntent();
    expect(removalIntent).not.toBeNull();
    await recordJournalSecurityRemovalNativeCleanup(
      removalIntent!.operationRevision,
      "complete"
    );
    removalIntent = await getJournalSecurityRemovalIntent();

    await runJournalSecurityMigration(
      { mode: "remove", revision: removalIntent!.revision },
      "account-a"
    );

    expect(mocks.syncWithCloud).not.toHaveBeenCalled();
    expect(mocks.syncJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: "entry-1", content: "plaintext entry" }),
      {
        expectedOwnerUserId: "account-a",
        requireRemoteCommit: true,
      }
    );
    expect(mocks.patchJournalBackup).toHaveBeenCalledWith({
      expectedOwnerUserId: "account-a",
      operationRevision: removalIntent!.operationRevision,
    });
    expect(mocks.verifyRemoteUnprotected).toHaveBeenCalledWith({
      expectedOwnerUserId: "account-a",
      operationRevision: removalIntent!.operationRevision,
    });
    expect(mocks.beginRemoteRemoval).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedOwnerUserId: "account-a",
        expectedVaultRevision: removalIntent!.expectedVaultRevision,
        operationRevision: removalIntent!.operationRevision,
        inventory: expect.objectContaining({ version: 1 }),
      }),
    );
    expect(mocks.finalizeRemoteRemoval).toHaveBeenCalledWith({
      expectedOwnerUserId: "account-a",
      expectedVaultRevision: removalIntent!.expectedVaultRevision,
      operationRevision: removalIntent!.operationRevision,
    });
    expect(await getJournalSecurityRemovalIntent()).toBeNull();
  });

  it("keeps old encrypted media paths until plaintext backup and deletion both complete", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    await Promise.all([
      db.journalPhotos.update("photo-1", { storagePath: "account-a/photo-1.bin" }),
      db.journalAudio.update("audio-1", { storagePath: "account-a/audio-1.bin" }),
    ]);
    mocks.downloadMedia.mockImplementation(async (bucket: string) =>
      bucket === "journal-photos"
        ? "media-enc:vault-key:data:image/jpeg;base64,plain"
        : "media-enc:vault-key:data:audio/webm;base64,plain",
    );
    const encryptedPhotoPath = (await db.journalPhotos.get("photo-1"))?.storagePath;
    const encryptedAudioPath = (await db.journalAudio.get("audio-1"))?.storagePath;
    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);
    let removalIntent = await getJournalSecurityRemovalIntent();
    await recordJournalSecurityRemovalNativeCleanup(
      removalIntent!.operationRevision,
      "complete"
    );
    removalIntent = await getJournalSecurityRemovalIntent();

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
    mocks.patchJournalBackup.mockRejectedValueOnce(new Error("backup unavailable"));

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
      lastError: "storage-failed",
      cloudCleanup: expect.objectContaining({
        status: "blocked",
        blocker: "storage-failed",
      }),
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
