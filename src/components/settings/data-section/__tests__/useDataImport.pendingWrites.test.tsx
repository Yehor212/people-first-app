import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dataImported: vi.fn(),
  importBackup: vi.fn(),
}));

vi.mock("@/storage/backup", () => ({
  importBackup: mocks.importBackup,
}));

vi.mock("@/lib/analytics", () => ({
  analytics: { dataImported: mocks.dataImported },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

import { useDataImport } from "../useDataImport";
import { useIndexedDB } from "@/hooks/useIndexedDB";

type StoredValue = { source: string };
type StoredRecord = { key: string; value: StoredValue };

const storageKey = "zenflow-import-write-barrier-test";
const initialValue: StoredValue = { source: "initial" };
const firstPendingValue: StoredValue = { source: "pending-w1" };
const secondPendingValue: StoredValue = { source: "pending-w2" };
const importedValue: StoredValue = { source: "authoritative-import" };

const copy = {
  focus: "Focus",
  gratitude: "Gratitude",
  habits: "Habits",
  importAdded: "added",
  importError: "Import failed.",
  importJournalUnlockRequired: "Unlock your diary before replacing data on this device.",
  importSkipped: "skipped",
  importSuccess: "Import complete.",
  importUpdated: "updated",
  importedItems: "Imported",
  moodEntries: "Moods",
  settings: "Settings",
};

const importReport = {
  mode: "replace" as const,
  moods: { added: 0, updated: 0, skipped: 0 },
  habits: { added: 0, updated: 0, skipped: 0 },
  focusSessions: { added: 0, updated: 0, skipped: 0 },
  gratitudeEntries: { added: 0, updated: 0, skipped: 0 },
  settings: { added: 1, updated: 0, skipped: 0 },
};

function makeBackupFile(): File {
  return {
    name: "ZenFlow_Backup_pending-write-regression.json",
    size: 128,
    type: "application/json",
    text: vi.fn().mockResolvedValue('{"schemaVersion":3,"data":{}}'),
  } as unknown as File;
}

describe("useDataImport authoritative Replace write barrier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("waits for writes queued before Replace and keeps imported storage and hook state authoritative", async () => {
    let storedRecord: StoredRecord = { key: storageKey, value: initialValue };
    let completedWrites = 0;
    let releaseFirstWrite!: () => void;
    const firstWriteGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });

    const table = {
      get: vi.fn(async () => storedRecord),
      put: vi.fn(async (record: StoredRecord) => {
        if (table.put.mock.calls.length === 1) {
          await firstWriteGate;
        }
        storedRecord = record;
        completedWrites += 1;
      }),
    };

    let writesCompletedWhenReplaceStarted = -1;
    mocks.importBackup.mockImplementation(async () => {
      writesCompletedWhenReplaceStarted = completedWrites;
      storedRecord = { key: storageKey, value: importedValue };
      return importReport;
    });

    const setDataStatus = vi.fn();
    const { result } = renderHook(() => {
      const [storedValue, setStoredValue, isLoading] = useIndexedDB<StoredValue>({
        table: table as never,
        localStorageKey: storageKey,
        initialValue,
        idField: "key",
      });
      const dataImport = useDataImport({ setDataStatus, t: copy });
      return { dataImport, isLoading, setStoredValue, storedValue };
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setStoredValue(firstPendingValue);
      result.current.setStoredValue(secondPendingValue);
    });

    await waitFor(() => expect(table.put).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.dataImport.setImportMode("replace");
      result.current.dataImport.handleImportFile({
        target: { files: [makeBackupFile()], value: "selected" },
      } as never);
    });

    let confirmPromise!: Promise<void>;
    act(() => {
      confirmPromise = result.current.dataImport.handleImportConfirm();
    });

    expect(table.put).toHaveBeenCalledTimes(1);
    expect(mocks.importBackup).not.toHaveBeenCalled();

    await act(async () => {
      releaseFirstWrite();
      await confirmPromise;
    });

    expect(mocks.importBackup).toHaveBeenCalledTimes(1);
    expect.soft(writesCompletedWhenReplaceStarted).toBe(2);
    expect.soft(storedRecord.value).toEqual(importedValue);
    expect(result.current.storedValue).toEqual(importedValue);
  });
});
