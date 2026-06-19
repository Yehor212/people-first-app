import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settingsRepo: {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
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

vi.mock("@/storage/db", () => ({
  settingsRepo: mocks.settingsRepo,
}));

vi.mock("@/storage/realtimeSync", () => ({
  syncSetting: mocks.syncSetting,
  deleteSettingFromCloud: mocks.deleteSettingFromCloud,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock("../journalContentSession", () => ({
  getJournalContentVaultKey: cryptoMocks.getJournalContentVaultKey,
}));

vi.mock("../journalCrypto", () => ({
  encryptJournalContent: cryptoMocks.encryptJournalContent,
  decryptJournalContentIfNeeded: cryptoMocks.decryptJournalContentIfNeeded,
  isEncryptedJournalContent: cryptoMocks.isEncryptedJournalContent,
}));

import {
  clearJournalDraft,
  getJournalDraftKey,
  loadJournalDraft,
  saveJournalDraft,
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
    mocks.syncSetting.mockResolvedValue(undefined);
    mocks.deleteSettingFromCloud.mockResolvedValue(undefined);
    cryptoMocks.getJournalContentVaultKey.mockReturnValue(null);
    cryptoMocks.encryptJournalContent.mockClear();
    cryptoMocks.decryptJournalContentIfNeeded.mockClear();
    cryptoMocks.isEncryptedJournalContent.mockClear();
  });

  it("uses the account-wide journal draft key namespace", () => {
    expect(getJournalDraftKey(null)).toBe("journal_draft_new");
    expect(getJournalDraftKey("entry-1")).toBe("journal_draft_entry-1");
  });

  it("saves drafts locally without syncing unsaved diary content", async () => {
    await saveJournalDraft(draftKey, draft);

    expect(mocks.settingsRepo.put).toHaveBeenCalledWith({ key: draftKey, value: draft });
    expect(mocks.syncSetting).not.toHaveBeenCalled();
  });

  it("does not expose drafts and rejects when IndexedDB cannot preserve private text", async () => {
    mocks.settingsRepo.put.mockRejectedValueOnce(new Error("indexeddb unavailable"));

    await expect(saveJournalDraft(draftKey, draft)).rejects.toThrow("indexeddb unavailable");

    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(mocks.syncSetting).not.toHaveBeenCalled();
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

    await saveJournalDraft(draftKey, draft);

    expect(cryptoMocks.encryptJournalContent).toHaveBeenCalledWith(draft.content, "vault-key");
    expect(mocks.settingsRepo.put).toHaveBeenCalledWith({
      key: draftKey,
      value: expect.objectContaining({
        content: `enc:vault-key:${draft.content}`,
      }),
    });
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

  it("clears local drafts and writes an ordered setting delete event", async () => {
    localStorage.setItem(draftKey, JSON.stringify(draft));

    await clearJournalDraft(draftKey);

    expect(mocks.settingsRepo.delete).toHaveBeenCalledWith(draftKey);
    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(mocks.deleteSettingFromCloud).toHaveBeenCalledWith(draftKey);
  });
});
