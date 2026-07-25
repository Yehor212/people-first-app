import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const ownerId = (value: string | null): string | null => value;

  class BoundaryError extends Error {
    constructor(operation = "Backup import", cause?: unknown) {
      super(`${operation} stopped at an account boundary`);
      this.name = "SettingsOwnerBoundaryError";
      if (cause !== undefined) {
        (this as Error & { cause?: unknown }).cause = cause;
      }
    }
  }

  return {
    BoundaryError,
    assertSettingsDataOwnerCurrentWithinTransaction: vi.fn(),
    assertSettingsExternalOwnerCurrentWithinDataWriteBarrier: vi.fn(),
    assertSettingsOwnerCurrent: vi.fn(),
    assertSettingsOwnerCurrentWithinDataWriteBarrier: vi.fn(),
    currentDataOwnerUserId: ownerId("account-a"),
    currentOwnerUserId: ownerId("account-a"),
    dataImported: vi.fn(),
    getCurrentSessionUserId: vi.fn(),
    importBackup: vi.fn(),
    loggerError: vi.fn(),
    loggerWarn: vi.fn(),
    clearPendingLocalBackupAccountClaim: vi.fn(() => true),
    markImportedBackupLocalOnlyAccess: vi.fn(() => true),
    markPendingLocalBackupAccountClaim: vi.fn(() => true),
    readPendingLocalBackupAccountClaim: vi.fn<
      () =>
        | { status: "none" }
        | { status: "pending"; generation: string }
        | { status: "invalid" }
        | { status: "unavailable" }
    >(() => ({ status: "none" })),
    readVerifiedSettingsOwnerRealm: vi.fn(),
    runWithDataWriteBarrier: vi.fn<(mutation: () => Promise<unknown>) => Promise<unknown>>(),
    subscribeAccountSessionTransition: vi.fn(() => vi.fn()),
    triggerDataRefresh: vi.fn(),
  };
});

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
}));

vi.mock("@/lib/settingsOwnerBoundary", () => ({
  SettingsOwnerBoundaryError: mocks.BoundaryError,
  assertSettingsDataOwnerCurrentWithinTransaction:
    mocks.assertSettingsDataOwnerCurrentWithinTransaction,
  assertSettingsExternalOwnerCurrentWithinDataWriteBarrier:
    mocks.assertSettingsExternalOwnerCurrentWithinDataWriteBarrier,
  assertSettingsOwnerCurrent: mocks.assertSettingsOwnerCurrent,
  assertSettingsOwnerCurrentWithinDataWriteBarrier:
    mocks.assertSettingsOwnerCurrentWithinDataWriteBarrier,
  readVerifiedSettingsOwnerRealm: mocks.readVerifiedSettingsOwnerRealm,
}));

