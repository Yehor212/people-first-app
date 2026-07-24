import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const journalImportCryptoMocks = vi.hoisted<{ vaultKey: string | null }>(() => ({
  vaultKey: null,
}));

const journalImportRuntimeMocks = vi.hoisted(() => ({
  encryptContent: vi.fn(async (content: string, key: string) => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    return `encrypted-entry:${key}:${content}`;
  }),
  encryptMedia: vi.fn(async (dataUrl: string, key: string) => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    return `encrypted-media:${key}:${dataUrl}`;
  }),
  triggerSync: vi.fn(),
}));

vi.mock("../journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => journalImportCryptoMocks.vaultKey),
  getJournalContentVaultRevision: vi.fn(() =>
    journalImportCryptoMocks.vaultKey ? 2 : null
  ),
}));

vi.mock("../journalCrypto", () => ({
  encryptJournalContent: journalImportRuntimeMocks.encryptContent,
  isEncryptedJournalContent: vi.fn((content: string) => content.startsWith("encrypted-entry:")),
}));

vi.mock("../journalMediaCrypto", () => ({
  encryptJournalMediaDataUrl: journalImportRuntimeMocks.encryptMedia,
  isEncryptedJournalMediaData: vi.fn((dataUrl: string) => dataUrl.startsWith("encrypted-media:")),
}));

vi.mock("@/storage/cloudSync", () => ({
  triggerSync: journalImportRuntimeMocks.triggerSync,
}));

import { db } from "@/storage/db";
import { SK } from "@/lib/storageKeys";
import { runWithDataWriteBarrier } from "@/hooks/useIndexedDB";
import {
  resumeAccountBoundaryWriters,
  suspendAccountBoundaryWriters,
} from "@/lib/accountBoundaryState";
import { importJournalBackup } from "../journalImport";

function makeImportFile(): File {
  const content = JSON.stringify({
    version: 2,
    exportedAt: 1,
    entries: [
      {
        id: "delayed-crypto-entry",
        date: "2026-07-11",
        title: "Private import",
        content: "private plaintext",
        stickers: [],
        photoIds: ["delayed-crypto-photo"],
        audioIds: ["delayed-crypto-audio"],
        tags: [],
        createdAt: 1,
        updatedAt: 2,
      },
    ],
    photos: [
      {
        id: "delayed-crypto-photo",
        entryId: "delayed-crypto-entry",
        data: "data:image/jpeg;base64,photo",
        thumbnail: "data:image/jpeg;base64,thumbnail",
        width: 100,
        height: 80,
        createdAt: 1,
      },
    ],
    audio: [
      {
        id: "delayed-crypto-audio",
        entryId: "delayed-crypto-entry",
        data: "data:audio/webm;base64,YXVkaW8=",
        duration: 1,
        mimeType: "audio/webm",
        createdAt: 1,
      },
    ],
  });
  const file = new File([content], "journal-backup.json", { type: "application/json" });
  if (!file.text) file.text = () => Promise.resolve(content);
  return file;
}

describe("importJournalBackup IndexedDB transaction", () => {
  beforeEach(async () => {
    resumeAccountBoundaryWriters();
    vi.clearAllMocks();
    journalImportCryptoMocks.vaultKey = "transaction-vault-key";
    journalImportRuntimeMocks.encryptContent.mockImplementation(
      async (content: string, key: string) => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return `encrypted-entry:${key}:${content}`;
      }
    );
    journalImportRuntimeMocks.encryptMedia.mockImplementation(
      async (dataUrl: string, key: string) => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return `encrypted-media:${key}:${dataUrl}`;
      }
    );
    await db.open();
    await db.settings.clear();
    await db.settings.put({
      key: SK.JOURNAL_VAULT_KEY,
      value: { wrappedKey: "persisted", createdAt: 1, updatedAt: 2 },
    });
    await db.journalEntries.clear();
    await db.journalPhotos.clear();
    await db.journalAudio.clear();
  });

  afterEach(() => {
    resumeAccountBoundaryWriters();
  });

  it("finishes delayed encryption before opening the atomic write transaction", async () => {
    const result = await importJournalBackup(makeImportFile());

    expect(result.errors).toEqual([]);
    expect(result).toMatchObject({ imported: 1, photosImported: 1, audioImported: 1 });
    await expect(db.journalEntries.get("delayed-crypto-entry")).resolves.toMatchObject({
      content: "encrypted-entry:transaction-vault-key:private plaintext",
    });
    await expect(db.journalPhotos.get("delayed-crypto-photo")).resolves.toMatchObject({
      data: "encrypted-media:transaction-vault-key:data:image/jpeg;base64,photo",
      thumbnail: "encrypted-media:transaction-vault-key:data:image/jpeg;base64,thumbnail",
    });
    await expect(db.journalAudio.get("delayed-crypto-audio")).resolves.toMatchObject({
      data: "encrypted-media:transaction-vault-key:data:audio/webm;base64,YXVkaW8=",
    });
  });

  it("rejects a stale tab import when persistent diary protection exists without a local vault", async () => {
    journalImportCryptoMocks.vaultKey = null;

    const result = await importJournalBackup(makeImportFile());

    expect(result.errors.join(" ")).toMatch(/unlock|locked|protected/i);
    await expect(db.journalEntries.count()).resolves.toBe(0);
    await expect(db.journalPhotos.count()).resolves.toBe(0);
    await expect(db.journalAudio.count()).resolves.toBe(0);
    expect(journalImportRuntimeMocks.triggerSync).not.toHaveBeenCalled();
  });

  it("cannot repopulate account A diary rows after an account-boundary purge starts", async () => {
    let markEncryptionStarted!: () => void;
    const encryptionStarted = new Promise<void>((resolve) => {
      markEncryptionStarted = resolve;
    });
    let releaseEncryption!: () => void;
    const encryptionGate = new Promise<void>((resolve) => {
      releaseEncryption = resolve;
    });
    journalImportRuntimeMocks.encryptContent.mockImplementationOnce(async (content, key) => {
      markEncryptionStarted();
      await encryptionGate;
      return `encrypted-entry:${key}:${content}`;
    });

    const importPromise = importJournalBackup(makeImportFile());
    await encryptionStarted;
    suspendAccountBoundaryWriters();
    const boundary = runWithDataWriteBarrier(
      async () => {
        await db.journalEntries.clear();
        await db.journalPhotos.clear();
        await db.journalAudio.clear();
      },
      { deferredWrites: "discard" }
    );
    releaseEncryption();
    const [result] = await Promise.all([importPromise, boundary]);

    expect(result.errors.join(" ")).toMatch(/account boundary/i);
    await expect(db.journalEntries.count()).resolves.toBe(0);
    await expect(db.journalPhotos.count()).resolves.toBe(0);
    await expect(db.journalAudio.count()).resolves.toBe(0);
    expect(journalImportRuntimeMocks.triggerSync).not.toHaveBeenCalled();
  });
});
