import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useJournal } from "../useJournal";
import type { JournalEntry } from "../types";
import * as storage from "../journalStorage";

vi.mock("../journalStorage", () => ({
  getAllEntries: vi.fn(),
  saveEntry: vi.fn(),
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
    vi.mocked(storage.getAllEntries).mockResolvedValue([]);
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
});