vi.mock("@/storage/accountBoundaryRuntime", () => ({
  clearPendingLocalBackupAccountClaim: mocks.clearPendingLocalBackupAccountClaim,
  markImportedBackupLocalOnlyAccess: mocks.markImportedBackupLocalOnlyAccess,
  markPendingLocalBackupAccountClaim: mocks.markPendingLocalBackupAccountClaim,
  readPendingLocalBackupAccountClaim: mocks.readPendingLocalBackupAccountClaim,
  subscribeAccountSessionTransition: mocks.subscribeAccountSessionTransition,
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
  importAccountUnavailable:
    "Backup import is available only while you use ZenFlow without a connected account.",
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

function renderSubject(t: Record<string, string> = copy) {
  const setDataStatus = vi.fn();
  const hook = renderHook(() => useDataImport({ setDataStatus, t }));
  return { hook, setDataStatus };
}

function selectBackupFile(
  hook: ReturnType<typeof renderSubject>["hook"],
  file: File = makeBackupFile()
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
    mocks.readPendingLocalBackupAccountClaim.mockReturnValue({ status: "none" });
    mocks.currentOwnerUserId = null;
    mocks.currentDataOwnerUserId = null;
    mocks.getCurrentSessionUserId.mockImplementation(async () => mocks.currentOwnerUserId);
    mocks.readVerifiedSettingsOwnerRealm.mockImplementation(async () => {
      if (mocks.currentOwnerUserId !== mocks.currentDataOwnerUserId) {
        throw new mocks.BoundaryError();
      }
      return {
        kind: mocks.currentOwnerUserId === null ? "local" : "account",
        ownerUserId: mocks.currentOwnerUserId,
        generation: "settings-generation-a",
      };
    });
    const assertOwnerCurrent = async (realm: { ownerUserId: string | null } | string | null) => {
      const ownerUserId = typeof realm === "object" && realm !== null ? realm.ownerUserId : realm;
      if (
        ownerUserId !== mocks.currentOwnerUserId ||
        ownerUserId !== mocks.currentDataOwnerUserId
      ) {
        throw new mocks.BoundaryError();
      }
    };
    mocks.assertSettingsOwnerCurrent.mockImplementation(assertOwnerCurrent);
    mocks.assertSettingsOwnerCurrentWithinDataWriteBarrier.mockImplementation(assertOwnerCurrent);
    mocks.assertSettingsExternalOwnerCurrentWithinDataWriteBarrier.mockImplementation(
      assertOwnerCurrent
    );
    mocks.assertSettingsDataOwnerCurrentWithinTransaction.mockImplementation(assertOwnerCurrent);
    mocks.triggerDataRefresh.mockResolvedValue(undefined);
    mocks.runWithDataWriteBarrier.mockImplementation(async (mutation) => {
      const result = await mutation();
      await mocks.triggerDataRefresh();
      return result;
    });
  });

  it("does not import local data when File.text finishes after an account takes ownership", async () => {
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
    mocks.currentDataOwnerUserId = "account-b";

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

  it.each([
    "getSession returned an auth error",
    "getSession threw",
    "the session was null while durable data remained account-owned",
  ])("runs no import side effect when %s", async () => {
    const boundaryFailure = new mocks.BoundaryError();
    mocks.readVerifiedSettingsOwnerRealm.mockRejectedValueOnce(boundaryFailure);
    const file = makeBackupFile();
    const { hook, setDataStatus } = renderSubject();
    selectBackupFile(hook, file);

    await act(async () => {
      await hook.result.current.handleImportConfirm();
    });

    expect(file.text).not.toHaveBeenCalled();
    expect(mocks.runWithDataWriteBarrier).not.toHaveBeenCalled();
    expect(mocks.importBackup).not.toHaveBeenCalled();
    expect(mocks.dataImported).not.toHaveBeenCalled();
    expect(setDataStatus).not.toHaveBeenCalledWith(copy.importError);
  });

  it("passes an explicit owner option for a verified local import realm", async () => {
    mocks.currentOwnerUserId = null;
    mocks.currentDataOwnerUserId = null;
    mocks.importBackup.mockResolvedValueOnce(emptyReport);
    const { hook } = renderSubject();
    selectBackupFile(hook);

    await act(async () => {
      await hook.result.current.handleImportConfirm();
    });

    expect(mocks.importBackup).toHaveBeenCalledTimes(1);
    expect(mocks.importBackup.mock.calls[0]?.[2]).toHaveProperty("expectedOwnerUserId", undefined);
    expect(mocks.importBackup.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({
        assertExternalOwnerRealmCurrent: expect.any(Function),
        assertDataOwnerRealmCurrent: expect.any(Function),
        subscribeOwnerRealmInvalidation: mocks.subscribeAccountSessionTransition,
      })
    );
  });

  it.each(["merge", "replace"] as const)(
    "refuses %s in an account realm before reading or mutating backup data",
    async (mode) => {
      mocks.currentOwnerUserId = "account-a";
      mocks.currentDataOwnerUserId = "account-a";
      const file = makeBackupFile();
      const { hook, setDataStatus } = renderSubject();
      selectBackupFile(hook, file);
      act(() => hook.result.current.setImportMode(mode));

      await act(async () => {
        await hook.result.current.handleImportConfirm();
      });

      expect(file.text).not.toHaveBeenCalled();
      expect(mocks.runWithDataWriteBarrier).not.toHaveBeenCalled();
      expect(mocks.importBackup).not.toHaveBeenCalled();
      expect(setDataStatus).toHaveBeenLastCalledWith(copy.importAccountUnavailable);
    }
  );

  it("uses the account-neutral English fallback when localized copy is unavailable", async () => {
    mocks.currentOwnerUserId = "account-a";
    mocks.currentDataOwnerUserId = "account-a";
    const { importAccountUnavailable: _omitted, ...copyWithoutAccountMessage } = copy;
    const file = makeBackupFile();
    const { hook, setDataStatus } = renderSubject(copyWithoutAccountMessage);
    selectBackupFile(hook, file);

    await act(async () => {
      await hook.result.current.handleImportConfirm();
    });

    expect(file.text).not.toHaveBeenCalled();
    expect(setDataStatus).toHaveBeenLastCalledWith(
      "Backup import is available only while you use ZenFlow without a connected account."
    );
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

  it("starts each file choice in safe merge mode and resets replace on cancel", () => {
    const { hook } = renderSubject();

    act(() => hook.result.current.setImportMode("replace"));
    expect(hook.result.current.importMode).toBe("replace");

    act(() => hook.result.current.handleImportClick());
    expect(hook.result.current.importMode).toBe("merge");

    selectBackupFile(hook);
    act(() => hook.result.current.setImportMode("replace"));
    act(() => hook.result.current.handleImportCancel());

    expect(hook.result.current.importMode).toBe("merge");
    expect(hook.result.current.showImportConfirm).toBe(false);
    expect(hook.result.current.pendingImportFile).toBeNull();
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
      })
    );
    const { hook, setDataStatus } = renderSubject();
    selectBackupFile(hook);

    await act(async () => {
      await hook.result.current.handleImportConfirm();
    });

    expect(setDataStatus).toHaveBeenLastCalledWith(copy.importJournalUnreadable);
    expect(setDataStatus).not.toHaveBeenCalledWith(copy.importError);
    expect(mocks.dataImported).not.toHaveBeenCalled();
    expect(mocks.clearPendingLocalBackupAccountClaim).toHaveBeenCalledTimes(1);
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
    expect(mocks.markPendingLocalBackupAccountClaim).toHaveBeenCalledTimes(1);
    expect(mocks.markPendingLocalBackupAccountClaim.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.importBackup.mock.invocationCallOrder[0]
    );
    expect(mocks.markImportedBackupLocalOnlyAccess).toHaveBeenCalledTimes(1);
    expect(mocks.markImportedBackupLocalOnlyAccess.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.importBackup.mock.invocationCallOrder[0]
    );
    expect(mocks.triggerDataRefresh).toHaveBeenCalledTimes(1);
    expect(setDataStatus).not.toHaveBeenCalledWith(expect.stringContaining(copy.importSuccess));
    expect(mocks.dataImported).not.toHaveBeenCalled();

    await act(async () => {
      finishRefresh();
      await confirmPromise;
    });

    expect(setDataStatus).toHaveBeenLastCalledWith(expect.stringContaining("Import complete"));
    expect(mocks.dataImported).toHaveBeenCalledWith(1);
    expect(mocks.clearPendingLocalBackupAccountClaim).not.toHaveBeenCalled();
  });

  it("does not commit an import when durable local-only recovery access cannot be persisted", async () => {
    mocks.markImportedBackupLocalOnlyAccess.mockReturnValueOnce(false);
    const { hook, setDataStatus } = renderSubject();
    selectBackupFile(hook);

    await act(async () => {
      await hook.result.current.handleImportConfirm();
    });

    expect(mocks.importBackup).not.toHaveBeenCalled();
    expect(mocks.clearPendingLocalBackupAccountClaim).toHaveBeenCalledTimes(1);
    expect(setDataStatus).toHaveBeenLastCalledWith(copy.importError);
  });

  it("preserves an existing imported-backup fence when a re-import fails", async () => {
    mocks.readPendingLocalBackupAccountClaim.mockReturnValue({
      status: "pending",
      generation: "existing-import-generation",
    });
    mocks.importBackup.mockRejectedValueOnce(new Error("invalid backup contents"));
    const { hook } = renderSubject();
    selectBackupFile(hook);

    await act(async () => {
      await hook.result.current.handleImportConfirm();
    });

    expect(mocks.markPendingLocalBackupAccountClaim).not.toHaveBeenCalled();
    expect(mocks.markImportedBackupLocalOnlyAccess).toHaveBeenCalledTimes(1);
    expect(mocks.clearPendingLocalBackupAccountClaim).not.toHaveBeenCalled();
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
      "Import complete — added: 7, updated: 2, skipped: 1. Diary — entries: 3, photos: 3, recordings: 2."
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
      expect.stringContaining("added: 6, updated: 0, skipped: 0")
    );
    expect(mocks.dataImported).toHaveBeenCalledWith(6);
  });
});
