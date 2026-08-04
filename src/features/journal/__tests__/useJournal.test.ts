import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scheduleIdleMock = vi.hoisted(() => ({
  callbacks: [] as Array<() => void>,
}));

const accountBoundaryRuntimeMock = vi.hoisted(() => ({
  runtimeResets: new Set<() => void>(),
  generationListeners: new Set<(generation: string) => void>(),
  waitForSettlement: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}));

const dataRefreshMock = vi.hoisted(() => ({
  listeners: new Set<(signal: AbortSignal) => Promise<void>>(),
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  subscribeDataRefresh: vi.fn((listener: (signal: AbortSignal) => Promise<void>) => {
    dataRefreshMock.listeners.add(listener);
    return () => dataRefreshMock.listeners.delete(listener);
  }),
}));

import { useJournal } from "../useJournal";
import type { JournalEntry } from "../types";
import * as storage from "../journalStorage";

vi.mock("@/lib/scheduleIdle", () => ({
  scheduleIdle: vi.fn((callback: () => void) => {
    scheduleIdleMock.callbacks.push(callback);
    return {
      cancel: vi.fn(() => {
        const index = scheduleIdleMock.callbacks.indexOf(callback);
        if (index >= 0) scheduleIdleMock.callbacks.splice(index, 1);
      }),
    };
  }),
}));

vi.mock("@/storage/accountBoundaryRuntime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/storage/accountBoundaryRuntime")>();
  return {
    ...actual,
    registerAccountBoundaryRuntimeReset: vi.fn((reset: () => void) => {
      accountBoundaryRuntimeMock.runtimeResets.add(reset);
      return () => accountBoundaryRuntimeMock.runtimeResets.delete(reset);
    }),
    subscribeOriginAccountBoundaryGeneration: vi.fn(
      (listener: (generation: string) => void) => {
        accountBoundaryRuntimeMock.generationListeners.add(listener);
        return () => accountBoundaryRuntimeMock.generationListeners.delete(listener);
      },
    ),
    waitForAccountBoundaryDataSettlement: accountBoundaryRuntimeMock.waitForSettlement,
  };
});

vi.mock("../journalStorage", () => ({
  getEntriesPage: vi.fn(),
  getAllEntries: vi.fn(),
  getEntriesByDate: vi.fn(),
  saveEntry: vi.fn(),
  updateEntry: vi.fn(),
  getEntryById: vi.fn(),
  getEntryCount: vi.fn(),
  getPendingJournalEntryDeletes: vi.fn(),
  deleteEntry: vi.fn(),
  commitPendingJournalEntryDelete: vi.fn(),
  isJournalEntryConflictError: (error: unknown) =>
    error instanceof Error &&
    (error as Error & { code?: unknown }).code === "JOURNAL_ENTRY_CONFLICT",
}));

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "entry-1",
    date: "2026-06-12",
    title: "Voice note",
    content: "Audio stays linked.",
    stickers: [],
    photoIds: [],
    audioIds: ["audio-1"],
    tags: [],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

const readablePageMeta = {
  requestedCount: 1,
  unavailableCount: 0,
  state: "ready" as const,
};

const emptyPageMeta = {
  requestedCount: 0,
  unavailableCount: 0,
  state: "empty" as const,
};

const exhaustedPageMeta = {
  requestedCount: 0,
  unavailableCount: 0,
  state: "ready" as const,
};

function datePage(entries: JournalEntry[], unavailableCount = 0) {
  const requestedCount = entries.length + unavailableCount;
  return {
    entries,
    totalCount: requestedCount,
    requestedCount,
    unavailableCount,
    state:
      requestedCount === 0
        ? ("empty" as const)
        : unavailableCount === 0
          ? ("ready" as const)
          : entries.length === 0
            ? ("unavailable" as const)
            : ("degraded" as const),
    hasMore: false,
    nextCursor: null,
  };
}

function runMountedDataRefresh(signal = new AbortController().signal): Promise<void[]> {
  return Promise.all([...dataRefreshMock.listeners].map((listener) => listener(signal)));
}

