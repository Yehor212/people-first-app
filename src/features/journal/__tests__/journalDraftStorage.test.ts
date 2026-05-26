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
  });

  it("uses the account-wide journal draft key namespace", () => {
    expect(getJournalDraftKey(null)).toBe("journal_draft_new");
    expect(getJournalDraftKey("entry-1")).toBe("journal_draft_entry-1");
  });

  it("saves drafts locally and writes an ordered setting sync event", async () => {
    await saveJournalDraft(draftKey, draft);

    expect(mocks.settingsRepo.put).toHaveBeenCalledWith({ key: draftKey, value: draft });
    expect(mocks.syncSetting).toHaveBeenCalledWith(draftKey, draft);
  });

  it("syncs the draft even when IndexedDB falls back to localStorage", async () => {
    mocks.settingsRepo.put.mockRejectedValueOnce(new Error("indexeddb unavailable"));

    await saveJournalDraft(draftKey, draft);

    expect(JSON.parse(localStorage.getItem(draftKey) || "{}")).toMatchObject({
      title: "Phone draft",
    });
    expect(mocks.syncSetting).toHaveBeenCalledWith(draftKey, draft);
  });

  it("migrates a legacy localStorage draft into IndexedDB and syncs it", async () => {
    localStorage.setItem(draftKey, JSON.stringify(draft));

    const loaded = await loadJournalDraft(draftKey);

    expect(loaded).toStrictEqual(draft);
    expect(mocks.settingsRepo.put).toHaveBeenCalledWith({ key: draftKey, value: draft });
    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(mocks.syncSetting).toHaveBeenCalledWith(draftKey, draft);
  });

  it("clears local drafts and writes an ordered setting delete event", async () => {
    localStorage.setItem(draftKey, JSON.stringify(draft));

    await clearJournalDraft(draftKey);

    expect(mocks.settingsRepo.delete).toHaveBeenCalledWith(draftKey);
    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(mocks.deleteSettingFromCloud).toHaveBeenCalledWith(draftKey);
  });
});
