import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentOwnerUserId: "account-a",
  dataImported: vi.fn(),
  getCurrentSessionUserId: vi.fn(),
  importBackup: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  runWithDataWriteBarrier: vi.fn<
    (mutation: () => Promise<unknown>) => Promise<unknown>
  >(),
  triggerDataRefresh: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
}));

vi.mock("@/storage/backup", () => ({
  importBackup: mocks.importBackup,
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  runWithDataWriteBarrier: mocks.runWithDataWriteBarrier,
  triggerDataRefresh: mocks.triggerDataRefresh,
}));

vi.mock("@/lib/analytics", () => ({
  analytics: { dataImported: mocks.dataImported },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError, warn: mocks.loggerWarn },
}));

import { useDataImport } from "../useDataImport";

const copy = {
  focus: "Focus",
  gratitude: "Gratitude",
  habits: "Habits",
  importAdded: "added",
  importError: "Import failed.",
  importJournalUnlockRequired: "Unlock your diary before replacing the data on this device.",
  importJournalReauthorizationRequired:
    "For safety, lock and unlock your diary, then return here and try Replace again.",
  importJournalUnreadable:
    "This backup contains protected diary data that this device cannot read.",
  importResultSummary:
    "Import complete — added: {added}, updated: {updated}, skipped: {skipped}. Diary — entries: {journalEntries}, photos: {journalPhotos}, recordings: {journalAudio}.",
  importSkipped: "skipped",
  importSuccess: "Import complete.",
  importUpdated: "updated",
  importedItems: "Imported",
  moodEntries: "Moods",
  settings: "Settings",
};

const emptyReport = {
  mode: "merge" as const,
  moods: { added: 1, updated: 0, skipped: 0 },
  habits: { added: 0, updated: 0, skipped: 0 },
  focusSessions: { added: 0, updated: 0, skipped: 0 },
  gratitudeEntries: { added: 0, updated: 0, skipped: 0 },
  settings: { added: 0, updated: 0, skipped: 0 },
  journalEntries: { added: 0, updated: 0, skipped: 0 },
  journalPhotos: { added: 0, updated: 0, skipped: 0 },
  journalAudio: { added: 0, updated: 0, skipped: 0 },
  journalHubPreferences: { added: 0, updated: 0, skipped: 0 },
  journalSpaces: { added: 0, updated: 0, skipped: 0 },
  journalPracticeSessions: { added: 0, updated: 0, skipped: 0 },
  journalEntryLinks: { added: 0, updated: 0, skipped: 0 },
  journalSpaceCaptures: { added: 0, updated: 0, skipped: 0 },
};

function makeBackupFile(size = 128): File {
  return {
    name: "ZenFlow_Backup_2026-07-10.json",
    size,
    type: "application/json",
    text: vi.fn().mockResolvedValue('{"schemaVersion":3,"data":{}}'),
  } as unknown as File;
}

function makeDeferredBackupFile(text: Promise<string>): File {
  return {
    name: "ZenFlow_Backup_2026-07-10.json",
    size: 128,
    type: "application/json",
    text: vi.fn(() => text),
  } as unknown as File;
}

function renderSubject() {
  const setDataStatus = vi.fn();
  const hook = renderHook(() => useDataImport({ setDataStatus, t: copy }));
  return { hook, setDataStatus };
}

function selectBackupFile(
  hook: ReturnType<typeof renderSubject>["hook"],
  file: File = makeBackupFile(),
) {
  const input = { files: [file], value: "selected" };
  act(() => {
    hook.result.current.handleImportFile({ target: input } as never);
  });
  expect(hook.result.current.showImportConfirm).toBe(true);
}