describe("useJournal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.getEntriesPage).mockReset();
    vi.mocked(storage.getEntriesByDate).mockReset();
    vi.mocked(storage.updateEntry).mockReset();
    vi.mocked(storage.getEntryById).mockReset();
    scheduleIdleMock.callbacks.length = 0;
    accountBoundaryRuntimeMock.runtimeResets.clear();
    accountBoundaryRuntimeMock.generationListeners.clear();
    dataRefreshMock.listeners.clear();
    accountBoundaryRuntimeMock.waitForSettlement.mockReset();
    accountBoundaryRuntimeMock.waitForSettlement.mockResolvedValue(undefined);
    vi.mocked(storage.getEntriesPage).mockResolvedValue({
      entries: [],
      totalCount: 0,
      requestedCount: 0,
      unavailableCount: 0,
      state: "empty",
      hasMore: false,
      nextCursor: null,
    });
    vi.mocked(storage.getAllEntries).mockResolvedValue([]);
    vi.mocked(storage.getEntriesByDate).mockResolvedValue(datePage([]));
    vi.mocked(storage.getEntryById).mockResolvedValue(undefined);
    vi.mocked(storage.getEntryCount).mockResolvedValue(0);
    vi.mocked(storage.getPendingJournalEntryDeletes).mockResolvedValue([]);
    vi.mocked(storage.commitPendingJournalEntryDelete).mockResolvedValue("committed");
  });

  it("hides a durable pending delete during the initial load", async () => {
    const pendingEntry = makeEntry({ id: "pending-after-restart" });
    vi.mocked(storage.getPendingJournalEntryDeletes).mockResolvedValue([
      { id: pendingEntry.id, expiresAt: Date.now() + 5_000 },
    ]);
    vi.mocked(storage.getEntriesPage).mockResolvedValue({
      entries: [pendingEntry],
      totalCount: 1,
      ...readablePageMeta,
      hasMore: false,
      nextCursor: null,
    });

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.allEntries).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it("refreshes the expected version after a concurrent edit before an explicit retry", async () => {
    const original = makeEntry({ updatedAt: 100 });
    const latest = makeEntry({ content: "Other device", updatedAt: 200 });
    vi.mocked(storage.getEntriesPage).mockResolvedValueOnce({
      entries: [original],
      totalCount: 1,
      ...readablePageMeta,
      hasMore: false,
      nextCursor: null,
    });
    vi.mocked(storage.updateEntry)
      .mockRejectedValueOnce(Object.assign(new Error("conflict"), {
        name: "JournalEntryConflictError",
        code: "JOURNAL_ENTRY_CONFLICT",
      }))
      .mockResolvedValueOnce(300);
    vi.mocked(storage.getEntryById).mockResolvedValueOnce(latest);

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let conflict: unknown;
    await act(async () => {
      try {
        await result.current.updateEntry(original.id, { content: "My version" });
      } catch (error) {
        conflict = error;
      }
    });
    expect(conflict).toMatchObject({ code: "JOURNAL_ENTRY_CONFLICT" });
    await waitFor(() => expect(result.current.allEntries[0]?.updatedAt).toBe(200));

    await act(async () => result.current.updateEntry(original.id, { content: "My version" }));
    expect(storage.updateEntry).toHaveBeenLastCalledWith(
      original.id,
      { content: "My version" },
      200,
    );
  });

  it("removes decrypted entries and open-entry state when another tab changes account", async () => {
    const privateEntry = makeEntry({ id: "account-a-private-entry" });
    const nextAccountEntry = makeEntry({ id: "account-b-entry", title: "New account" });
    vi.mocked(storage.getEntriesPage)
      .mockResolvedValueOnce({
        entries: [privateEntry],
        totalCount: 1,
        ...readablePageMeta,
        hasMore: false,
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        entries: [nextAccountEntry],
        totalCount: 1,
        ...readablePageMeta,
        hasMore: false,
        nextCursor: null,
      });

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.openEntry(privateEntry.id);
      result.current.setSelectedDate(privateEntry.date);
    });
    expect(result.current.activeEntry?.id).toBe(privateEntry.id);

    act(() => {
      for (const listener of accountBoundaryRuntimeMock.generationListeners) {
        listener("account-b-generation");
      }
    });

    expect(result.current.allEntries).toEqual([]);
    expect(result.current.activeEntry).toBeNull();
    expect(result.current.activeEntryId).toBeNull();
    expect(result.current.selectedDate).toBeNull();
    expect(result.current.view).toBe("list");
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allEntries).toEqual([nextAccountEntry]);
    expect(storage.getEntriesPage).toHaveBeenCalledTimes(2);
  });

  it("keeps journal state empty until another tab finishes the account-boundary purge", async () => {
    const privateEntry = makeEntry({ id: "account-a-private-entry" });
    const nextAccountEntry = makeEntry({ id: "account-b-entry", title: "New account" });
    let releaseSettlement!: () => void;
    accountBoundaryRuntimeMock.waitForSettlement.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        releaseSettlement = resolve;
      }),
    );
    vi.mocked(storage.getEntriesPage)
      .mockResolvedValueOnce({
        entries: [privateEntry],
        totalCount: 1,
        ...readablePageMeta,
        hasMore: false,
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        entries: [nextAccountEntry],
        totalCount: 1,
        ...readablePageMeta,
        hasMore: false,
        nextCursor: null,
      });

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.allEntries).toEqual([privateEntry]));

    act(() => {
      for (const listener of accountBoundaryRuntimeMock.generationListeners) {
        listener("account-b-generation");
      }
    });

    expect(result.current.allEntries).toEqual([]);
    await waitFor(() => expect(accountBoundaryRuntimeMock.waitForSettlement).toHaveBeenCalledOnce());
    expect(storage.getEntriesPage).toHaveBeenCalledTimes(1);

    await act(async () => releaseSettlement());

    await waitFor(() => expect(result.current.allEntries).toEqual([nextAccountEntry]));
    expect(storage.getEntriesPage).toHaveBeenCalledTimes(2);
  });


  it("removes a remotely deleted open entry from the mounted viewer without a remount", async () => {
    const remoteEntry = makeEntry({ id: "remote-delete-viewer" });
    vi.mocked(storage.getEntriesPage)
      .mockResolvedValueOnce({ entries: [remoteEntry], totalCount: 1, ...readablePageMeta, hasMore: false, nextCursor: null })
      .mockResolvedValueOnce({ entries: [], totalCount: 0, ...emptyPageMeta, hasMore: false, nextCursor: null });
    vi.mocked(storage.getEntryById).mockResolvedValue(undefined);

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.allEntries).toEqual([remoteEntry]));
    act(() => result.current.openEntry(remoteEntry.id));

    await act(async () => {
      await runMountedDataRefresh();
    });

    await waitFor(() => expect(result.current.allEntries).toEqual([]));
    expect(result.current.activeEntry).toBeNull();
    expect(result.current.activeEntryId).toBeNull();
    expect(result.current.view).toBe("list");
    expect(storage.getEntriesPage).toHaveBeenCalledTimes(2);
  });

  it("refreshes the mounted list while preserving the opened editor version for conflict recovery", async () => {
    const opened = makeEntry({ id: "remote-update-editor", content: "Opened locally", updatedAt: 100 });
    const remote = makeEntry({ id: opened.id, content: "Changed remotely", updatedAt: 200 });
    vi.mocked(storage.getEntriesPage)
      .mockResolvedValueOnce({ entries: [opened], totalCount: 1, ...readablePageMeta, hasMore: false, nextCursor: null })
      .mockResolvedValueOnce({ entries: [remote], totalCount: 1, ...readablePageMeta, hasMore: false, nextCursor: null });
    vi.mocked(storage.getEntryById).mockResolvedValue(remote);
    vi.mocked(storage.updateEntry).mockRejectedValueOnce(
      Object.assign(new Error("conflict"), {
        name: "JournalEntryConflictError",
        code: "JOURNAL_ENTRY_CONFLICT",
      }),
    );

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.allEntries).toEqual([opened]));
    act(() => result.current.editEntry(opened.id));

    await act(async () => {
      await runMountedDataRefresh();
    });

    await waitFor(() => expect(result.current.allEntries).toEqual([remote]));
    expect(result.current.activeEntry).toEqual(opened);

    await expect(
      act(async () => result.current.updateEntry(opened.id, { content: "Unsaved local edit" })),
    ).rejects.toMatchObject({ code: "JOURNAL_ENTRY_CONFLICT" });
    expect(storage.updateEntry).toHaveBeenCalledWith(
      opened.id,
      { content: "Unsaved local edit" },
      opened.updatedAt,
    );
  });

  it("keeps a deleted entry editor recoverable while removing the remote entry from the list", async () => {
    const opened = makeEntry({ id: "remote-delete-editor", content: "Local draft base", updatedAt: 100 });
    vi.mocked(storage.getEntriesPage)
      .mockResolvedValueOnce({ entries: [opened], totalCount: 1, ...readablePageMeta, hasMore: false, nextCursor: null })
      .mockResolvedValueOnce({ entries: [], totalCount: 0, ...emptyPageMeta, hasMore: false, nextCursor: null });
    vi.mocked(storage.getEntryById).mockResolvedValue(undefined);
    vi.mocked(storage.updateEntry).mockRejectedValueOnce(
      Object.assign(new Error("deleted remotely"), {
        name: "JournalEntryConflictError",
        code: "JOURNAL_ENTRY_CONFLICT",
      }),
    );

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.allEntries).toEqual([opened]));
    act(() => result.current.editEntry(opened.id));

    await act(async () => {
      await runMountedDataRefresh();
    });

    await waitFor(() => expect(result.current.allEntries).toEqual([]));
    expect(result.current.view).toBe("editing");
    expect(result.current.activeEntry).toEqual(opened);

    await expect(
      act(async () => result.current.updateEntry(opened.id, { content: "Recovered local draft" })),
    ).rejects.toMatchObject({ code: "JOURNAL_ENTRY_CONFLICT" });
    expect(storage.updateEntry).toHaveBeenCalledWith(
      opened.id,
      { content: "Recovered local draft" },
      opened.updatedAt,
    );
  });

  it("does not commit a journal page that resolves after mounted refresh ownership is aborted", async () => {
    const visibleEntry = makeEntry({ id: "visible-before-timeout", title: "Current page" });
    const lateEntry = makeEntry({ id: "late-after-timeout", title: "Expired refresh" });
    let resolveLatePage!: (page: Awaited<ReturnType<typeof storage.getEntriesPage>>) => void;
    let markLatePageStarted!: () => void;
    const latePage = new Promise<Awaited<ReturnType<typeof storage.getEntriesPage>>>((resolve) => {
      resolveLatePage = resolve;
    });
    const latePageStarted = new Promise<void>((resolve) => {
      markLatePageStarted = resolve;
    });
    vi.mocked(storage.getEntriesPage)
      .mockResolvedValueOnce({
        entries: [visibleEntry],
        totalCount: 1,
        ...readablePageMeta,
        hasMore: false,
        nextCursor: null,
      })
      .mockImplementationOnce(async () => {
        markLatePageStarted();
        return latePage;
      });

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.allEntries).toEqual([visibleEntry]));

    const controller = new AbortController();
    const removeAbortListener = vi.spyOn(controller.signal, 'removeEventListener');
    let refreshPromise!: Promise<void[]>;
    act(() => {
      refreshPromise = runMountedDataRefresh(controller.signal);
    });
    await latePageStarted;
    act(() => controller.abort());
    await act(async () => {
      resolveLatePage({
        entries: [lateEntry],
        totalCount: 1,
        ...readablePageMeta,
        hasMore: false,
        nextCursor: null,
      });
      await refreshPromise;
    });

    expect(result.current.allEntries).toEqual([visibleEntry]);
    expect(result.current.totalCount).toBe(1);
    expect(result.current.loading).toBe(false);
    expect(removeAbortListener).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it("loads the first journal page before decrypting the full history", async () => {
    const firstPageEntry = makeEntry({ id: "entry-first", createdAt: 2000 });
    vi.mocked(storage.getEntriesPage).mockResolvedValueOnce({
      entries: [firstPageEntry],
      totalCount: 75,
      ...readablePageMeta,
      hasMore: true,
      nextCursor: { createdAt: firstPageEntry.createdAt, id: firstPageEntry.id },
    });

    const { result } = renderHook(() => useJournal());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(storage.getEntriesPage).toHaveBeenCalledWith({ limit: 32 });
    expect(storage.getAllEntries).not.toHaveBeenCalled();
    expect(result.current.allEntries).toEqual([firstPageEntry]);
    expect(result.current.totalCount).toBe(75);
  });

  it("accumulates unavailable rows across raw background pages without a global load error", async () => {
    const firstPageEntry = makeEntry({ id: "entry-readable", createdAt: 2_000 });
    vi.mocked(storage.getEntriesPage)
      .mockResolvedValueOnce({
        entries: [firstPageEntry],
        totalCount: 3,
        requestedCount: 2,
        unavailableCount: 1,
        state: "degraded",
        hasMore: true,
        nextCursor: { createdAt: 1_900, id: "entry-unavailable-boundary" },
      })
      .mockResolvedValueOnce({
        entries: [],
        totalCount: 3,
        requestedCount: 1,
        unavailableCount: 1,
        state: "unavailable",
        hasMore: false,
        nextCursor: null,
      });

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.unavailableCount).toBe(1);
    expect(result.current.entryPageState).toBe("degraded");
    expect(result.current.loadError).toBe(false);

    await act(async () => {
      scheduleIdleMock.callbacks.shift()?.();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.unavailableCount).toBe(2));
    expect(result.current.entryPageState).toBe("degraded");
    expect(result.current.allEntries).toEqual([firstPageEntry]);
    expect(result.current.loadError).toBe(false);
  });

  it("keeps an all-unavailable first page distinct from empty without raising loadError", async () => {
    vi.mocked(storage.getEntriesPage).mockResolvedValueOnce({
      entries: [],
      totalCount: 2,
      requestedCount: 2,
      unavailableCount: 2,
      state: "unavailable",
      hasMore: false,
      nextCursor: null,
    });

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.allEntries).toEqual([]);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.unavailableCount).toBe(2);
    expect(result.current.entryPageState).toBe("unavailable");
    expect(result.current.loadError).toBe(false);
  });

  it("replaces unavailableCount and page state on refresh instead of accumulating stale failures", async () => {
    const recoveredEntry = makeEntry({ id: "entry-recovered" });
    vi.mocked(storage.getEntriesPage)
      .mockResolvedValueOnce({
        entries: [],
        totalCount: 2,
        requestedCount: 2,
        unavailableCount: 2,
        state: "unavailable",
        hasMore: false,
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        entries: [recoveredEntry],
        totalCount: 1,
        requestedCount: 1,
        unavailableCount: 0,
        state: "ready",
        hasMore: false,
        nextCursor: null,
      });

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.entryPageState).toBe("unavailable"));

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.entryPageState).toBe("ready"));
    expect(result.current.unavailableCount).toBe(0);
    expect(result.current.allEntries).toEqual([recoveredEntry]);
    expect(result.current.loadError).toBe(false);
  });

  it("forwards audioIds when creating a new entry and reflects the saved entry", async () => {
    const savedEntry = makeEntry({
      audioIds: ["audio-1", "audio-2"],
      theme: "light",
      font: "cormorant",
      inkColor: "#243936",
      paperTexture: "linen",
      paperColor: "milky",
      bgIntensity: "dim",
      particleSpeed: "drift",
      bgPattern: "stardust",
      fontSize: "large",
      habitSnapshot: [{ habitId: "habit-1", habitName: "Read", habitIcon: "book", completed: true }],
      photoLayout: { "photo-1": { x: 12, y: 24, width: 180 } },
    });
    vi.mocked(storage.saveEntry).mockResolvedValue(savedEntry);

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: JournalEntry | undefined;
    await act(async () => {
      created = await result.current.createEntry({
        date: "2026-06-12",
        title: "Voice note",
        content: "Audio stays linked.",
        stickers: [],
        photoIds: [],
        audioIds: ["audio-1", "audio-2"],
        tags: ["voice"],
        theme: "light",
        font: "cormorant",
        inkColor: "#243936",
        paperTexture: "linen",
        paperColor: "milky",
        bgIntensity: "dim",
        particleSpeed: "drift",
        bgPattern: "stardust",
        fontSize: "large",
        habitSnapshot: [{ habitId: "habit-1", habitName: "Read", habitIcon: "book", completed: true }],
        photoLayout: { "photo-1": { x: 12, y: 24, width: 180 } },
      });
    });

    expect(storage.saveEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        audioIds: ["audio-1", "audio-2"],
        theme: "light",
        font: "cormorant",
        inkColor: "#243936",
        paperTexture: "linen",
        paperColor: "milky",
        bgIntensity: "dim",
        particleSpeed: "drift",
        bgPattern: "stardust",
        fontSize: "large",
        habitSnapshot: [{ habitId: "habit-1", habitName: "Read", habitIcon: "book", completed: true }],
        photoLayout: { "photo-1": { x: 12, y: 24, width: 180 } },
      }),
    );
    expect(created?.audioIds).toEqual(["audio-1", "audio-2"]);
    expect(created?.theme).toBe("light");
    expect(created?.font).toBe("cormorant");
    expect(created?.photoLayout).toEqual({ "photo-1": { x: 12, y: 24, width: 180 } });
    await waitFor(() => {
      expect(result.current.allEntries[0]?.audioIds).toEqual(["audio-1", "audio-2"]);
    });
  });

  it("saves an edit against the version the user opened", async () => {
    const openedEntry = makeEntry({ id: "entry-versioned", updatedAt: 100 });
    vi.mocked(storage.getEntriesPage).mockResolvedValueOnce({
      entries: [openedEntry],
      totalCount: 1,
      ...readablePageMeta,
      hasMore: false,
      nextCursor: null,
    });
    vi.mocked(storage.updateEntry).mockResolvedValueOnce(200);

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateEntry(openedEntry.id, { content: "Edited" });
    });

    expect(storage.updateEntry).toHaveBeenCalledWith(
      openedEntry.id,
      { content: "Edited" },
      100,
    );
    expect(result.current.allEntries[0]).toMatchObject({
      content: "Edited",
      updatedAt: 200,
    });
  });

  it("keeps a recoverable load error instead of impersonating an empty diary", async () => {
    vi.mocked(storage.getEntriesPage).mockRejectedValueOnce(new Error("IndexedDB unavailable"));

    const { result } = renderHook(() => useJournal());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe(true);
    expect(result.current.totalCount).toBe(0);

    vi.mocked(storage.getEntriesPage).mockResolvedValueOnce({
      entries: [makeEntry({ id: "entry-recovered" })],
      totalCount: 1,
      ...readablePageMeta,
      hasMore: false,
      nextCursor: null,
    });
    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.loadError).toBe(false));
    expect(result.current.allEntries[0]?.id).toBe("entry-recovered");
  });

  it("keeps the loaded page visible when older history fails and lets refresh retry", async () => {
    const firstPageEntry = makeEntry({ id: "entry-first", createdAt: 2000 });
    vi.mocked(storage.getEntriesPage)
      .mockResolvedValueOnce({
        entries: [firstPageEntry],
        totalCount: 2,
        ...readablePageMeta,
        hasMore: true,
        nextCursor: { createdAt: firstPageEntry.createdAt, id: firstPageEntry.id },
      })
      .mockRejectedValueOnce(new Error("older page unavailable"))
      .mockResolvedValueOnce({
        entries: [firstPageEntry],
        totalCount: 2,
        ...readablePageMeta,
        hasMore: false,
        nextCursor: null,
      });

    const { result } = renderHook(() => useJournal());

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      scheduleIdleMock.callbacks.shift()?.();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.historyLoadError).toBe(true));
    expect(result.current.loadError).toBe(false);
    expect(result.current.allEntries).toEqual([firstPageEntry]);
    expect(result.current.historyLoading).toBe(false);

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.historyLoadError).toBe(false));
    expect(result.current.loadError).toBe(false);
  });

  it("allows selected-date loads to retry after cancellation or rejection", async () => {
    let resolveFirstDateLoad: (
      page: Awaited<ReturnType<typeof storage.getEntriesByDate>>,
    ) => void = () => undefined;
    vi.mocked(storage.getEntriesPage).mockResolvedValue({
      entries: [],
      totalCount: 1,
      ...exhaustedPageMeta,
      hasMore: false,
      nextCursor: null,
    });
    vi.mocked(storage.getEntriesByDate)
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirstDateLoad = resolve; }))
      .mockRejectedValueOnce(new Error("date unavailable"))
      .mockResolvedValueOnce(
        datePage([makeEntry({ id: "selected-date-other", date: "2026-06-12" })]),
      )
      .mockResolvedValueOnce(
        datePage([makeEntry({ id: "selected-date-entry", date: "2026-06-11" })]),
      );

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setSelectedDate("2026-06-10");
    });
    await waitFor(() => expect(storage.getEntriesByDate).toHaveBeenCalledWith("2026-06-10"));

    act(() => {
      result.current.setSelectedDate("2026-06-11");
    });
    await act(async () => {
      resolveFirstDateLoad(
        datePage([makeEntry({ id: "cancelled-date-entry", date: "2026-06-10" })]),
      );
      await Promise.resolve();
    });
    await waitFor(() => expect(storage.getEntriesByDate).toHaveBeenCalledWith("2026-06-11"));
    await waitFor(() => expect(result.current.dateLoadError).toBe(true));

    act(() => {
      result.current.setSelectedDate("2026-06-12");
    });
    await waitFor(() => expect(storage.getEntriesByDate).toHaveBeenCalledWith("2026-06-12"));

    act(() => {
      result.current.setSelectedDate("2026-06-11");
    });
    await waitFor(() => expect(storage.getEntriesByDate).toHaveBeenCalledTimes(4));
  });

  it("clears a selected-date load error when the user leaves the failed date", async () => {
    vi.mocked(storage.getEntriesByDate).mockRejectedValueOnce(new Error("date unavailable"));

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSelectedDate("2026-06-11"));
    await waitFor(() => expect(result.current.dateLoadError).toBe(true));

    act(() => result.current.setSelectedDate(null));

    expect(result.current.dateLoadError).toBe(false);
  });

  it("clears a failed-date error when returning to an already loaded date", async () => {
    vi.mocked(storage.getEntriesByDate)
      .mockResolvedValueOnce(datePage([makeEntry({ date: "2026-06-10" })]))
      .mockRejectedValueOnce(new Error("date unavailable"));

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSelectedDate("2026-06-10"));
    await waitFor(() => expect(storage.getEntriesByDate).toHaveBeenCalledWith("2026-06-10"));

    act(() => result.current.setSelectedDate("2026-06-11"));
    await waitFor(() => expect(result.current.dateLoadError).toBe(true));

    act(() => result.current.setSelectedDate("2026-06-10"));

    expect(result.current.dateLoadError).toBe(false);
    expect(storage.getEntriesByDate).toHaveBeenCalledTimes(2);
  });

  it("loads the complete selected date even when the first page already contains one entry", async () => {
    const firstVisible = makeEntry({ id: "selected-date-first", date: "2026-06-12" });
    const olderSameDay = makeEntry({
      id: "selected-date-older",
      date: "2026-06-12",
      createdAt: firstVisible.createdAt - 1,
    });
    vi.mocked(storage.getEntriesPage).mockResolvedValueOnce({
      entries: [firstVisible],
      totalCount: 2,
      ...readablePageMeta,
      hasMore: true,
      nextCursor: { createdAt: firstVisible.createdAt, id: firstVisible.id },
    });
    vi.mocked(storage.getEntriesByDate).mockResolvedValueOnce(
      datePage([firstVisible, olderSameDay]),
    );

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSelectedDate("2026-06-12"));

    await waitFor(() => expect(storage.getEntriesByDate).toHaveBeenCalledWith("2026-06-12"));
    await waitFor(() => {
      expect(result.current.entries.map((entry) => entry.id)).toEqual([
        "selected-date-first",
        "selected-date-older",
      ]);
    });
  });

  it("surfaces the unavailable count from a selected-date read", async () => {
    const readable = makeEntry({ id: "selected-date-readable", date: "2026-06-13" });
    vi.mocked(storage.getEntriesByDate).mockResolvedValueOnce(
      datePage([readable], 1),
    );

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSelectedDate("2026-06-13"));

    await waitFor(() => expect(result.current.unavailableCount).toBe(1));
    expect(result.current.totalCount).toBe(2);
    expect(result.current.entryPageState).toBe("degraded");
    expect(result.current.entries.map((entry) => entry.id)).toEqual([
      "selected-date-readable",
    ]);
  });

  it("keeps pending soft-deleted entries hidden from background and date backfills", async () => {
    const pendingEntry = makeEntry({ id: "pending-delete", date: "2026-06-12", createdAt: 2000 });
    vi.mocked(storage.getEntriesPage)
      .mockResolvedValueOnce({
        entries: [pendingEntry],
        totalCount: 1,
        ...readablePageMeta,
        hasMore: true,
        nextCursor: { createdAt: pendingEntry.createdAt, id: pendingEntry.id },
      })
      .mockResolvedValueOnce({
        entries: [pendingEntry],
        totalCount: 1,
        ...readablePageMeta,
        hasMore: false,
        nextCursor: null,
      });
    vi.mocked(storage.getEntriesByDate).mockResolvedValue(datePage([pendingEntry]));

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.totalCount).toBe(1);

    act(() => {
      expect(result.current.softDeleteEntry(pendingEntry.id)?.id).toBe(pendingEntry.id);
      result.current.setSelectedDate(pendingEntry.date);
    });
    await waitFor(() => expect(storage.getEntriesByDate).toHaveBeenCalledWith(pendingEntry.date));

    await act(async () => {
      scheduleIdleMock.callbacks.shift()?.();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.allEntries).toEqual([]));
    expect(result.current.entries).toEqual([]);
    expect(result.current.totalCount).toBe(0);

    act(() => {
      result.current.restoreEntry(pendingEntry);
    });

    await waitFor(() => expect(result.current.allEntries.map((entry) => entry.id)).toEqual([pendingEntry.id]));
    expect(result.current.totalCount).toBe(1);
  });

  it("does not resurrect a committed delete from a stale background backfill", async () => {
    const deletedEntry = makeEntry({ id: "committed-delete", date: "2026-06-12", createdAt: 2000 });
    let resolveBackgroundPage: (page: Awaited<ReturnType<typeof storage.getEntriesPage>>) => void = () => undefined;
    vi.mocked(storage.getEntriesPage)
      .mockResolvedValueOnce({
        entries: [deletedEntry],
        totalCount: 1,
        ...readablePageMeta,
        hasMore: true,
        nextCursor: { createdAt: deletedEntry.createdAt, id: deletedEntry.id },
      })
      .mockReturnValueOnce(new Promise((resolve) => { resolveBackgroundPage = resolve; }));
    vi.mocked(storage.commitPendingJournalEntryDelete).mockResolvedValue("committed");

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      scheduleIdleMock.callbacks.shift()?.();
      await Promise.resolve();
    });

    act(() => {
      expect(result.current.softDeleteEntry(deletedEntry.id)?.id).toBe(deletedEntry.id);
    });
    await act(async () => {
      await result.current.commitDeleteEntry(deletedEntry.id);
    });

    await act(async () => {
      resolveBackgroundPage({
        entries: [deletedEntry],
        totalCount: 1,
        ...readablePageMeta,
        hasMore: false,
        nextCursor: null,
      });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.allEntries).toEqual([]));
    expect(result.current.entries).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it("restores a retained entry when another tab already released the pending delete claim", async () => {
    const retainedEntry = makeEntry({ id: "cross-tab-undo", date: "2026-06-12" });
    vi.mocked(storage.getEntriesPage).mockResolvedValueOnce({
      entries: [retainedEntry],
      totalCount: 1,
      ...readablePageMeta,
      hasMore: false,
      nextCursor: null,
    });
    vi.mocked(storage.commitPendingJournalEntryDelete).mockResolvedValueOnce("not-claimed");
    vi.mocked(storage.getEntryById).mockResolvedValueOnce(retainedEntry);
    vi.mocked(storage.getEntryCount).mockResolvedValueOnce(1);

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      expect(result.current.softDeleteEntry(retainedEntry.id)?.id).toBe(retainedEntry.id);
    });
    expect(result.current.totalCount).toBe(0);

    await act(async () => {
      await result.current.commitDeleteEntry(retainedEntry.id);
    });

    expect(result.current.allEntries.map((entry) => entry.id)).toEqual([retainedEntry.id]);
    expect(result.current.totalCount).toBe(1);
  });


  it("clears the hidden delete marker when committed storage delete fails", async () => {
    const retainedEntry = makeEntry({ id: "delete-failed", date: "2026-06-12", createdAt: 2000 });
    vi.mocked(storage.getEntriesPage)
      .mockResolvedValueOnce({
        entries: [retainedEntry],
        totalCount: 1,
        ...readablePageMeta,
        hasMore: false,
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        entries: [retainedEntry],
        totalCount: 1,
        ...readablePageMeta,
        hasMore: false,
        nextCursor: null,
      });
    vi.mocked(storage.commitPendingJournalEntryDelete).mockRejectedValueOnce(
      new Error("delete failed"),
    );

    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      expect(result.current.softDeleteEntry(retainedEntry.id)?.id).toBe(retainedEntry.id);
    });
    await expect(result.current.commitDeleteEntry(retainedEntry.id)).rejects.toThrow("delete failed");

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.allEntries.map((entry) => entry.id)).toEqual([retainedEntry.id]));
    expect(result.current.totalCount).toBe(1);
  });

});
