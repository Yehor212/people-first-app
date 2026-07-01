import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scheduleIdleMock = vi.hoisted(() => ({
  callbacks: [] as Array<() => void>,
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

vi.mock("../journalStorage", () => ({
  getEntriesPage: vi.fn(),
  getAllEntries: vi.fn(),
  getEntriesByDate: vi.fn(),
  saveEntry: vi.fn(),
  deleteEntry: vi.fn(),
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

describe("useJournal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scheduleIdleMock.callbacks.length = 0;
    vi.mocked(storage.getEntriesPage).mockResolvedValue({
      entries: [],
      totalCount: 0,
      hasMore: false,
      nextCursor: null,
    });
    vi.mocked(storage.getAllEntries).mockResolvedValue([]);
  });


  it("loads the first journal page before decrypting the full history", async () => {
    const firstPageEntry = makeEntry({ id: "entry-first", createdAt: 2000 });
    vi.mocked(storage.getEntriesPage).mockResolvedValueOnce({
      entries: [firstPageEntry],
      totalCount: 75,
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

  it("keeps a recoverable load error instead of impersonating an empty diary", async () => {
    vi.mocked(storage.getEntriesPage).mockRejectedValueOnce(new Error("IndexedDB unavailable"));

    const { result } = renderHook(() => useJournal());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe(true);
    expect(result.current.totalCount).toBe(0);

    vi.mocked(storage.getEntriesPage).mockResolvedValueOnce({
      entries: [makeEntry({ id: "entry-recovered" })],
      totalCount: 1,
      hasMore: false,
      nextCursor: null,
    });
    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.loadError).toBe(false));
    expect(result.current.allEntries[0]?.id).toBe("entry-recovered");
  });

  it("surfaces background history failures and lets refresh retry older pages", async () => {
    const firstPageEntry = makeEntry({ id: "entry-first", createdAt: 2000 });
    vi.mocked(storage.getEntriesPage)
      .mockResolvedValueOnce({
        entries: [firstPageEntry],
        totalCount: 2,
        hasMore: true,
        nextCursor: { createdAt: firstPageEntry.createdAt, id: firstPageEntry.id },
      })
      .mockRejectedValueOnce(new Error("older page unavailable"))
      .mockResolvedValueOnce({
        entries: [firstPageEntry],
        totalCount: 2,
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
    expect(result.current.loadError).toBe(true);
    expect(result.current.historyLoading).toBe(false);

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.historyLoadError).toBe(false));
    expect(result.current.loadError).toBe(false);
  });

  it("allows selected-date loads to retry after cancellation or rejection", async () => {
    let resolveFirstDateLoad: (entries: JournalEntry[]) => void = () => undefined;
    vi.mocked(storage.getEntriesPage).mockResolvedValue({
      entries: [],
      totalCount: 1,
      hasMore: false,
      nextCursor: null,
    });
    vi.mocked(storage.getEntriesByDate)
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirstDateLoad = resolve; }))
      .mockRejectedValueOnce(new Error("date unavailable"))
      .mockResolvedValueOnce([makeEntry({ id: "selected-date-other", date: "2026-06-12" })])
      .mockResolvedValueOnce([makeEntry({ id: "selected-date-entry", date: "2026-06-11" })]);

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
      resolveFirstDateLoad([makeEntry({ id: "cancelled-date-entry", date: "2026-06-10" })]);
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

  it("keeps pending soft-deleted entries hidden from background and date backfills", async () => {
    const pendingEntry = makeEntry({ id: "pending-delete", date: "2026-06-12", createdAt: 2000 });
    vi.mocked(storage.getEntriesPage)
      .mockResolvedValueOnce({
        entries: [pendingEntry],
        totalCount: 1,
        hasMore: true,
        nextCursor: { createdAt: pendingEntry.createdAt, id: pendingEntry.id },
      })
      .mockResolvedValueOnce({
        entries: [pendingEntry],
        totalCount: 1,
        hasMore: false,
        nextCursor: null,
      });
    vi.mocked(storage.getEntriesByDate).mockResolvedValue([pendingEntry]);

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
        hasMore: true,
        nextCursor: { createdAt: deletedEntry.createdAt, id: deletedEntry.id },
      })
      .mockReturnValueOnce(new Promise((resolve) => { resolveBackgroundPage = resolve; }));
    vi.mocked(storage.deleteEntry).mockResolvedValue(undefined);

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
        hasMore: false,
        nextCursor: null,
      });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.allEntries).toEqual([]));
    expect(result.current.entries).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });


  it("clears the hidden delete marker when committed storage delete fails", async () => {
    const retainedEntry = makeEntry({ id: "delete-failed", date: "2026-06-12", createdAt: 2000 });
    vi.mocked(storage.getEntriesPage)
      .mockResolvedValueOnce({
        entries: [retainedEntry],
        totalCount: 1,
        hasMore: false,
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        entries: [retainedEntry],
        totalCount: 1,
        hasMore: false,
        nextCursor: null,
      });
    vi.mocked(storage.deleteEntry).mockRejectedValueOnce(new Error("delete failed"));

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
