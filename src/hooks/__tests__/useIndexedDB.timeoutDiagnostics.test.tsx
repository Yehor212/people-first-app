import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIndexedDB } from "../useIndexedDB";

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

interface CapturedTimeoutSignal {
  code?: unknown;
  phase?: unknown;
  deadlineMs?: unknown;
  recoveryState?: unknown;
  message?: unknown;
}

function createStalledSettingsTable() {
  const stalledRead = new Promise<never>(() => undefined);
  return {
    db: {
      transaction: vi.fn(
        (_mode: string, _table: unknown, run: () => Promise<void>) => run(),
      ),
    },
    get: vi.fn(() => stalledRead),
    put: vi.fn(async () => undefined),
    toArray: vi.fn(async () => []),
    bulkPut: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  };
}

async function advancePastIndexedDBDeadline(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
    for (let index = 0; index < 5; index += 1) await Promise.resolve();
  });
}

async function waitForReadToStart(get: ReturnType<typeof vi.fn>): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 5 && get.mock.calls.length === 0; index += 1) {
      await Promise.resolve();
    }
  });
  expect(get).toHaveBeenCalledWith("diagnostic-preferences");
}

describe("useIndexedDB timeout diagnostics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reports an unavailable read with a bounded fixed-code signal and no caller prose", async () => {
    const table = createStalledSettingsTable();
    const signals: CapturedTimeoutSignal[] = [];
    const capture = (event: Event) => {
      signals.push((event as CustomEvent<CapturedTimeoutSignal>).detail);
    };
    window.addEventListener("zenflow:indexeddb-timeout", capture);

    const { result, unmount } = renderHook(() =>
      useIndexedDB({
        table: table as never,
        localStorageKey: "diagnostic-preferences",
        initialValue: { enabled: false },
        idField: "key",
      }),
    );

    try {
      await waitForReadToStart(table.get);
      await advancePastIndexedDBDeadline();

      expect(result.current[2]).toBe(false);
      expect(signals).toEqual([
        {
          code: "IDB_OPERATION_TIMEOUT",
          phase: "read",
          deadlineMs: 30_000,
          recoveryState: "unavailable",
        },
      ]);
      expect(signals[0]).not.toHaveProperty("message");
    } finally {
      window.removeEventListener("zenflow:indexeddb-timeout", capture);
      unmount();
    }
  });

  it("claims cached recovery only after a validated domain fallback is committed", async () => {
    const table = createStalledSettingsTable();
    const signals: CapturedTimeoutSignal[] = [];
    const capture = (event: Event) => {
      signals.push((event as CustomEvent<CapturedTimeoutSignal>).detail);
    };
    window.addEventListener("zenflow:indexeddb-timeout", capture);

    const { result, unmount } = renderHook(() =>
      useIndexedDB({
        table: table as never,
        localStorageKey: "diagnostic-preferences",
        initialValue: { enabled: false },
        idField: "key",
        readFallbackValue: () => ({ enabled: true }),
      }),
    );

    try {
      await waitForReadToStart(table.get);
      await advancePastIndexedDBDeadline();

      expect(result.current[0]).toEqual({ enabled: true });
      expect(signals).toEqual([
        {
          code: "IDB_OPERATION_TIMEOUT",
          phase: "read",
          deadlineMs: 30_000,
          recoveryState: "cached",
        },
      ]);
    } finally {
      window.removeEventListener("zenflow:indexeddb-timeout", capture);
      unmount();
    }
  });
});
