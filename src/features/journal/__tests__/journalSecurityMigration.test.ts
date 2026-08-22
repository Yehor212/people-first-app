import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  JournalRemovalBeginInput,
  JournalRemovalFenceInput,
} from "@/storage/sync/journalRemovalRemote";
import type { JournalEntry } from "../types";

type JournalRemovalArtifactInput = JournalRemovalFenceInput & {
  surface: "entry" | "photo" | "audio";
  entityId: string;
  parentEntry?: JournalEntry;
};

const mocks = vi.hoisted(() => ({
  currentUserId: null as string | null,
  clearNativeCredential: vi.fn(() => Promise.resolve("removed" as const)),
  enqueue: vi.fn(() => Promise.resolve()),
  syncSetting: vi.fn(() => Promise.resolve()),
  deleteSetting: vi.fn(() => Promise.resolve()),
  beginRemoteRemoval: vi.fn((_input: JournalRemovalBeginInput) =>
    Promise.resolve<
      | "ready"
      | "complete"
      | "fresh-auth-required"
      | "fresh-auth-required-no-fence"
      | "fresh-auth-required-existing-fence"
    >("ready")
  ),
  recoverRemoteRemoval: vi.fn(() =>
    Promise.resolve<
      | { status: "not-pending" }
      | {
          status: "abortable" | "manual-recovery-required" | "complete";
          operationRevision: string;
          vaultRevision: number;
        }
    >({ status: "not-pending" })
  ),
  finalizeRemoteRemoval: vi.fn(() => Promise.resolve({ status: "committed" })),
  abortRemoteRemoval: vi.fn(() => Promise.resolve("aborted" as const)),
  commitRemovalEntry: vi.fn(() => Promise.resolve({ status: "committed" })),
  commitRemovalPhoto: vi.fn(() => Promise.resolve({ status: "committed" })),
  commitRemovalAudio: vi.fn(() => Promise.resolve({ status: "committed" })),
  deleteRemovalArtifact: vi.fn((_input: JournalRemovalArtifactInput) =>
    Promise.resolve({ status: "committed" })
  ),
  reserveRemovalMedia: vi.fn((_input: unknown) => Promise.resolve({ status: "committed" })),
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
  uploadPhoto: vi.fn(() => Promise.resolve({ path: "account-a/photo-1.jpg", signedUrl: "" })),
  uploadAudio: vi.fn(() => Promise.resolve({ path: "account-a/audio-1.webm", signedUrl: "" })),
  prepareRemovalPhoto: vi.fn(),
  prepareRemovalAudio: vi.fn(),
  uploadPreparedRemoval: vi.fn(),
  deleteStoragePath: vi.fn(() => Promise.resolve()),
  downloadMedia: vi.fn(),
  readMediaIdentity: vi.fn((bucket: "journal-photos" | "journal-audio", path: string) =>
    Promise.resolve({
      bucket,
      path,
      objectId: `${bucket}-object`,
      version: "storage-version-1",
      etag: "etag-1",
      size: 128,
    })
  ),
  syncWithCloud: vi.fn(() => Promise.resolve({ status: "merged" })),
  encryptContent: vi.fn((value: string, key: string) =>
    Promise.resolve(`entry-enc:${key}:${value}`)
  ),
  decryptContent: vi.fn((value: string, key: string) => {
    const prefix = `entry-enc:${key}:`;
    if (!value.startsWith(prefix))
      return Promise.reject(new Error("content authentication failed"));
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
  abortRemoteJournalPasswordRemoval: mocks.abortRemoteRemoval,
  commitRemoteJournalPasswordRemovalEntry: mocks.commitRemovalEntry,
  commitRemoteJournalPasswordRemovalPhoto: mocks.commitRemovalPhoto,
  commitRemoteJournalPasswordRemovalAudio: mocks.commitRemovalAudio,
  deleteRemoteJournalPasswordRemovalArtifact: mocks.deleteRemovalArtifact,
  reserveRemoteJournalPasswordRemovalMedia: mocks.reserveRemovalMedia,
  recoverRemoteJournalPasswordRemoval: mocks.recoverRemoteRemoval,
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
  preparePhotoForPasswordRemovalUpload: mocks.prepareRemovalPhoto,
  prepareAudioForPasswordRemovalUpload: mocks.prepareRemovalAudio,
  uploadPreparedJournalPasswordRemovalMedia: mocks.uploadPreparedRemoval,
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
vi.mock("@/lib/journalBiometricCredentials", () => ({
  clearNativeJournalBiometricCredential: mocks.clearNativeCredential,
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
  pruneJournalPasswordRemovalMediaStage,
  recoverInstallationJournalSecurityRemovalBeforeAdoption,
  recordOrphanedRemoteJournalPasswordRemoval,
  recordJournalSecurityRemovalNativeCleanup,
  recoverPendingJournalPasswordRemovalAbort,
  removeJournalPasswordProtectionAtomically,
  removeDeletedJournalArtifactsFromSecurityMigration,
  runWithJournalSecurityBoundary,
  runJournalSecurityMigration,
} from "../journalSecurityMigration";
import { runWithJournalSecurityWriteLock } from "../journalSecurityWriteLock";
import { subscribeDataRefresh } from "@/hooks/useIndexedDB";

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
        ä: 1,
        "𐀀": 2,
        z: 3,
      })
    ).toBe('{"z":3,"ä":1,"𐀀":2}');
  });

  it("canonicalizes finite numbers without exponent or negative-zero drift", () => {
    expect(
      canonicalJournalInventoryJson({
        large: 1e21,
        small: 1e-7,
        negativeSmall: -1e-7,
        negativeZero: -0,
        precise: 33.333333333333336,
      })
    ).toBe(
      '{"large":1000000000000000000000,"negativeSmall":-0.0000001,"negativeZero":0,"precise":33.333333333333336,"small":0.0000001}'
    );
  });

  it("binds every client-mutable cloud entry field and stringifies the vault epoch", () => {
    const entry = {
      id: "entry-unicode-𐀀",
      date: "2026-08-03",
      title: "entry-enc:vault-key:private title",
      content: "entry-enc:vault-key:private content",
      stickers: ["entry-enc:vault-key:sticker"],
      mood: null,
      tags: ["private"],
      templateId: null,
      habitSnapshot: null,
      photoIds: ["photo-1"],
      audioIds: [],
      vaultRevision: 9007199254740991,
      photoLayout: {
        photo: { x: -0, y: 1e-7, width: 33.333333333333336 },
      },
      bgPattern: null,
      bgIntensity: null,
      paperColor: null,
      paperTexture: null,
      font: null,
      fontSize: null,
      inkColor: null,
      theme: null,
      particleSpeed: null,
      createdAt: 1e21,
      updatedAt: 0.000001,
    };

    expect(journalInventorySecurityProjection("entry-row", entry)).toEqual({
      id: "entry-unicode-𐀀",
      date: "2026-08-03",
      title: "entry-enc:vault-key:private title",
      content: "entry-enc:vault-key:private content",
      stickers: ["entry-enc:vault-key:sticker"],
      mood: null,
      tags: ["private"],
      template_id: null,
      habit_snapshot: null,
      photo_ids: ["photo-1"],
      audio_ids: [],
      photo_layout: entry.photoLayout,
      bg_pattern: null,
      bg_intensity: null,
      paper_color: null,
      paper_texture: null,
      font: null,
      font_size: null,
      ink_color: null,
      theme: null,
      particle_speed: null,
      created_at: 1e21,
      updated_at: 0.000001,
      vault_revision: "9007199254740991",
    });

    expect(
      journalInventorySecurityProjection("entry-row", {
        ...entry,
        localOnlyTransient: "not persisted to the cloud row",
      })
    ).toEqual(journalInventorySecurityProjection("entry-row", entry));
    expect(
      journalInventorySecurityProjection("entry-row", {
        ...entry,
        photoLayout: { photo: { x: 999.5, y: -1e-20, width: 0 } },
      })
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
      })
    ).toEqual({
      id: "photo-1",
      entryId: "entry-1",
      data: "media-enc:key:full",
      thumbnail: "media-enc:key:thumb",
      storagePath: "account-a/photo-1.v7.bin",
      vaultRevision: 7,
      width: 3024.125,
      height: 4032.5,
    });
    expect(
      journalInventorySecurityProjection("photo-backup", {
        id: "photo-storage-only",
        entryId: "entry-1",
        storagePath: "account-a/photo-storage-only.v7.bin",
        vaultRevision: 7,
      })
    ).toEqual({
      id: "photo-storage-only",
      entryId: "entry-1",
      storagePath: "account-a/photo-storage-only.v7.bin",
      vaultRevision: 7,
    });

    expect(
      journalInventorySecurityProjection("capture-backup", {
        id: "capture-1",
        spaceId: "space-1",
        spaceName: "entry-enc:key:space",
        title: "entry-enc:key:title",
        fields: [{ prompt: "entry-enc:key:prompt", value: "entry-enc:key:value" }],
        entryId: "entry-1",
        vaultRevision: 7,
        createdAt: 1e21,
      })
    ).toEqual({
      id: "capture-1",
      spaceId: "space-1",
      spaceName: "entry-enc:key:space",
      title: "entry-enc:key:title",
      fields: [{ prompt: "entry-enc:key:prompt", value: "entry-enc:key:value" }],
      entryId: "entry-1",
      vaultRevision: 7,
      createdAt: 1e21,
    });
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.currentUserId = "account-a";
    mocks.clearNativeCredential.mockResolvedValue("removed");
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
      if (!value.startsWith(prefix))
        return Promise.reject(new Error("content authentication failed"));
      return Promise.resolve(value.slice(prefix.length));
    });
    mocks.decryptMedia.mockImplementation((value: string, key: string) => {
      const prefix = `media-enc:${key}:`;
      if (!value.startsWith(prefix))
        return Promise.reject(new Error("media authentication failed"));
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
    mocks.prepareRemovalPhoto.mockImplementation(
      async (id: string, _data: string, owner: string, operationRevision: string) => ({
        bucket: "journal-photos",
        entityId: id,
        path: `${owner}/removal/${operationRevision}/${id}.jpg`,
        contentSha256: "a".repeat(64),
        contentSize: 128,
        mimeType: "image/jpeg",
        blob: new Blob(["photo"], { type: "image/jpeg" }),
      })
    );
    mocks.prepareRemovalAudio.mockImplementation(
      async (
        id: string,
        _data: string,
        _mimeType: string,
        owner: string,
        operationRevision: string
      ) => ({
        bucket: "journal-audio",
        entityId: id,
        path: `${owner}/removal/${operationRevision}/${id}.webm`,
        contentSha256: "b".repeat(64),
        contentSize: 256,
        mimeType: "audio/webm",
        blob: new Blob(["audio"], { type: "audio/webm" }),
      })
    );
    mocks.uploadPreparedRemoval.mockImplementation(async (prepared: { path: string }) => ({
      path: prepared.path,
      signedUrl: "",
    }));
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
        })
    );
    mocks.beginRemoteRemoval.mockResolvedValue("ready");
    mocks.recoverRemoteRemoval.mockResolvedValue({ status: "not-pending" });
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
        db.journalPasswordRemovalMediaStage,
        db.offlineQueue,
      ],
      async () => {
        await db.settings.clear();
        await db.journalEntries.clear();
        await db.journalPhotos.clear();
        await db.journalAudio.clear();
        await db.journalSpaces.clear();
        await db.journalSpaceCaptures.clear();
        await db.journalPasswordRemovalMediaStage.clear();
        await db.offlineQueue.clear();
      }
    );
    await db.settings.put({ key: SK.DATA_OWNER_ID, value: "account-a" });
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
      normalizeJournalDataForActiveVault("vault-key", 101, boundary)
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

    await expect(normalizeJournalDataForActiveVault("vault-key", 101, boundary)).rejects.toThrow(
      "content authentication failed"
    );
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
      normalizeJournalDataForActiveVault("vault-key", 101, boundary)
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

  it("rewrites a durable pending journal upsert to the plaintext row in the atomic removal commit", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const encryptedEntry = await db.journalEntries.get("entry-1");
    expect(encryptedEntry?.content).toBe("entry-enc:vault-key:plaintext entry");
    await db.offlineQueue.put({
      id: "pending-entry-1",
      operationId: "00000000-0000-4000-8000-000000000001",
      type: "SYNC_JOURNAL_ENTRY",
      entityId: "entry-1",
      ownerUserId: "account-a",
      payload: encryptedEntry,
      timestamp: 10,
      retries: 2,
      maxRetries: 5,
      priority: "critical",
    });

    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);

    await expect(db.offlineQueue.get("pending-entry-1")).resolves.toMatchObject({
      operationId: expect.stringMatching(/^journal-removal:/),
      retries: 2,
      payload: expect.objectContaining({
        id: "entry-1",
        content: "plaintext entry",
        vaultRevision: undefined,
      }),
    });
    expect((await db.offlineQueue.get("pending-entry-1"))?.operationId).not.toBe(
      "00000000-0000-4000-8000-000000000001"
    );
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

    await expect(preflightJournalPasswordRemoval("vault-key", boundary)).resolves.toEqual({
      status: "storage-failed",
      recoveryAction: "retry",
    });

    await expect(
      activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" })
    ).rejects.toThrow(/unsupported|malformed/i);
    await expect(db.settings.get(SK.JOURNAL_SECURITY_REMOVAL)).resolves.toEqual({
      key: SK.JOURNAL_SECURITY_REMOVAL,
      value: unsupported,
    });
    await expect(hasPendingInstallationJournalSecurityRemoval()).resolves.toBe(true);
  });

  it("fails closed on a v2 removal intent with malformed nested cleanup state", async () => {
    const malformed = {
      version: 2,
      revision: "100:malformednested",
      operationRevision: "100:malformednested",
      expectedVaultRevision: 101,
      ownerUserId: "account-a",
      createdAt: 100,
      updatedAt: 101,
      phase: "cleanup-pending",
      attemptCount: 0,
      nativeCleanup: {},
      cloudCleanup: {
        status: "complete",
        stage: "complete",
        entryIds: [],
        photos: [],
        audios: [],
        backupPending: false,
        attemptCount: 0,
      },
      status: "queued",
      photos: [],
      audios: [],
    };
    await db.settings.put({ key: SK.JOURNAL_SECURITY_REMOVAL, value: malformed });

    await expect(getJournalSecurityRemovalIntent()).rejects.toThrow(/unsupported|malformed/i);
    await expect(hasPendingInstallationJournalSecurityRemoval()).resolves.toBe(true);
  });

  it("fails closed when legacy media collections are not arrays", async () => {
    const malformed = {
      version: 1,
      revision: "legacy-malformed-media",
      ownerUserId: "account-a",
      createdAt: 100,
      status: "queued",
      photos: "not-an-array",
    };
    await db.settings.put({ key: SK.JOURNAL_SECURITY_REMOVAL, value: malformed });

    await expect(getJournalSecurityRemovalIntent()).rejects.toThrow(/unsupported|malformed/i);
    await expect(db.settings.get(SK.JOURNAL_SECURITY_REMOVAL)).resolves.toEqual({
      key: SK.JOURNAL_SECURITY_REMOVAL,
      value: malformed,
    });
  });

  it("fails closed when a completed cleanup retains unfinished media", async () => {
    const unfinishedPhoto = {
      id: "photo-unfinished",
      previousStoragePath: "account-a/photo-unfinished.bin",
      replacementUploaded: false,
      metadataCommitted: false,
      previousBlobDeleted: false,
    };
    const malformed = {
      version: 2,
      revision: "100:completewithmedia",
      operationRevision: "100:completewithmedia",
      expectedVaultRevision: 101,
      ownerUserId: "account-a",
      createdAt: 100,
      updatedAt: 101,
      phase: "cleanup-pending",
      attemptCount: 0,
      nativeCleanup: { status: "pending", attemptCount: 0 },
      cloudCleanup: {
        status: "complete",
        stage: "complete",
        entryIds: [],
        photos: [unfinishedPhoto],
        audios: [],
        backupPending: false,
        attemptCount: 0,
      },
      status: "queued",
      photos: [unfinishedPhoto],
      audios: [],
    };
    await db.settings.put({ key: SK.JOURNAL_SECURITY_REMOVAL, value: malformed });

    await expect(getJournalSecurityRemovalIntent()).rejects.toThrow(/unsupported|malformed/i);
    await expect(db.settings.get(SK.JOURNAL_SECURITY_REMOVAL)).resolves.toEqual({
      key: SK.JOURNAL_SECURITY_REMOVAL,
      value: malformed,
    });
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

  it("settles a signed-out local commit before account adoption without deleting journal rows", async () => {
    mocks.currentUserId = null;
    await db.settings.delete(SK.DATA_OWNER_ID);
    await seedPlaintextDiary();
    await seedPlaintextDraftAndSpaces();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const signedOutBoundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", signedOutBoundary);
    const entryBeforeAdoption = await db.journalEntries.get("entry-1");
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      ownerUserId: "installation-local",
      phase: "local-committed",
      cloudCleanup: { status: "complete" },
    });

    mocks.currentUserId = "account-a";
    await expect(
      recoverInstallationJournalSecurityRemovalBeforeAdoption("account-a")
    ).resolves.toBe("recovered");

    expect(mocks.clearNativeCredential).toHaveBeenCalledTimes(1);
    await expect(getJournalSecurityRemovalIntent()).resolves.toBeNull();
    await expect(db.journalEntries.get("entry-1")).resolves.toEqual(entryBeforeAdoption);
    await expect(db.settings.get(SK.DATA_OWNER_ID)).resolves.toBeUndefined();
  });

  it("cancels only an uncommitted installation-local attempt before account adoption", async () => {
    mocks.currentUserId = null;
    await db.settings.delete(SK.DATA_OWNER_ID);
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    mocks.decryptContent.mockRejectedValueOnce(new Error("entry authentication failed"));
    const signedOutBoundary = await captureJournalSecurityBoundary();
    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", signedOutBoundary)
    ).rejects.toMatchObject({ code: "decrypt-entry" });
    const protectedEntry = await db.journalEntries.get("entry-1");

    mocks.currentUserId = "account-a";
    await expect(
      recoverInstallationJournalSecurityRemovalBeforeAdoption("account-a")
    ).resolves.toBe("recovered");

    expect(mocks.clearNativeCredential).not.toHaveBeenCalled();
    await expect(getJournalSecurityRemovalIntent()).resolves.toBeNull();
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeDefined();
    await expect(db.journalEntries.get("entry-1")).resolves.toEqual(protectedEntry);
  });

  it("keeps a committed installation-local intent when biometric cleanup cannot finish", async () => {
    mocks.currentUserId = null;
    await db.settings.delete(SK.DATA_OWNER_ID);
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const signedOutBoundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", signedOutBoundary);
    mocks.clearNativeCredential.mockRejectedValueOnce(new Error("native cleanup unavailable"));

    mocks.currentUserId = "account-a";
    await expect(
      recoverInstallationJournalSecurityRemovalBeforeAdoption("account-a")
    ).resolves.toBe("blocked");

    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      ownerUserId: "installation-local",
      phase: "local-committed",
    });
    await expect(db.settings.get(SK.DATA_OWNER_ID)).resolves.toBeUndefined();
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

  it("blocks authenticated removal until the local diary owner is adopted, then permits a fresh retry", async () => {
    await db.settings.delete(SK.DATA_OWNER_ID);
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const protectedEntry = await db.journalEntries.get("entry-1");

    const unadoptedBoundary = await captureJournalSecurityBoundary();
    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", unadoptedBoundary)
    ).rejects.toMatchObject({
      name: "JournalPasswordRemovalBlockedError",
      code: "owner-adoption-pending",
      recoveryAction: "retry",
    });

    expect(mocks.beginRemoteRemoval).not.toHaveBeenCalled();
    await expect(getJournalSecurityRemovalIntent()).resolves.toBeNull();
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeDefined();
    await expect(db.journalEntries.get("entry-1")).resolves.toEqual(protectedEntry);

    await db.settings.put({ key: SK.DATA_OWNER_ID, value: "account-a" });
    const adoptedBoundary = await captureJournalSecurityBoundary();
    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", adoptedBoundary)
    ).resolves.toMatchObject({
      cloudMigrationPending: true,
      removalRevision: expect.any(String),
    });

    expect(mocks.beginRemoteRemoval).toHaveBeenCalledTimes(1);
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeUndefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeUndefined();
  });

  it("keeps a committed removal resumable when mounted refresh fails after the transaction", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();
    const unsubscribe = subscribeDataRefresh(async () => {
      throw new Error("mounted diary refresh failed");
    });

    try {
      await expect(
        removeJournalPasswordProtectionAtomically("vault-key", boundary)
      ).resolves.toMatchObject({
        cloudMigrationPending: true,
        removalRevision: expect.any(String),
      });
    } finally {
      unsubscribe();
    }

    expect(mocks.abortRemoteRemoval).not.toHaveBeenCalled();
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeUndefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeUndefined();
    await expect(db.journalEntries.get("entry-1")).resolves.toMatchObject({
      content: "plaintext entry",
    });
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      ownerUserId: "account-a",
      phase: "local-committed",
      cloudCleanup: { status: "pending" },
    });
  });

  it("serializes concurrent removal callers across the remote fence and local commit", async () => {
    // Exercise the owner-bound cross-tab path. An authenticated-but-unadopted
    // local realm is intentionally classified separately as owner-changed.
    await db.settings.put({ key: SK.DATA_OWNER_ID, value: "account-a" });
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();
    let releaseFirstFence!: () => void;
    const firstFenceGate = new Promise<void>((resolve) => {
      releaseFirstFence = resolve;
    });
    let markFirstFenceStarted!: () => void;
    const firstFenceStarted = new Promise<void>((resolve) => {
      markFirstFenceStarted = resolve;
    });
    mocks.beginRemoteRemoval.mockImplementation(async () => {
      if (mocks.beginRemoteRemoval.mock.calls.length === 1) {
        markFirstFenceStarted();
        await firstFenceGate;
      }
      return "ready";
    });

    const first = removeJournalPasswordProtectionAtomically("vault-key", boundary);
    await firstFenceStarted;
    const second = removeJournalPasswordProtectionAtomically("vault-key", boundary);
    // Attach both rejection handlers immediately so the test observes the
    // single-flight result without creating an unhandled-rejection artifact.
    const outcomes = Promise.allSettled([first, second]);
    // Give an unsafe second caller enough turns to pass the preflight and reach
    // the remote boundary. A correct origin-wide single-flight keeps it queued.
    await new Promise((resolve) => setTimeout(resolve, 25));
    releaseFirstFence();

    const [firstOutcome, secondOutcome] = await outcomes;

    expect(firstOutcome.status).toBe("fulfilled");
    expect(secondOutcome.status).toBe("rejected");
    if (secondOutcome.status === "rejected") {
      expect(secondOutcome.reason).toMatchObject({
        name: "JournalPasswordRemovalBlockedError",
        code: "removal-pending",
      });
    }
    expect(mocks.beginRemoteRemoval).toHaveBeenCalledTimes(1);
    expect(mocks.abortRemoteRemoval).not.toHaveBeenCalled();
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeUndefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeUndefined();
    const durableIntent = await getJournalSecurityRemovalIntent();
    expect(durableIntent).toMatchObject({
      ownerUserId: "account-a",
      phase: "local-committed",
      cloudCleanup: { status: "pending" },
    });
    if (firstOutcome.status === "fulfilled") {
      expect(firstOutcome.value.removalRevision).toBe(durableIntent?.operationRevision);
    }
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
      })
    );
    const fenceInventory = mocks.beginRemoteRemoval.mock.calls[0]?.[0]?.inventory;
    expect(fenceInventory).toMatchObject({
      entries: [
        expect.objectContaining({
          id: "entry-1",
          rowSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
          backupSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
          postimageBackupSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
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
      removeJournalPasswordProtectionAtomically("vault-key", boundary)
    ).rejects.toThrow();

    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toEqual(before.password);
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toEqual(before.vault);
    await expect(db.journalEntries.get("entry-1")).resolves.toEqual(before.entry);
    await expect(db.journalPhotos.get("photo-1")).resolves.toEqual(before.photo);
    await expect(db.journalAudio.get("audio-1")).resolves.toEqual(before.audio);
    await expect(db.settings.get(SK.journalDraft("new"))).resolves.toEqual(before.draft);
    await expect(db.journalSpaces.get("space-private-project")).resolves.toEqual(before.space);
    await expect(db.journalSpaceCaptures.get("capture-private-project")).resolves.toEqual(
      before.capture
    );
  });

  it("cancels an unfenced local attempt and requests fresh account authentication", async () => {
    await seedPlaintextDiary();
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
    };
    mocks.beginRemoteRemoval.mockResolvedValueOnce("fresh-auth-required-no-fence");

    const boundary = await captureJournalSecurityBoundary();
    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", boundary)
    ).rejects.toMatchObject({
      name: "JournalPasswordRemovalBlockedError",
      code: "fresh-auth-required",
      recoveryAction: "reauthenticate",
    });

    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toEqual(before.password);
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toEqual(before.vault);
    await expect(db.journalEntries.get("entry-1")).resolves.toEqual(before.entry);
    await expect(db.settings.get(SK.JOURNAL_SECURITY_REMOVAL)).resolves.toBeUndefined();
    expect(mocks.abortRemoteRemoval).not.toHaveBeenCalled();
  });

  it("durably retries the exact remote abort after a post-fence local rollback", async () => {
    await db.settings.put({ key: SK.DATA_OWNER_ID, value: "account-a" });
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
    mocks.abortRemoteRemoval.mockRejectedValueOnce(new Error("abort network unavailable"));

    const boundary = await captureJournalSecurityBoundary();
    await expect(removeJournalPasswordProtectionAtomically("vault-key", boundary)).rejects.toThrow(
      "capture write unavailable"
    );
    captureWrite.mockRestore();

    const abortIntent = await getJournalSecurityRemovalIntent();
    expect(abortIntent).toMatchObject({
      operationRevision: expect.any(String),
      expectedVaultRevision: 101,
      phase: "abort-pending",
    });
    mocks.abortRemoteRemoval.mockResolvedValueOnce("aborted");

    const retryBoundary = await captureJournalSecurityBoundary();
    const localIntentDelete = vi
      .spyOn(db.settings, "delete")
      .mockRejectedValueOnce(new Error("local abort acknowledgement unavailable"));
    await expect(
      recoverPendingJournalPasswordRemovalAbort(abortIntent!, retryBoundary)
    ).rejects.toThrow("local abort acknowledgement unavailable");
    localIntentDelete.mockRestore();
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      operationRevision: abortIntent!.operationRevision,
      phase: "abort-pending",
    });

    mocks.abortRemoteRemoval.mockResolvedValueOnce("aborted");
    const restartBoundary = await captureJournalSecurityBoundary();
    await expect(
      recoverPendingJournalPasswordRemovalAbort(abortIntent!, restartBoundary)
    ).resolves.toBe("aborted");
    expect(mocks.abortRemoteRemoval).toHaveBeenCalledTimes(3);

    await expect(getJournalSecurityRemovalIntent()).resolves.toBeNull();
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeDefined();

    const newBoundary = await captureJournalSecurityBoundary();
    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", newBoundary)
    ).resolves.toMatchObject({ cloudMigrationPending: true });
  });

  it("retains the exact local recovery intent when recent authentication expires after a remote fence", async () => {
    await db.settings.put({ key: SK.DATA_OWNER_ID, value: "account-a" });
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const operationRevision = "1785847000000:existingfence";
    const cloudCleanup = {
      status: "not-started" as const,
      stage: "entries" as const,
      entryIds: [],
      photos: [],
      audios: [],
      deletedEntries: [],
      deletedPhotos: [],
      deletedAudios: [],
      backupPending: false,
      attemptCount: 0,
    };
    await db.settings.put({
      key: SK.JOURNAL_SECURITY_REMOVAL,
      value: {
        version: 2,
        revision: operationRevision,
        operationRevision,
        expectedVaultRevision: 101,
        ownerUserId: "account-a",
        createdAt: 1785847000000,
        updatedAt: 1785847000000,
        phase: "remote-fenced",
        attemptCount: 1,
        nativeCleanup: { status: "not-started" },
        cloudCleanup,
        status: "pending",
        photos: [],
        audios: [],
      },
    });
    mocks.beginRemoteRemoval.mockResolvedValueOnce("fresh-auth-required-existing-fence");

    const boundary = await captureJournalSecurityBoundary();
    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", boundary)
    ).rejects.toMatchObject({
      name: "JournalPasswordRemovalBlockedError",
      code: "fresh-auth-required",
      recoveryAction: "reauthenticate",
    });

    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      operationRevision,
      expectedVaultRevision: 101,
      phase: "remote-fenced",
    });
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
    mocks.downloadMedia.mockResolvedValue("media-enc:vault-key:data:image/jpeg;base64,plain");
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
      removeJournalPasswordProtectionAtomically("vault-key", boundary)
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
      boundary
    );

    expect(disposition).toBe("recorded");

    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      phase: "remote-recovery",
      operationRevision: "100:orphanoperation",
      blocker: "unlock-required",
      cloudCleanup: { status: "complete" },
    });

    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", boundary)
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

  it("rebuilds the same operation after local intent loss and resumes a partially mutated server fence", async () => {
    const operationRevision = "100:partialorphan";
    await db.settings.put({ key: SK.DATA_OWNER_ID, value: "account-a" });
    await seedPlaintextDiary();
    await seedPlaintextDraftAndSpaces();
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    // The crash window being characterized has no local removal marker, while
    // the server still reports that this exact operation already mutated data.
    await db.settings.delete(SK.JOURNAL_SECURITY_REMOVAL);

    const boundary = await captureJournalSecurityBoundary();
    await expect(
      recordOrphanedRemoteJournalPasswordRemoval(
        {
          operationRevision,
          vaultRevision: vaultSetting.updatedAt,
          remoteStatus: "manual-recovery-required",
        },
        boundary
      )
    ).resolves.toBe("recorded");
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      phase: "remote-recovery",
      operationRevision,
      blocker: "unlock-required",
    });

    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", boundary)
    ).resolves.toMatchObject({
      cloudMigrationPending: true,
      removalRevision: operationRevision,
    });
    expect(mocks.beginRemoteRemoval).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedOwnerUserId: "account-a",
        expectedVaultRevision: vaultSetting.updatedAt,
        operationRevision,
      })
    );

    let intent = await getJournalSecurityRemovalIntent();
    expect(intent).toMatchObject({
      phase: "local-committed",
      operationRevision,
      localCommitInventory: expect.objectContaining({
        entryIds: ["entry-1"],
        photoIds: ["photo-1"],
        audioIds: ["audio-1"],
      }),
    });
    await recordJournalSecurityRemovalNativeCleanup(operationRevision, "complete");
    intent = await getJournalSecurityRemovalIntent();

    const controller = new AbortController();
    let releaseEntryCommit!: () => void;
    const entryCommitGate = new Promise<void>((resolve) => {
      releaseEntryCommit = resolve;
    });
    mocks.commitRemovalEntry.mockImplementationOnce(async () => {
      await entryCommitGate;
      return { status: "committed" };
    });

    const interruptedResume = runJournalSecurityMigration(
      { mode: "remove", revision: intent!.revision },
      "account-a",
      controller.signal
    );
    await vi.waitFor(() => expect(mocks.commitRemovalEntry).toHaveBeenCalledTimes(1));
    controller.abort(new Error("recovery worker restarted"));
    releaseEntryCommit();

    await expect(interruptedResume).rejects.toThrow(/restarted|aborted/i);
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      operationRevision,
      cloudCleanup: { entryIds: ["entry-1"] },
    });

    await runJournalSecurityMigration({ mode: "remove", revision: intent!.revision }, "account-a");

    expect(mocks.commitRemovalEntry).toHaveBeenCalledTimes(2);
    expect(mocks.commitRemovalEntry).toHaveBeenLastCalledWith(
      expect.objectContaining({ operationRevision })
    );
    expect(mocks.patchJournalBackup).toHaveBeenCalledWith(
      expect.objectContaining({ operationRevision })
    );
    await expect(getJournalSecurityRemovalIntent()).resolves.toBeNull();
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
        boundary
      )
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
    await recordJournalSecurityRemovalNativeCleanup(committed!.operationRevision, "failed");

    await expect(
      recordOrphanedRemoteJournalPasswordRemoval(
        {
          operationRevision: committed!.operationRevision,
          vaultRevision: committed!.expectedVaultRevision,
          remoteStatus: "complete",
        },
        boundary
      )
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
          replacementContentSha256: "a".repeat(64),
          replacementContentSize: 128,
          replacementMimeType: "image/jpeg",
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
        boundary
      )
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
    mocks.currentUserId = null;
    await db.settings.delete(SK.DATA_OWNER_ID);
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
      { requireRemoteCommit: true }
    );
    expect(mocks.syncJournalEntry).toHaveBeenCalled();
    expect(mocks.syncSetting.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.syncJournalEntry.mock.invocationCallOrder[0]
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
    await expect(removeJournalPasswordProtectionAtomically(null, boundary)).resolves.toMatchObject({
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
    await expect(preflightJournalPasswordRemoval("vault-key", boundary)).resolves.toMatchObject({
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

  it.each([
    {
      label: "entry",
      blocker: "decrypt-entry",
      corrupt: async () => {
        await db.journalEntries.update("entry-1", { content: "damaged-entry-envelope" });
      },
    },
    {
      label: "photo",
      blocker: "decrypt-media",
      corrupt: async () => {
        await db.journalPhotos.update("photo-1", { data: "data:image/jpeg;base64,damaged" });
      },
    },
    {
      label: "audio",
      blocker: "decrypt-media",
      corrupt: async () => {
        await db.journalAudio.update("audio-1", { data: "data:audio/webm;base64,damaged" });
      },
    },
    {
      label: "draft",
      blocker: "decrypt-draft",
      corrupt: async () => {
        const record = await db.settings.get(SK.journalDraft("new"));
        await db.settings.put({
          key: SK.journalDraft("new"),
          value: { ...(record?.value as object), content: "damaged draft envelope" },
        });
      },
    },
    {
      label: "space",
      blocker: "decrypt-space",
      corrupt: async () => {
        await db.journalSpaces.update("space-private-project", {
          name: "damaged space envelope",
        });
      },
    },
    {
      label: "capture",
      blocker: "decrypt-capture",
      corrupt: async () => {
        await db.journalSpaceCaptures.update("capture-private-project", {
          title: "damaged capture envelope",
        });
      },
    },
  ] as const)(
    "fails closed when a vault-bound $label loses its authenticated envelope marker",
    async ({ blocker, corrupt }) => {
      await seedPlaintextDiary();
      await seedPlaintextDraftAndSpaces();
      await activateJournalPasswordProtection({
        passwordData,
        vaultSetting,
        vaultKey: "vault-key",
      });
      await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
      await corrupt();
      const boundary = await captureJournalSecurityBoundary();

      await expect(preflightJournalPasswordRemoval("vault-key", boundary)).resolves.toEqual({
        status: blocker,
        recoveryAction: "retry",
      });
      expect(mocks.beginRemoteRemoval).not.toHaveBeenCalled();
      await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
      await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeDefined();
    }
  );

  it("removes multiple valid large remote media objects without a global size dead-end", async () => {
    await seedPlaintextDiary();
    await db.journalEntries.update("entry-1", { audioIds: ["audio-1", "audio-2"] });
    await db.journalAudio.put({
      id: "audio-2",
      entryId: "entry-1",
      data: "data:audio/webm;base64,second",
      duration: 10,
      mimeType: "audio/webm",
      createdAt: 2,
      storagePath: "account-a/audio-2.webm",
    });
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    await Promise.all([
      db.journalAudio.update("audio-1", { storagePath: "account-a/audio-1.v101.bin" }),
      db.journalAudio.update("audio-2", { storagePath: "account-a/audio-2.v101.bin" }),
    ]);
    mocks.readMediaIdentity.mockImplementation(
      (bucket: "journal-photos" | "journal-audio", path: string) =>
        Promise.resolve({
          bucket,
          path,
          objectId: `${bucket}:${path}`,
          version: "storage-version-1",
          etag: "etag-1",
          size: 16 * 1024 * 1024,
        })
    );
    mocks.downloadMedia.mockResolvedValue("media-enc:vault-key:data:audio/webm;base64,protected");
    const boundary = await captureJournalSecurityBoundary();

    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", boundary)
    ).resolves.toMatchObject({ cloudMigrationPending: true });
    expect(mocks.downloadMedia).toHaveBeenCalled();
    expect(mocks.beginRemoteRemoval).toHaveBeenCalledTimes(1);
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeUndefined();
    await expect(db.journalPasswordRemovalMediaStage.count()).resolves.toBe(0);
  });

  it("does not materialize every media row through toArray during removal", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);

    const photoToArray = vi
      .spyOn(db.journalPhotos, "toArray")
      .mockRejectedValue(new Error("bulk photo materialization is forbidden"));
    const audioToArray = vi
      .spyOn(db.journalAudio, "toArray")
      .mockRejectedValue(new Error("bulk audio materialization is forbidden"));
    const boundary = await captureJournalSecurityBoundary();

    try {
      await expect(
        removeJournalPasswordProtectionAtomically("vault-key", boundary)
      ).resolves.toMatchObject({ cloudMigrationPending: true });
      expect(photoToArray).not.toHaveBeenCalled();
      expect(audioToArray).not.toHaveBeenCalled();
    } finally {
      photoToArray.mockRestore();
      audioToArray.mockRestore();
    }
  });

  it("keeps password protection intact when encrypted staging hits quota", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    await db.journalAudio.update("audio-1", {
      data: undefined,
      storagePath: "account-a/audio-1.bin",
    });
    mocks.downloadMedia.mockResolvedValue("media-enc:vault-key:data:audio/webm;base64,protected");
    const rejectStage = () => {
      throw new DOMException("Encrypted staging quota exhausted", "QuotaExceededError");
    };
    db.journalPasswordRemovalMediaStage.hook("creating", rejectStage);
    const boundary = await captureJournalSecurityBoundary();

    try {
      await expect(
        removeJournalPasswordProtectionAtomically("vault-key", boundary)
      ).rejects.toMatchObject({ code: "decrypt-media" });
      await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
      await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeDefined();
      await expect(db.journalPasswordRemovalMediaStage.count()).resolves.toBe(0);
      expect(mocks.beginRemoteRemoval).not.toHaveBeenCalled();
    } finally {
      db.journalPasswordRemovalMediaStage.hook("creating").unsubscribe(rejectStage);
    }
  });

  it("rejects swapped same-kind staged ciphertext without mutating the protected journal", async () => {
    await seedPlaintextDiary();
    await db.journalEntries.update("entry-1", { audioIds: ["audio-1", "audio-2"] });
    await db.journalAudio.put({
      id: "audio-2",
      entryId: "entry-1",
      data: "data:audio/webm;base64,second",
      duration: 10,
      mimeType: "audio/webm",
      createdAt: 2,
      storagePath: "account-a/audio-2.webm",
    });
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    await Promise.all([
      db.journalAudio.update("audio-1", {
        data: undefined,
        storagePath: "account-a/audio-1.v101.bin",
      }),
      db.journalAudio.update("audio-2", {
        data: undefined,
        storagePath: "account-a/audio-2.v101.bin",
      }),
    ]);
    mocks.readMediaIdentity.mockImplementation(
      (bucket: "journal-photos" | "journal-audio", path: string) =>
        Promise.resolve({
          bucket,
          path,
          objectId: `${bucket}:${path}`,
          version: "storage-version-1",
          etag: `etag:${path}`,
          size: 128,
        })
    );
    mocks.downloadMedia.mockImplementation(async (_bucket: string, path: string) =>
      path.includes("audio-1")
        ? "media-enc:vault-key:data:audio/webm;base64,first"
        : "media-enc:vault-key:data:audio/webm;base64,second"
    );
    mocks.beginRemoteRemoval.mockImplementationOnce(async () => {
      const staged = await db.journalPasswordRemovalMediaStage.toArray();
      expect(staged).toHaveLength(2);
      const [first, second] = staged;
      await db.journalPasswordRemovalMediaStage.bulkPut([
        {
          ...first,
          encryptedData: second.encryptedData,
          encryptedDataSha256: second.encryptedDataSha256,
        },
        {
          ...second,
          encryptedData: first.encryptedData,
          encryptedDataSha256: first.encryptedDataSha256,
        },
      ]);
      return "ready";
    });
    const protectedSettings = await Promise.all([
      db.settings.get(SK.JOURNAL_PASSWORD),
      db.settings.get(SK.JOURNAL_VAULT_KEY),
    ]);
    const protectedAudios = await db.journalAudio.toArray();
    const boundary = await captureJournalSecurityBoundary();

    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", boundary)
    ).rejects.toMatchObject({ code: "vault-revision-mismatch" });
    await expect(
      Promise.all([db.settings.get(SK.JOURNAL_PASSWORD), db.settings.get(SK.JOURNAL_VAULT_KEY)])
    ).resolves.toEqual(protectedSettings);
    await expect(db.journalAudio.toArray()).resolves.toEqual(protectedAudios);
    await expect(db.journalPasswordRemovalMediaStage.count()).resolves.toBe(0);
  });

  it.each([
    {
      label: "photo",
      corrupt: async () => {
        await db.journalPhotos.update("photo-1", {
          data: "media-enc:vault-key:data:text/html;base64,PHNjcmlwdD4=",
        });
      },
    },
    {
      label: "audio",
      corrupt: async () => {
        await db.journalAudio.update("audio-1", {
          data: "media-enc:vault-key:data:audio/mpeg;base64,YXVkaW8=",
        });
      },
    },
  ])(
    "rejects an authenticated $label payload whose clear MIME violates its row contract",
    async ({ corrupt }) => {
      await seedPlaintextDiary();
      await activateJournalPasswordProtection({
        passwordData,
        vaultSetting,
        vaultKey: "vault-key",
      });
      await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
      await corrupt();
      const boundary = await captureJournalSecurityBoundary();

      await expect(preflightJournalPasswordRemoval("vault-key", boundary)).resolves.toEqual({
        status: "decrypt-media",
        recoveryAction: "retry",
      });
      expect(mocks.beginRemoteRemoval).not.toHaveBeenCalled();
      await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
      await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeDefined();
    }
  );

  it("prunes expired, owner-mismatched, and crash-orphaned ciphertext staging", async () => {
    const now = 10_000_000;
    await db.settings.put({ key: SK.DATA_OWNER_ID, value: "account-a" });
    await db.settings.put({
      key: SK.JOURNAL_SECURITY_REMOVAL,
      value: {
        version: 1,
        revision: "operation-a",
        ownerUserId: "account-a",
        createdAt: now - 1_000,
        status: "pending",
      },
    });
    const intent = await getJournalSecurityRemovalIntent();
    expect(intent).not.toBeNull();
    const validKey = `operation-a\u0000audio\u0000audio-valid`;
    await db.journalPasswordRemovalMediaStage.bulkPut([
      {
        key: validKey,
        operationRevision: "operation-a",
        ownerUserId: "account-a",
        mediaKind: "audio",
        mediaId: "audio-valid",
        entryId: "entry-1",
        sourceRecordSha256: "source-valid",
        encryptedDataSha256: "af6e95083bd7fba40587b3e50fb47f62be0895f13ed390c47e2973b87fa5ca31",
        encryptedData: "media-enc:vault-key:ciphertext-valid",
        createdAt: now - 1_000,
      },
      {
        key: `operation-a\u0000audio\u0000audio-expired`,
        operationRevision: "operation-a",
        ownerUserId: "account-a",
        mediaKind: "audio",
        mediaId: "audio-expired",
        entryId: "entry-1",
        sourceRecordSha256: "source-expired",
        encryptedDataSha256: "febdae085b2d4f25e597f4561e5f78e55f588695f61830ab42af5db8e51eb2a7",
        encryptedData: "media-enc:vault-key:ciphertext-expired",
        createdAt: now - 31 * 60 * 1_000,
      },
      {
        key: `operation-a\u0000photo\u0000photo-other-owner`,
        operationRevision: "operation-a",
        ownerUserId: "account-b",
        mediaKind: "photo",
        mediaId: "photo-other-owner",
        entryId: "entry-1",
        sourceRecordSha256: "source-other",
        encryptedDataSha256: "f61e32affcf8a6e7395456e316a2717126b2e5829d17fe6a30dda367f92bc705",
        encryptedData: "media-enc:vault-key:ciphertext-other",
        createdAt: now - 1_000,
      },
    ]);
    const boundary = await captureJournalSecurityBoundary();

    await expect(pruneJournalPasswordRemovalMediaStage(intent, boundary, now)).resolves.toBe(2);
    await expect(db.journalPasswordRemovalMediaStage.toArray()).resolves.toEqual([
      expect.objectContaining({ key: validKey, ownerUserId: "account-a" }),
    ]);

    await expect(pruneJournalPasswordRemovalMediaStage(null, boundary, now)).resolves.toBe(1);
    await expect(db.journalPasswordRemovalMediaStage.count()).resolves.toBe(0);
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
    await expect(preflightJournalPasswordRemoval("vault-key", boundary)).resolves.toMatchObject({
      status: "ready",
    });
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
    await expect(removeJournalPasswordProtectionAtomically(null, boundary)).rejects.toMatchObject({
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
    await expect(removeJournalPasswordProtectionAtomically("vault-key", boundary)).rejects.toThrow(
      "capture write unavailable"
    );

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
    expect(mocks.abortRemoteRemoval).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedOwnerUserId: "account-a",
        expectedVaultRevision: 101,
      })
    );
    await expect(getJournalSecurityRemovalIntent()).resolves.toBeNull();
  });

  it("never settles or aborts account A's remote fence after the session changes to account B", async () => {
    await db.settings.put({ key: SK.DATA_OWNER_ID, value: "account-a" });
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
      .mockImplementationOnce(() => {
        mocks.currentUserId = "account-b";
        throw new Error("capture write unavailable after account switch");
      });

    const boundary = await captureJournalSecurityBoundary();
    await expect(
      removeJournalPasswordProtectionAtomically("vault-key", boundary)
    ).rejects.toThrow("capture write unavailable after account switch");
    captureWrite.mockRestore();

    expect(mocks.abortRemoteRemoval).not.toHaveBeenCalled();
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toBeDefined();
    await expect(db.journalEntries.get("entry-1")).resolves.toMatchObject({
      content: "entry-enc:vault-key:plaintext entry",
    });
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      ownerUserId: "account-a",
      phase: "remote-fenced",
      operationRevision: expect.any(String),
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
      }
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

  it("deletes frozen entry, photo, and audio artifacts before finalizing password removal", async () => {
    await seedPlaintextDiary();
    await db.journalEntries.put({
      id: "entry-2",
      date: "2026-07-11",
      title: "Second private entry",
      content: "second plaintext entry",
      stickers: [],
      tags: [],
      photoIds: ["photo-2"],
      audioIds: ["audio-2"],
      createdAt: 2,
      updatedAt: 2,
    });
    await db.journalPhotos.put({
      id: "photo-2",
      entryId: "entry-2",
      data: "data:image/jpeg;base64,second",
      thumbnail: "data:image/jpeg;base64,second-thumb",
      width: 120,
      height: 90,
      createdAt: 2,
      storagePath: "account-a/photo-2.jpg",
    });
    await db.journalAudio.put({
      id: "audio-2",
      entryId: "entry-2",
      data: "data:audio/webm;base64,second",
      duration: 12,
      mimeType: "audio/webm",
      createdAt: 2,
      storagePath: "account-a/audio-2.webm",
    });
    await activateJournalPasswordProtection({
      passwordData,
      vaultSetting,
      vaultKey: "vault-key",
    });
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
        await db.journalEntries.update("entry-2", { photoIds: [], audioIds: [] });
        await db.journalPhotos.delete("photo-2");
        await db.journalAudio.delete("audio-2");
        await removeDeletedJournalArtifactsFromSecurityMigration({
          entryIds: ["entry-1"],
          photoIds: ["photo-1", "photo-2"],
          audioIds: ["audio-1", "audio-2"],
        });
      }
    );

    let removalIntent = await getJournalSecurityRemovalIntent();
    expect(removalIntent).toMatchObject({
      cloudCleanup: {
        entryIds: ["entry-2"],
        photos: [],
        audios: [],
        deletedEntries: [{ id: "entry-1" }],
        deletedPhotos: [{ id: "photo-2", entryId: "entry-2" }],
        deletedAudios: [{ id: "audio-2", entryId: "entry-2" }],
      },
      localCommitInventory: {
        entryIds: ["entry-2"],
        photoIds: [],
        audioIds: [],
        deletedEntryIds: ["entry-1"],
        deletedPhotoIds: ["photo-1", "photo-2"],
        deletedAudioIds: ["audio-1", "audio-2"],
      },
    });
    await recordJournalSecurityRemovalNativeCleanup(removalIntent!.operationRevision, "complete");
    removalIntent = await getJournalSecurityRemovalIntent();

    mocks.deleteRemovalArtifact
      .mockResolvedValueOnce({ status: "committed" })
      .mockRejectedValueOnce(new Error("remote deletion acknowledgement was lost"));

    await expect(
      runJournalSecurityMigration(
        { mode: "remove", revision: removalIntent!.revision },
        "account-a"
      )
    ).rejects.toThrow("remote deletion acknowledgement was lost");

    expect(mocks.finalizeRemoteRemoval).not.toHaveBeenCalled();
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      ownerUserId: "account-a",
      operationRevision: removalIntent!.operationRevision,
      expectedVaultRevision: vaultSetting.updatedAt,
      cloudCleanup: {
        deletedEntries: [],
        deletedPhotos: [{ id: "photo-2", entryId: "entry-2" }],
        deletedAudios: [{ id: "audio-2", entryId: "entry-2" }],
      },
    });

    await runJournalSecurityMigration(
      { mode: "remove", revision: removalIntent!.revision },
      "account-a"
    );

    expect(mocks.deleteRemovalArtifact).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        expectedOwnerUserId: "account-a",
        expectedVaultRevision: vaultSetting.updatedAt,
        operationRevision: removalIntent!.operationRevision,
        surface: "entry",
        entityId: "entry-1",
      })
    );
    expect(mocks.deleteRemovalArtifact).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        expectedOwnerUserId: "account-a",
        expectedVaultRevision: vaultSetting.updatedAt,
        operationRevision: removalIntent!.operationRevision,
        surface: "photo",
        entityId: "photo-2",
        parentEntry: expect.objectContaining({
          id: "entry-2",
          photoIds: [],
          audioIds: [],
        }),
      })
    );
    expect(mocks.deleteRemovalArtifact).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        expectedOwnerUserId: "account-a",
        expectedVaultRevision: vaultSetting.updatedAt,
        operationRevision: removalIntent!.operationRevision,
        surface: "photo",
        entityId: "photo-2",
        parentEntry: expect.objectContaining({
          id: "entry-2",
          photoIds: [],
          audioIds: [],
        }),
      })
    );
    expect(mocks.deleteRemovalArtifact).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        expectedOwnerUserId: "account-a",
        expectedVaultRevision: vaultSetting.updatedAt,
        operationRevision: removalIntent!.operationRevision,
        surface: "audio",
        entityId: "audio-2",
        parentEntry: expect.objectContaining({
          id: "entry-2",
          photoIds: [],
          audioIds: [],
        }),
      })
    );
    expect(
      mocks.deleteRemovalArtifact.mock.calls.filter(
        ([call]) => (call as { surface?: string }).surface === "entry"
      )
    ).toHaveLength(1);
    expect(mocks.finalizeRemoteRemoval).toHaveBeenCalledTimes(1);
    expect(mocks.deleteRemovalArtifact.mock.invocationCallOrder.at(-1)).toBeLessThan(
      mocks.finalizeRemoteRemoval.mock.invocationCallOrder[0]
    );
    expect(mocks.deleteStoragePath).toHaveBeenCalledWith(
      "journal-photos",
      "account-a/photo-1.jpg",
      "account-a",
      undefined
    );
    expect(mocks.deleteStoragePath).toHaveBeenCalledWith(
      "journal-audio",
      "account-a/audio-2.webm",
      "account-a",
      undefined
    );
    await expect(getJournalSecurityRemovalIntent()).resolves.toBeNull();
  });

  it("keeps post-fence create-delete records outside the frozen removal inventory", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);
    const before = await getJournalSecurityRemovalIntent();
    expect(before?.localCommitInventory?.entryIds).toEqual(["entry-1"]);

    await db.journalEntries.put({
      id: "entry-after-fence",
      date: "2026-08-03",
      title: "Created after local removal",
      content: "plaintext",
      stickers: [],
      tags: [],
      photoIds: ["photo-after-fence"],
      audioIds: ["audio-after-fence"],
      createdAt: 20,
      updatedAt: 20,
    });
    await db.journalPhotos.put({
      id: "photo-after-fence",
      entryId: "entry-after-fence",
      data: "data:image/jpeg;base64,new",
      thumbnail: "data:image/jpeg;base64,new-thumb",
      width: 10,
      height: 10,
      createdAt: 20,
    });
    await db.journalAudio.put({
      id: "audio-after-fence",
      entryId: "entry-after-fence",
      data: "data:audio/webm;base64,new",
      duration: 1,
      mimeType: "audio/webm",
      createdAt: 20,
    });
    await Promise.all([
      db.journalPhotos.delete("photo-after-fence"),
      db.journalAudio.delete("audio-after-fence"),
      db.journalEntries.delete("entry-after-fence"),
    ]);

    await expect(
      removeDeletedJournalArtifactsFromSecurityMigration({
        entryIds: ["entry-after-fence"],
        photoIds: ["photo-after-fence"],
        audioIds: ["audio-after-fence"],
      })
    ).resolves.toBeUndefined();

    const after = await getJournalSecurityRemovalIntent();
    expect(after).toEqual(before);
    expect(after?.cloudCleanup.deletedEntries).toEqual([]);
    expect(after?.cloudCleanup.deletedPhotos).toEqual([]);
    expect(after?.cloudCleanup.deletedAudios).toEqual([]);
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
      "photo metadata unavailable"
    );

    expect((await db.journalPhotos.get("photo-1"))?.storagePath).toBe("account-a/photo-1.jpg");
    expect(mocks.deleteStoragePath).not.toHaveBeenCalledWith(
      "journal-photos",
      "account-a/photo-1.jpg",
      "account-a"
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
    ).resolves.toBe("complete");
    expect(await getJournalSecurityMigrationIntent()).toBeNull();
  });

  it("does not hold the origin write barrier while a read-only removal preflight waits on media", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    await db.journalPhotos.update("photo-1", {
      data: undefined,
      storagePath: "account-a/photo-1.v101.bin",
    });
    let releaseDownload!: () => void;
    const downloadGate = new Promise<void>((resolve) => {
      releaseDownload = resolve;
    });
    let markDownloadStarted!: () => void;
    const downloadStarted = new Promise<void>((resolve) => {
      markDownloadStarted = resolve;
    });
    mocks.downloadMedia.mockImplementationOnce(async () => {
      markDownloadStarted();
      await downloadGate;
      return "media-enc:vault-key:data:image/jpeg;base64,plain";
    });
    const boundary = await captureJournalSecurityBoundary();
    const removal = removeJournalPasswordProtectionAtomically("vault-key", boundary);
    await downloadStarted;

    const competingBoundaryWork = runWithJournalSecurityBoundary(
      boundary,
      async () => "acquired" as const
    );
    const disposition = await Promise.race([
      competingBoundaryWork,
      new Promise<"blocked">((resolve) => setTimeout(() => resolve("blocked"), 100)),
    ]);

    releaseDownload();
    await removal;
    await competingBoundaryWork;
    expect(disposition).toBe("acquired");
  });

  it("retains cloud progress when an aborted removal request resolves late, then resumes", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);
    let removalIntent = await getJournalSecurityRemovalIntent();
    await recordJournalSecurityRemovalNativeCleanup(removalIntent!.operationRevision, "complete");
    removalIntent = await getJournalSecurityRemovalIntent();
    const controller = new AbortController();
    let releaseEntryCommit!: () => void;
    const entryCommitGate = new Promise<void>((resolve) => {
      releaseEntryCommit = resolve;
    });
    mocks.commitRemovalEntry.mockImplementationOnce(async () => {
      await entryCommitGate;
      return { status: "committed" };
    });

    const firstAttempt = runJournalSecurityMigration(
      { mode: "remove", revision: removalIntent!.revision },
      "account-a",
      controller.signal
    );
    await vi.waitFor(() => expect(mocks.commitRemovalEntry).toHaveBeenCalledTimes(1));
    controller.abort(new Error("queue attempt timed out"));
    releaseEntryCommit();

    await expect(firstAttempt).rejects.toThrow(/timed out|aborted/i);
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      cloudCleanup: { entryIds: ["entry-1"] },
    });

    await runJournalSecurityMigration(
      { mode: "remove", revision: removalIntent!.revision },
      "account-a"
    );
    await expect(getJournalSecurityRemovalIntent()).resolves.toBeNull();
  });

  it("persists the exact media receipt before the first reservation or upload", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);
    const removalIntent = await getJournalSecurityRemovalIntent();
    expect(removalIntent).not.toBeNull();
    await recordJournalSecurityRemovalNativeCleanup(removalIntent!.operationRevision, "complete");

    mocks.reserveRemovalMedia.mockImplementationOnce(async (reservation: unknown) => {
      const persisted = await getJournalSecurityRemovalIntent();
      expect(persisted?.cloudCleanup.photos[0]).toMatchObject({
        id: "photo-1",
        replacementStoragePath: `account-a/removal/${removalIntent!.operationRevision}/photo-1.jpg`,
        replacementContentSha256: "a".repeat(64),
        replacementContentSize: 128,
        replacementMimeType: "image/jpeg",
        replacementUploaded: false,
      });
      expect(reservation).toMatchObject({
        bucket: "journal-photos",
        entityId: "photo-1",
        storagePath: `account-a/removal/${removalIntent!.operationRevision}/photo-1.jpg`,
        contentSha256: "a".repeat(64),
        contentSize: 128,
        mimeType: "image/jpeg",
      });
      expect(mocks.uploadPreparedRemoval).not.toHaveBeenCalled();
      return { status: "committed" };
    });

    await runJournalSecurityMigration(
      { mode: "remove", revision: removalIntent!.revision },
      "account-a"
    );

    expect(mocks.reserveRemovalMedia).toHaveBeenCalled();
    expect(mocks.uploadPreparedRemoval).toHaveBeenCalled();
  });

  it("adopts a legacy v1 removal only after the server accepts the real plaintext inventory", async () => {
    await seedPlaintextDiary();
    await db.settings.bulkPut([
      { key: SK.JOURNAL_VAULT_REVISION, value: 101 },
      {
        key: SK.JOURNAL_SECURITY_REMOVAL,
        value: {
          version: 1,
          revision: "100:legacyremoval",
          ownerUserId: "account-a",
          createdAt: 100,
          status: "queued",
        },
      },
    ]);

    await runJournalSecurityMigration(
      { mode: "remove", revision: "100:legacyremoval" },
      "account-a"
    );

    expect(mocks.beginRemoteRemoval).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedOwnerUserId: "account-a",
        expectedVaultRevision: 101,
        operationRevision: "100:legacyremoval",
        inventory: expect.objectContaining({
          entries: [expect.objectContaining({ id: "entry-1" })],
          photos: [expect.objectContaining({ id: "photo-1" })],
          audios: [expect.objectContaining({ id: "audio-1" })],
        }),
      })
    );
    expect(mocks.finalizeRemoteRemoval).toHaveBeenCalled();
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      cloudCleanup: { status: "complete" },
      nativeCleanup: { status: "pending" },
      legacyOrigin: undefined,
    });
  });

  it("persists legacy media identity progress across bounded queue slices", async () => {
    await seedPlaintextDiary();
    const legacyPhotos = Array.from({ length: 8 }, (_, index) => ({
      id: `legacy-photo-${index}`,
      previousStoragePath: `account-a/legacy-photo-${index}.bin`,
    }));
    await db.settings.bulkPut([
      { key: SK.JOURNAL_VAULT_REVISION, value: 101 },
      {
        key: SK.JOURNAL_SECURITY_REMOVAL,
        value: {
          version: 1,
          revision: "100:boundedlegacy",
          ownerUserId: "account-a",
          createdAt: 100,
          status: "queued",
          photos: legacyPhotos,
        },
      },
    ]);
    mocks.beginRemoteRemoval.mockResolvedValueOnce("complete");

    const observedCursors: number[] = [];
    let result: "complete" | "deferred" = "deferred";
    for (let attempt = 0; attempt < 12 && result === "deferred"; attempt += 1) {
      result = await runJournalSecurityMigration(
        { mode: "remove", revision: "100:boundedlegacy" },
        "account-a",
        undefined,
        { maxRemoteSteps: 1, workBudgetMs: 30_000 }
      );
      const current = await getJournalSecurityRemovalIntent();
      observedCursors.push(current?.legacyMediaCursor ?? legacyPhotos.length);
    }

    expect(result).toBe("complete");
    expect(observedCursors).toEqual([...observedCursors].sort((left, right) => left - right));
    expect(observedCursors).toContain(legacyPhotos.length);
    expect(mocks.recoverRemoteRemoval).toHaveBeenCalledTimes(1);
    expect(mocks.readMediaIdentity).toHaveBeenCalledTimes(legacyPhotos.length);
    expect(mocks.beginRemoteRemoval).toHaveBeenCalledTimes(1);
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      legacyOrigin: undefined,
      legacyRecoveryChecked: undefined,
      legacyMediaCursor: undefined,
      legacyStorageObjects: undefined,
      cloudCleanup: { status: "complete" },
    });
  });

  it("converges a legacy v1 crash only after the server proves the exact operation complete", async () => {
    await seedPlaintextDiary();
    await db.settings.bulkPut([
      { key: SK.JOURNAL_VAULT_REVISION, value: 101 },
      {
        key: SK.JOURNAL_SECURITY_REMOVAL,
        value: {
          version: 1,
          revision: "100:legacyremoval",
          ownerUserId: "account-a",
          createdAt: 100,
          status: "queued",
        },
      },
    ]);
    mocks.recoverRemoteRemoval.mockResolvedValueOnce({
      status: "complete",
      operationRevision: "100:legacyremoval",
      vaultRevision: 101,
    });

    await expect(
      runJournalSecurityMigration({ mode: "remove", revision: "100:legacyremoval" }, "account-a")
    ).resolves.toBe("complete");

    expect(mocks.beginRemoteRemoval).not.toHaveBeenCalled();
    expect(mocks.patchJournalBackup).not.toHaveBeenCalled();
    expect(mocks.finalizeRemoteRemoval).not.toHaveBeenCalled();
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      legacyOrigin: undefined,
      cloudCleanup: { status: "complete", stage: "complete" },
      nativeCleanup: { status: "pending" },
    });
  });

  it("retains a legacy v1 marker when remote completion belongs to another operation", async () => {
    await seedPlaintextDiary();
    await db.settings.bulkPut([
      { key: SK.JOURNAL_VAULT_REVISION, value: 101 },
      {
        key: SK.JOURNAL_SECURITY_REMOVAL,
        value: {
          version: 1,
          revision: "100:legacyremoval",
          ownerUserId: "account-a",
          createdAt: 100,
          status: "queued",
        },
      },
    ]);
    mocks.recoverRemoteRemoval.mockResolvedValueOnce({
      status: "complete",
      operationRevision: "99:otheroperation",
      vaultRevision: 101,
    });

    await expect(
      runJournalSecurityMigration({ mode: "remove", revision: "100:legacyremoval" }, "account-a")
    ).rejects.toThrow(/does not match/i);

    expect(mocks.beginRemoteRemoval).not.toHaveBeenCalled();
    expect(mocks.patchJournalBackup).not.toHaveBeenCalled();
    expect(mocks.finalizeRemoteRemoval).not.toHaveBeenCalled();
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      operationRevision: "100:legacyremoval",
      legacyOrigin: true,
    });
  });

  it("completes journal-scoped plaintext commits and CAS backup before deleting the remote vault", async () => {
    await seedPlaintextDiary();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);
    let removalIntent = await getJournalSecurityRemovalIntent();
    expect(removalIntent).not.toBeNull();
    await recordJournalSecurityRemovalNativeCleanup(removalIntent!.operationRevision, "complete");
    removalIntent = await getJournalSecurityRemovalIntent();

    await runJournalSecurityMigration(
      { mode: "remove", revision: removalIntent!.revision },
      "account-a"
    );

    expect(mocks.syncWithCloud).not.toHaveBeenCalled();
    expect(mocks.commitRemovalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedOwnerUserId: "account-a",
        operationRevision: removalIntent!.operationRevision,
        entry: expect.objectContaining({ id: "entry-1", content: "plaintext entry" }),
      })
    );
    expect(mocks.patchJournalBackup).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedOwnerUserId: "account-a",
        operationRevision: removalIntent!.operationRevision,
        localCommitInventory: expect.objectContaining({
          entryIds: ["entry-1"],
          photoIds: ["photo-1"],
          audioIds: ["audio-1"],
        }),
      })
    );
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
      })
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
        : "media-enc:vault-key:data:audio/webm;base64,plain"
    );
    const encryptedPhotoPath = (await db.journalPhotos.get("photo-1"))?.storagePath;
    const encryptedAudioPath = (await db.journalAudio.get("audio-1"))?.storagePath;
    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);
    let removalIntent = await getJournalSecurityRemovalIntent();
    await recordJournalSecurityRemovalNativeCleanup(removalIntent!.operationRevision, "complete");
    removalIntent = await getJournalSecurityRemovalIntent();

    expect(removalIntent).toMatchObject({
      photos: [{ id: "photo-1", previousStoragePath: encryptedPhotoPath }],
      audios: [{ id: "audio-1", previousStoragePath: encryptedAudioPath }],
    });

    mocks.deleteStoragePath.mockRejectedValueOnce(new Error("encrypted media delete unavailable"));
    await expect(
      runJournalSecurityMigration(
        { mode: "remove", revision: removalIntent!.revision },
        "account-a"
      )
    ).rejects.toThrow("encrypted media delete unavailable");
    expect(await getJournalSecurityRemovalIntent()).toMatchObject({
      revision: removalIntent!.revision,
      photos: [{ id: "photo-1", previousStoragePath: encryptedPhotoPath }],
    });
    expect(mocks.deleteSetting).not.toHaveBeenCalled();

    await runJournalSecurityMigration(
      { mode: "remove", revision: removalIntent!.revision },
      "account-a"
    );
    expect(mocks.deleteStoragePath).toHaveBeenCalledWith(
      "journal-photos",
      encryptedPhotoPath,
      "account-a"
    );
    expect(mocks.deleteStoragePath).toHaveBeenCalledWith(
      "journal-audio",
      encryptedAudioPath,
      "account-a"
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

  it("blocks backup mutation when a committed space or capture disappears without a deletion receipt", async () => {
    await seedPlaintextDiary();
    await seedPlaintextDraftAndSpaces();
    await activateJournalPasswordProtection({ passwordData, vaultSetting, vaultKey: "vault-key" });
    await db.settings.delete(SK.JOURNAL_SECURITY_MIGRATION);
    const boundary = await captureJournalSecurityBoundary();
    await removeJournalPasswordProtectionAtomically("vault-key", boundary);
    const removalIntent = await getJournalSecurityRemovalIntent();
    await db.transaction("rw", [db.journalSpaces, db.journalSpaceCaptures], async () => {
      await db.journalSpaceCaptures.delete("capture-private-project");
      await db.journalSpaces.delete("space-private-project");
    });

    await expect(
      runJournalSecurityMigration(
        { mode: "remove", revision: removalIntent!.revision },
        "account-a"
      )
    ).rejects.toThrow(/local commit inventory is incomplete/i);

    expect(mocks.patchJournalBackup).not.toHaveBeenCalled();
    expect(mocks.verifyRemoteUnprotected).not.toHaveBeenCalled();
    expect(mocks.finalizeRemoteRemoval).not.toHaveBeenCalled();
    await expect(getJournalSecurityRemovalIntent()).resolves.toMatchObject({
      operationRevision: removalIntent!.operationRevision,
      localCommitInventory: expect.objectContaining({
        spaceIds: ["space-private-project"],
        captureIds: ["capture-private-project"],
      }),
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
