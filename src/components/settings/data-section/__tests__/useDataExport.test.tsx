import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createObjectURL: vi.fn(() => "blob:zenflow-backup"),
  currentOwnerUserId: "account-a",
  dataExported: vi.fn(),
  deleteFile: vi.fn(),
  exportBackup: vi.fn(),
  exportProgressReportPDF: vi.fn(),
  exportAllToCSV: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  isNative: true,
  getCurrentSessionUserId: vi.fn(),
  revokeObjectURL: vi.fn(),
  share: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
}));

vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Encoding: { UTF8: "utf8" },
  Filesystem: {
    deleteFile: mocks.deleteFile,
    writeFile: mocks.writeFile,
  },
}));

vi.mock("@capacitor/share", () => ({
  Share: { share: mocks.share },
}));

vi.mock("@/lib/platform", () => ({
  get isNative() {
    return mocks.isNative;
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError, warn: mocks.loggerWarn },
}));

vi.mock("@/lib/analytics", () => ({
  analytics: { dataExported: mocks.dataExported },
}));

vi.mock("@/storage/backup", () => ({
  exportPortableBackupArtifact: mocks.exportBackup,
}));

vi.mock("@/lib/exportService", () => ({
  exportAllToCSV: mocks.exportAllToCSV,
  exportProgressReportPDF: mocks.exportProgressReportPDF,
}));

import { useDataExport } from "../useDataExport";

const copy = {
  exportCleanupError: "Backup shared, but the temporary file could not be removed.",
  exportError: "Backup export failed.",
  exportBackupTooLarge: "This backup is too large for ZenFlow to restore safely.",
  exportJournalUnlockRequired: "Unlock your diary before exporting its protected content.",
  exportSuccess: "Backup exported.",
  settingsExportTitle: "Export backup",
};

function renderSubject() {
  const setDataStatus = vi.fn();
  const hook = renderHook(() =>
    useDataExport({
      setDataStatus,
      t: copy,
      moods: [],
      habits: [],
      focusSessions: [],
      gratitudeEntries: [],
      userName: "ZenFlow test user",
    })
  );

  return { hook, setDataStatus };
}

async function exportJson(hook: ReturnType<typeof renderSubject>["hook"]) {
  await act(async () => {
    await hook.result.current.handleExport();
  });
}

function writtenCachePath(): string {
  const path = mocks.writeFile.mock.calls[0]?.[0]?.path;
  expect(path).toEqual(expect.stringMatching(/^ZenFlow_Backup_\d{4}-\d{2}-\d{2}_\d+\.json$/));
  return path as string;
}