describe("useDataImport completion boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentOwnerUserId = "account-a";
    mocks.getCurrentSessionUserId.mockImplementation(async () => mocks.currentOwnerUserId);
    mocks.triggerDataRefresh.mockResolvedValue(undefined);
    mocks.runWithDataWriteBarrier.mockImplementation(async (mutation) => {
      const result = await mutation();
      await mocks.triggerDataRefresh();
      return result;
    });
  });

  it("does not import account A data when File.text finishes after switching to account B", async () => {
    let finishFileRead!: (text: string) => void;
    const text = new Promise<string>((resolve) => {
      finishFileRead = resolve;
    });
    const file = makeDeferredBackupFile(text);
    const { hook, setDataStatus } = renderSubject();
    selectBackupFile(hook, file);

    let confirmPromise!: Promise<void>;
    act(() => {
      confirmPromise = hook.result.current.handleImportConfirm();
    });

    await waitFor(() => expect(file.text).toHaveBeenCalledTimes(1));
    mocks.currentOwnerUserId = "account-b";

    await act(async () => {
      finishFileRead('{"schemaVersion":3,"data":{}}');
      await confirmPromise;
    });

    expect(mocks.importBackup).not.toHaveBeenCalled();
    expect(mocks.runWithDataWriteBarrier).not.toHaveBeenCalled();
    expect(mocks.dataImported).not.toHaveBeenCalled();
    expect(setDataStatus).not.toHaveBeenCalledWith(copy.importError);
    expect(setDataStatus).not.toHaveBeenCalledWith(expect.stringContaining("Import complete"));
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it("accepts a backup large enough to contain one allowed 20 MB audio recording", () => {
    const { hook, setDataStatus } = renderSubject();
    const input = {
      files: [makeBackupFile(28 * 1024 * 1024)],
      value: "selected",
    };

    act(() => {
      hook.result.current.handleImportFile({ target: input } as never);
    });

    expect(hook.result.current.showImportConfirm).toBe(true);
    expect(setDataStatus).not.toHaveBeenCalled();
  });

  it("shows an actionable journal-unlock message for a blocked replace", async () => {
    const blocked = Object.assign(new Error("JOURNAL_UNLOCK_REQUIRED"), {
      code: "JOURNAL_UNLOCK_REQUIRED",
    });
    mocks.importBackup.mockRejectedValueOnce(blocked);
    const { hook, setDataStatus } = renderSubject();
    selectBackupFile(hook);

    await act(async () => {
      await hook.result.current.handleImportConfirm();
    });

    expect(setDataStatus).toHaveBeenLastCalledWith(copy.importJournalUnlockRequired);
    expect(setDataStatus).not.toHaveBeenCalledWith(copy.importError);
    expect(mocks.dataImported).not.toHaveBeenCalled();
  });

  it("explains how an already-unlocked diary can renew an expired Replace approval", async () => {
    const blocked = Object.assign(new Error("JOURNAL_REPLACE_AUTHORIZATION_REQUIRED"), {
      code: "JOURNAL_REPLACE_AUTHORIZATION_REQUIRED",
    });
    mocks.importBackup.mockRejectedValueOnce(blocked);
    const { hook, setDataStatus } = renderSubject();
    selectBackupFile(hook);

    await act(async () => {
      await hook.result.current.handleImportConfirm();
    });

    expect(setDataStatus).toHaveBeenLastCalledWith(copy.importJournalReauthorizationRequired);
  });

  it("explains that unreadable protected diary content cannot be imported", async () => {
    mocks.importBackup.mockRejectedValueOnce(
      Object.assign(new Error("Unreadable protected diary backup"), {
        code: "JOURNAL_BACKUP_UNREADABLE",
      }),
    );
    const { hook, setDataStatus } = renderSubject();
    selectBackupFile(hook);

    await act(async () => {
      await hook.result.current.handleImportConfirm();
    });

    expect(setDataStatus).toHaveBeenLastCalledWith(copy.importJournalUnreadable);
    expect(setDataStatus).not.toHaveBeenCalledWith(copy.importError);
    expect(mocks.dataImported).not.toHaveBeenCalled();
  });

  it("waits for every data consumer to refresh before reporting import success", async () => {
    let finishRefresh!: () => void;
    const refreshBarrier = new Promise<void>((resolve) => {
      finishRefresh = resolve;
    });
    mocks.importBackup.mockResolvedValueOnce(emptyReport);
    mocks.triggerDataRefresh.mockReturnValueOnce(refreshBarrier);
    const { hook, setDataStatus } = renderSubject();
    selectBackupFile(hook);

    let confirmPromise!: Promise<void>;
    act(() => {
      confirmPromise = hook.result.current.handleImportConfirm();
    });

    await waitFor(() => expect(mocks.importBackup).toHaveBeenCalled());
    expect(mocks.triggerDataRefresh).toHaveBeenCalledTimes(1);
    expect(setDataStatus).not.toHaveBeenCalledWith(expect.stringContaining(copy.importSuccess));
    expect(mocks.dataImported).not.toHaveBeenCalled();

    await act(async () => {
      finishRefresh();
      await confirmPromise;
    });

    expect(setDataStatus).toHaveBeenLastCalledWith(expect.stringContaining("Import complete"));
    expect(mocks.dataImported).toHaveBeenCalledWith(1);
  });

  it("reports accepted diary entries, photos, and recordings instead of hiding them", async () => {
    mocks.importBackup.mockResolvedValueOnce({
      ...emptyReport,
      journalEntries: { added: 2, updated: 1, skipped: 0 },
      journalPhotos: { added: 3, updated: 0, skipped: 1 },
      journalAudio: { added: 1, updated: 1, skipped: 0 },
    });
    const { hook, setDataStatus } = renderSubject();
    selectBackupFile(hook);

    await act(async () => {
      await hook.result.current.handleImportConfirm();
    });

    expect(setDataStatus).toHaveBeenLastCalledWith(
      "Import complete — added: 7, updated: 2, skipped: 1. Diary — entries: 3, photos: 3, recordings: 2.",
    );
    expect(mocks.dataImported).toHaveBeenCalledWith(7);
  });

  it("includes every Journal Hub and Spaces table in the truthful import totals", async () => {
    mocks.importBackup.mockResolvedValueOnce({
      ...emptyReport,
      journalHubPreferences: { added: 1, updated: 0, skipped: 0 },
      journalSpaces: { added: 1, updated: 0, skipped: 0 },
      journalPracticeSessions: { added: 1, updated: 0, skipped: 0 },
      journalEntryLinks: { added: 1, updated: 0, skipped: 0 },
      journalSpaceCaptures: { added: 1, updated: 0, skipped: 0 },
    });
    const { hook, setDataStatus } = renderSubject();
    selectBackupFile(hook);

    await act(async () => {
      await hook.result.current.handleImportConfirm();
    });

    expect(setDataStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("added: 6, updated: 0, skipped: 0"),
    );
    expect(mocks.dataImported).toHaveBeenCalledWith(6);
  });
});
