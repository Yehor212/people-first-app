import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settingsRepo: {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    toArray: vi.fn(),
    bulkPut: vi.fn(),
  },
  syncSetting: vi.fn(),
  deleteSettingFromCloud: vi.fn(),
}));

const cryptoMocks = vi.hoisted(() => ({
  getJournalContentVaultKey: vi.fn<() => string | null>(() => null),
  encryptJournalContent: vi.fn((content: string, key: string) =>
    Promise.resolve(`enc:${key}:${content}`),
  ),
  decryptJournalContentIfNeeded: vi.fn((content: string, key: string) =>
    Promise.resolve(content.replace(`enc:${key}:`, "")),
  ),
  isEncryptedJournalContent: vi.fn((content: string) => content.startsWith("enc:")),
}));

const writeSecurityMocks = vi.hoisted(() => ({
  getJournalVaultKeyForWrite: vi.fn<() => Promise<string | null>>(() => Promise.resolve(null)),
  runWithJournalSecurityWriteLock: vi.fn(<T>(operation: () => Promise<T>) => operation()),
}));

vi.mock("@/storage/db", () => ({
  settingsRepo: mocks.settingsRepo,
}));

vi.mock("@/storage/realtimeSync", () => ({
  syncSetting: mocks.syncSetting,
  deleteSettingFromCloud: mocks.deleteSettingFromCloud,
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: vi.fn(() => Promise.resolve("account-a")),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock("../journalContentSession", () => ({
  getJournalContentVaultKey: cryptoMocks.getJournalContentVaultKey,
}));

vi.mock("../journalWriteSecurity", () => ({
  JournalWriteLockedError: class JournalWriteLockedError extends Error {
    constructor() {
      super("Unlock the protected diary before writing private content");
      this.name = "JournalWriteLockedError";
    }
  },
  getJournalVaultKeyForWrite: writeSecurityMocks.getJournalVaultKeyForWrite,
}));

vi.mock("../journalSecurityWriteLock", () => ({
  runWithJournalSecurityWriteLock: writeSecurityMocks.runWithJournalSecurityWriteLock,
}));

vi.mock("../journalCrypto", () => ({
  encryptJournalContent: cryptoMocks.encryptJournalContent,
  decryptJournalContentIfNeeded: cryptoMocks.decryptJournalContentIfNeeded,
  isEncryptedJournalContent: cryptoMocks.isEncryptedJournalContent,
}));

import {
  acquireJournalDraftWriter,
  clearJournalDraft,
  decryptEncryptedJournalDrafts,
  encryptPlaintextJournalDrafts,
  getJournalDraftKey,
  hasEncryptedJournalDrafts,
  loadJournalDraft,
  saveJournalDraft,
  touchJournalDraftWriter,
  type JournalDraftData,
} from "../journalDraftStorage";

describe("journalDraftStorage", () => {
  const draftKey = "journal_draft_new";
  const draft: JournalDraftData = {
    title: "Phone draft",
    date: "2026-05-26",
    content: "<p>Unsaved cross-device text</p>",
    stickers: [],
    photoIds: [],
    tags: ["sync"],
    savedAt: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.settingsRepo.put.mockResolvedValue(undefined);
    mocks.settingsRepo.get.mockResolvedValue(undefined);
    mocks.settingsRepo.delete.mockResolvedValue(undefined);
    mocks.settingsRepo.toArray.mockResolvedValue([]);
    mocks.settingsRepo.bulkPut.mockResolvedValue(undefined);
    mocks.syncSetting.mockResolvedValue(undefined);
    mocks.deleteSettingFromCloud.mockResolvedValue(undefined);
    cryptoMocks.getJournalContentVaultKey.mockReturnValue(null);
    writeSecurityMocks.getJournalVaultKeyForWrite.mockResolvedValue(null);
    writeSecurityMocks.runWithJournalSecurityWriteLock.mockImplementation(
      <T>(operation: () => Promise<T>) => operation()
    );
    cryptoMocks.encryptJournalContent.mockClear();
    cryptoMocks.decryptJournalContentIfNeeded.mockClear();
    cryptoMocks.isEncryptedJournalContent.mockClear();
  });

  it("uses the account-wide journal draft key namespace", () => {
    expect(getJournalDraftKey(null)).toBe("journal_draft_new");
    expect(getJournalDraftKey("entry-1")).toBe("journal_draft_entry-1");
  });

  it("fails closed when another live editor owns the same draft", async () => {
    mocks.settingsRepo.get.mockResolvedValueOnce({
      key: "zenflow_journal_draft_lease_journal_draft_new",
      value: { writerId: "tab-a", heartbeatAt: 1_000 },
    });

    await expect(acquireJournalDraftWriter(draftKey, "tab-b", 1_500)).rejects.toMatchObject({
      name: "JournalDraftInUseError",
    });

    expect(mocks.settingsRepo.put).not.toHaveBeenCalled();
  });

  it("lets a stale lease be recovered but rejects a heartbeat from the previous writer", async () => {
    mocks.settingsRepo.get
      .mockResolvedValueOnce({
        key: "zenflow_journal_draft_lease_journal_draft_new",
        value: { writerId: "tab-a", heartbeatAt: 1_000 },
      })
      .mockResolvedValueOnce({
        key: "zenflow_journal_draft_lease_journal_draft_new",
        value: { writerId: "tab-b", heartbeatAt: 200_000 },
      });

    await expect(acquireJournalDraftWriter(draftKey, "tab-b", 200_000)).resolves.toBeUndefined();
    await expect(touchJournalDraftWriter(draftKey, "tab-a", 200_100)).resolves.toBe(false);

    expect(mocks.settingsRepo.put).toHaveBeenCalledWith({
      key: "zenflow_journal_draft_lease_journal_draft_new",
      value: { writerId: "tab-b", heartbeatAt: 200_000 },
    });
  });

  it("rejects an autosave after the editor loses draft ownership", async () => {
    mocks.settingsRepo.get.mockResolvedValueOnce({
      key: "zenflow_journal_draft_lease_journal_draft_new",
      value: { writerId: "tab-a", heartbeatAt: 1_000 },
    });

    await expect(saveJournalDraft(draftKey, draft, "tab-b")).rejects.toMatchObject({
      name: "JournalDraftInUseError",
    });

    expect(mocks.settingsRepo.put).not.toHaveBeenCalled();
    expect(mocks.settingsRepo.bulkPut).not.toHaveBeenCalled();
  });

  it("saves drafts locally without syncing unsaved diary content", async () => {
    await saveJournalDraft(draftKey, draft);

    expect(mocks.settingsRepo.put).toHaveBeenCalledWith({ key: draftKey, value: draft });
    expect(writeSecurityMocks.runWithJournalSecurityWriteLock).toHaveBeenCalledTimes(1);
    expect(writeSecurityMocks.getJournalVaultKeyForWrite).toHaveBeenCalledTimes(1);
    expect(mocks.syncSetting).not.toHaveBeenCalled();
  });

  it("does not expose drafts and rejects when IndexedDB cannot preserve private text", async () => {
    mocks.settingsRepo.put.mockRejectedValueOnce(new Error("indexeddb unavailable"));

    await expect(saveJournalDraft(draftKey, draft)).rejects.toThrow("indexeddb unavailable");

    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(mocks.syncSetting).not.toHaveBeenCalled();
  });

  it("fails closed when IndexedDB cannot confirm whether a draft exists", async () => {
    mocks.settingsRepo.get.mockRejectedValueOnce(new DOMException("Database unavailable", "UnknownError"));

    await expect(loadJournalDraft(draftKey)).rejects.toMatchObject({ name: "UnknownError" });

    expect(mocks.settingsRepo.put).not.toHaveBeenCalled();
    expect(mocks.settingsRepo.delete).not.toHaveBeenCalled();
  });

  it("normalizes a partially corrupted draft without deleting its recoverable text", async () => {
    const storedValue = {
      ...draft,
      title: "Recover this title",
      date: "2026-02-30",
      stickers: ["spark", 42, "", "spark"],
      photoIds: ["photo-valid", null, "", "photo-valid"],
      audioIds: ["audio-valid", false, "audio-valid"],
      mood: "overwhelmed",
      tags: ["reflection", {}, "", "reflection"],
      habitSnapshot: [
        {
          habitId: "habit-1",
          habitName: "Drink water",
          habitIcon: "drop",
          completed: true,
        },
        { habitId: 7, habitName: "broken", habitIcon: "", completed: "yes" },
      ],
      savedAt: Number.POSITIVE_INFINITY,
      theme: "neon",
      font: "outfit",
      inkColor: "red",
      paperTexture: "dots",
      paperColor: "glass",
      bgIntensity: "dim",
      particleSpeed: "warp",
      bgPattern: "aurora",
      fontSize: "huge",
      photoLayout: {
        "photo-valid": {
          x: -20,
          y: 140,
          width: 2_000,
          description: "  Kept description  ",
        },
        orphan: { x: 10, y: 10, width: 100 },
      },
    };
    mocks.settingsRepo.get.mockResolvedValueOnce({ key: draftKey, value: storedValue });

    await expect(loadJournalDraft(draftKey)).resolves.toStrictEqual({
      title: "Recover this title",
      date: "",
      content: draft.content,
      stickers: ["spark"],
      photoIds: ["photo-valid"],
      audioIds: ["audio-valid"],
      tags: ["reflection"],
      habitSnapshot: [
        {
          habitId: "habit-1",
          habitName: "Drink water",
          habitIcon: "drop",
          completed: true,
        },
      ],
      savedAt: 0,
      font: "outfit",
      paperTexture: "dots",
      bgIntensity: "dim",
      bgPattern: "aurora",
      photoLayout: {
        "photo-valid": {
          x: 0,
          y: 100,
          width: 500,
          description: "Kept description",
        },
      },
    });
    expect(storedValue.content).toBe(draft.content);
    expect(mocks.settingsRepo.put).not.toHaveBeenCalled();
    expect(mocks.settingsRepo.delete).not.toHaveBeenCalled();
  });

  it("migrates a legacy localStorage draft into IndexedDB without syncing it", async () => {
    localStorage.setItem(draftKey, JSON.stringify(draft));

    const loaded = await loadJournalDraft(draftKey);

    expect(loaded).toStrictEqual(draft);
    expect(mocks.settingsRepo.put).toHaveBeenCalledWith({ key: draftKey, value: draft });
    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(mocks.syncSetting).not.toHaveBeenCalled();
  });


  it("encrypts protected draft content when a journal vault key is available", async () => {
    cryptoMocks.getJournalContentVaultKey.mockReturnValue("vault-key");
    writeSecurityMocks.getJournalVaultKeyForWrite.mockResolvedValue("vault-key");

    await saveJournalDraft(draftKey, draft);

    expect(cryptoMocks.encryptJournalContent).toHaveBeenCalledWith(draft.content, "vault-key");
    expect(mocks.settingsRepo.put).toHaveBeenCalledWith({
      key: draftKey,
      value: expect.objectContaining({
        content: `enc:vault-key:${draft.content}`,
      }),
    });
  });

  it("refuses a plaintext draft save when persistent protection exists but this tab is locked", async () => {
    writeSecurityMocks.getJournalVaultKeyForWrite.mockRejectedValueOnce(
      Object.assign(new Error("Unlock the protected diary before writing private content"), {
        name: "JournalWriteLockedError",
      })
    );

    await expect(saveJournalDraft(draftKey, draft)).rejects.toMatchObject({
      name: "JournalWriteLockedError",
    });

    expect(mocks.settingsRepo.put).not.toHaveBeenCalled();
    expect(localStorage.getItem(draftKey)).toBeNull();
  });

  it("does not encrypt with a stale in-memory key after persistent protection was removed", async () => {
    cryptoMocks.getJournalContentVaultKey.mockReturnValue("stale-vault-key");
    writeSecurityMocks.getJournalVaultKeyForWrite.mockResolvedValue(null);

    await saveJournalDraft(draftKey, draft);

    expect(cryptoMocks.encryptJournalContent).not.toHaveBeenCalled();
    expect(mocks.settingsRepo.put).toHaveBeenCalledWith({ key: draftKey, value: draft });
  });

  it("decrypts protected draft content after journal unlock", async () => {
    cryptoMocks.getJournalContentVaultKey.mockReturnValue("vault-key");
    mocks.settingsRepo.get.mockResolvedValueOnce({
      key: draftKey,
      value: { ...draft, content: `enc:vault-key:${draft.content}` },
    });

    const loaded = await loadJournalDraft(draftKey);

    expect(cryptoMocks.decryptJournalContentIfNeeded).toHaveBeenCalledWith(
      `enc:vault-key:${draft.content}`,
      "vault-key",
    );
    expect(loaded).toStrictEqual(draft);
  });

  it("keeps an unfinished IndexedDB draft available after eight days", async () => {
    const olderDraft = { ...draft, savedAt: Date.now() - 8 * 86400000 };
    mocks.settingsRepo.get.mockResolvedValueOnce({ key: draftKey, value: olderDraft });

    await expect(loadJournalDraft(draftKey)).resolves.toStrictEqual(olderDraft);

    expect(mocks.settingsRepo.delete).not.toHaveBeenCalled();
    expect(mocks.deleteSettingFromCloud).not.toHaveBeenCalled();
  });

  it("migrates an unfinished legacy draft even when it is older than seven days", async () => {
    const olderDraft = { ...draft, savedAt: Date.now() - 8 * 86400000 };
    localStorage.setItem(draftKey, JSON.stringify(olderDraft));

    await expect(loadJournalDraft(draftKey)).resolves.toStrictEqual(olderDraft);

    expect(mocks.settingsRepo.put).toHaveBeenCalledWith({ key: draftKey, value: olderDraft });
    expect(mocks.settingsRepo.delete).not.toHaveBeenCalled();
  });

  it("keeps a legacy plaintext draft quarantined while persistent protection is locked", async () => {
    localStorage.setItem(draftKey, JSON.stringify(draft));
    writeSecurityMocks.getJournalVaultKeyForWrite.mockRejectedValueOnce(
      Object.assign(new Error("Unlock the protected diary before writing private content"), {
        name: "JournalWriteLockedError",
      })
    );

    await expect(loadJournalDraft(draftKey)).resolves.toBeNull();

    expect(mocks.settingsRepo.put).not.toHaveBeenCalled();
    expect(localStorage.getItem(draftKey)).toBe(JSON.stringify(draft));
  });

  it("detects and decrypts only encrypted journal draft settings during password removal", async () => {
    const protectedDraft = { ...draft, content: `enc:vault-key:${draft.content}` };
    mocks.settingsRepo.toArray.mockResolvedValueOnce([
      { key: draftKey, value: protectedDraft },
      { key: "theme", value: { content: "enc:vault-key:unrelated" } },
    ]);

    await expect(hasEncryptedJournalDrafts()).resolves.toBe(true);

    mocks.settingsRepo.toArray.mockResolvedValueOnce([
      { key: draftKey, value: protectedDraft },
      { key: "theme", value: { content: "enc:vault-key:unrelated" } },
    ]);
    await expect(decryptEncryptedJournalDrafts("vault-key")).resolves.toBe(1);

    expect(mocks.settingsRepo.bulkPut).toHaveBeenCalledWith([
      { key: draftKey, value: draft },
    ]);
  });

  it("re-encrypts plaintext drafts so a failed password removal can restore protection", async () => {
    mocks.settingsRepo.toArray.mockResolvedValueOnce([
      { key: draftKey, value: draft },
      { key: "journal_draft_empty", value: { ...draft, content: "" } },
    ]);

    await expect(encryptPlaintextJournalDrafts("vault-key")).resolves.toBe(1);

    expect(mocks.settingsRepo.bulkPut).toHaveBeenCalledWith([
      {
        key: draftKey,
        value: { ...draft, content: `enc:vault-key:${draft.content}` },
      },
    ]);
  });

  it("clears local drafts and writes an ordered setting delete event", async () => {
    localStorage.setItem(draftKey, JSON.stringify(draft));

    await clearJournalDraft(draftKey);

    expect(mocks.settingsRepo.delete).toHaveBeenCalledWith(draftKey);
    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(mocks.deleteSettingFromCloud).toHaveBeenCalledWith(draftKey, "account-a");
  });

  it("keeps every draft sink when IndexedDB clear fails", async () => {
    localStorage.setItem(draftKey, JSON.stringify(draft));
    mocks.settingsRepo.delete.mockRejectedValueOnce(new Error("indexeddb delete failed"));

    await expect(clearJournalDraft(draftKey)).rejects.toThrow("indexeddb delete failed");

    expect(localStorage.getItem(draftKey)).toBe(JSON.stringify(draft));
    expect(mocks.deleteSettingFromCloud).not.toHaveBeenCalled();
  });

  it("does not clear any draft sink after the journal account boundary becomes stale", async () => {
    localStorage.setItem(draftKey, JSON.stringify(draft));
    writeSecurityMocks.runWithJournalSecurityWriteLock.mockRejectedValueOnce(
      new Error("Account boundary changed")
    );

    await expect(clearJournalDraft(draftKey)).rejects.toThrow(/account boundary/i);

    expect(mocks.settingsRepo.delete).not.toHaveBeenCalled();
    expect(localStorage.getItem(draftKey)).toBe(JSON.stringify(draft));
    expect(mocks.deleteSettingFromCloud).not.toHaveBeenCalled();
  });
});