describe("useDataExport native backup cache lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentOwnerUserId = "account-a";
    mocks.getCurrentSessionUserId.mockImplementation(async () => mocks.currentOwnerUserId);
    mocks.isNative = true;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: mocks.createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: mocks.revokeObjectURL,
    });
    const payload = {
      schemaVersion: 3,
      createdAt: "2026-07-10T00:00:00.000Z",
      deviceId: "device-test",
      data: {
        moods: [],
        habits: [],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [],
        journalPhotos: [],
        journalAudio: [],
      },
    };
    const json = JSON.stringify(payload);
    mocks.exportBackup.mockResolvedValue({ payload, json, sizeBytes: json.length });
    mocks.writeFile.mockResolvedValue({ uri: "file:///cache/ZenFlow_Backup.json" });
    mocks.share.mockResolvedValue({ activityType: "test.share.target" });
    mocks.deleteFile.mockResolvedValue(undefined);
  });

  it("deletes the native cache file before reporting a successful export", async () => {
    const { hook, setDataStatus } = renderSubject();

    await exportJson(hook);

    const path = writtenCachePath();
    expect(mocks.share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: copy.settingsExportTitle,
        dialogTitle: copy.settingsExportTitle,
      }),
    );
    expect(mocks.deleteFile).toHaveBeenCalledWith({ path, directory: "CACHE" });
    expect(mocks.deleteFile).toHaveBeenCalledTimes(1);
    const successCallIndex = setDataStatus.mock.calls.findIndex(
      ([status]) => status === copy.exportSuccess
    );
    expect(successCallIndex).toBeGreaterThanOrEqual(0);
    expect(mocks.deleteFile.mock.invocationCallOrder[0]).toBeLessThan(
      setDataStatus.mock.invocationCallOrder[successCallIndex]
    );
    expect(mocks.dataExported).toHaveBeenCalledTimes(1);
  });

  it("deletes the native cache file after the share sheet is cancelled", async () => {
    mocks.share.mockRejectedValueOnce(new Error("Share canceled"));
    const { hook, setDataStatus } = renderSubject();

    await exportJson(hook);

    expect(mocks.deleteFile).toHaveBeenCalledWith({
      path: writtenCachePath(),
      directory: "CACHE",
    });
    expect(setDataStatus).not.toHaveBeenCalledWith(copy.exportSuccess);
    expect(setDataStatus).not.toHaveBeenCalledWith(copy.exportError);
    expect(mocks.dataExported).not.toHaveBeenCalled();
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it("deletes the native cache file after sharing fails", async () => {
    mocks.share.mockRejectedValueOnce(new Error("Share target failed"));
    const { hook, setDataStatus } = renderSubject();

    await exportJson(hook);

    expect(mocks.deleteFile).toHaveBeenCalledWith({
      path: writtenCachePath(),
      directory: "CACHE",
    });
    expect(setDataStatus).toHaveBeenLastCalledWith(copy.exportError);
    expect(mocks.dataExported).not.toHaveBeenCalled();
  });

  it("does not delete a cache file when the write never created one", async () => {
    mocks.writeFile.mockRejectedValueOnce(new Error("Cache write failed"));
    const { hook, setDataStatus } = renderSubject();

    await exportJson(hook);

    expect(mocks.share).not.toHaveBeenCalled();
    expect(mocks.deleteFile).not.toHaveBeenCalled();
    expect(setDataStatus).toHaveBeenLastCalledWith(copy.exportError);
    expect(mocks.dataExported).not.toHaveBeenCalled();
  });

  it("asks the user to unlock a protected diary instead of showing a generic export failure", async () => {
    mocks.exportBackup.mockRejectedValueOnce(
      Object.assign(new Error("Diary unlock required"), {
        code: "JOURNAL_UNLOCK_REQUIRED",
      }),
    );
    const { hook, setDataStatus } = renderSubject();

    await exportJson(hook);

    expect(setDataStatus).toHaveBeenLastCalledWith(copy.exportJournalUnlockRequired);
    expect(setDataStatus).not.toHaveBeenCalledWith(copy.exportError);
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.dataExported).not.toHaveBeenCalled();
  });

  it("explains when the portable backup would exceed ZenFlow's restore limit", async () => {
    mocks.exportBackup.mockRejectedValueOnce(
      Object.assign(new Error("Portable backup exceeds the restore limit"), {
        code: "BACKUP_TOO_LARGE",
      }),
    );
    const { hook, setDataStatus } = renderSubject();

    await exportJson(hook);

    expect(setDataStatus).toHaveBeenLastCalledWith(copy.exportBackupTooLarge);
    expect(setDataStatus).not.toHaveBeenCalledWith(copy.exportError);
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.dataExported).not.toHaveBeenCalled();
  });

  it("reports cleanup failure instead of claiming complete export success", async () => {
    mocks.deleteFile.mockRejectedValueOnce(new Error("Cache cleanup failed"));
    const { hook, setDataStatus } = renderSubject();

    await exportJson(hook);

    expect(mocks.deleteFile).toHaveBeenCalledWith({
      path: writtenCachePath(),
      directory: "CACHE",
    });
    expect(setDataStatus).not.toHaveBeenCalledWith(copy.exportSuccess);
    expect(setDataStatus).toHaveBeenLastCalledWith(copy.exportCleanupError);
    expect(mocks.dataExported).toHaveBeenCalledTimes(1);
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("removes account A's native cache file without opening Share after switching to account B", async () => {
    let finishWrite!: (file: { uri: string }) => void;
    mocks.writeFile.mockReturnValueOnce(
      new Promise((resolve) => {
        finishWrite = resolve;
      }),
    );
    const { hook, setDataStatus } = renderSubject();

    let exportPromise!: Promise<void>;
    act(() => {
      exportPromise = hook.result.current.handleExport();
    });

    await vi.waitFor(() => expect(mocks.writeFile).toHaveBeenCalledTimes(1));
    mocks.currentOwnerUserId = "account-b";

    await act(async () => {
      finishWrite({ uri: "file:///cache/account-a-backup.json" });
      await exportPromise;
    });

    expect(mocks.deleteFile).toHaveBeenCalledTimes(1);
    expect(mocks.share).not.toHaveBeenCalled();
    expect(mocks.dataExported).not.toHaveBeenCalled();
    expect(setDataStatus).not.toHaveBeenCalledWith(copy.exportSuccess);
    expect(setDataStatus).not.toHaveBeenCalledWith(copy.exportError);
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it("does not create a web download for account A after exportBackup resolves in account B", async () => {
    mocks.isNative = false;
    let finishBackup!: (payload: unknown) => void;
    mocks.exportBackup.mockReturnValueOnce(
      new Promise((resolve) => {
        finishBackup = resolve;
      }),
    );
    const { hook, setDataStatus } = renderSubject();

    let exportPromise!: Promise<void>;
    act(() => {
      exportPromise = hook.result.current.handleExport();
    });
    await vi.waitFor(() => expect(mocks.exportBackup).toHaveBeenCalledTimes(1));
    mocks.currentOwnerUserId = "account-b";

    await act(async () => {
      finishBackup({ schemaVersion: 3, data: {} });
      await exportPromise;
    });

    expect(mocks.createObjectURL).not.toHaveBeenCalled();
    expect(mocks.dataExported).not.toHaveBeenCalled();
    expect(setDataStatus).not.toHaveBeenCalledWith(copy.exportSuccess);
    expect(setDataStatus).not.toHaveBeenCalledWith(copy.exportError);
  });

  it("checks the owner again immediately before the CSV download side effect", async () => {
    mocks.getCurrentSessionUserId
      .mockResolvedValueOnce("account-a")
      .mockResolvedValueOnce("account-b");
    const { hook, setDataStatus } = renderSubject();

    await act(async () => {
      await hook.result.current.handleExportCSV();
    });

    expect(mocks.exportAllToCSV).not.toHaveBeenCalled();
    expect(setDataStatus).not.toHaveBeenCalledWith(copy.exportError);
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it("checks the owner again immediately before the PDF save side effect", async () => {
    mocks.getCurrentSessionUserId
      .mockResolvedValueOnce("account-a")
      .mockResolvedValueOnce("account-b");
    const { hook, setDataStatus } = renderSubject();

    await act(async () => {
      await hook.result.current.handleExportPDF();
    });

    expect(mocks.exportProgressReportPDF).not.toHaveBeenCalled();
    expect(setDataStatus).not.toHaveBeenCalledWith(copy.exportError);
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });
});
