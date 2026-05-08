import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MEMORY_PORTAL_PREFERENCES,
  MEMORY_PORTAL_ACTION_ICON_KEYS,
  MEMORY_PORTAL_ACTIONS,
  buildMemoryPortalNodes,
  countJournalWords,
  getEntriesForPortalDate,
  getMemoryPortalMoodSignal,
  getZodiacSignForBirthDate,
  loadMemoryPortalPreferences,
  saveMemoryPortalPreferences,
} from "../memoryPortal";
import type { JournalEntry } from "../types";

function entry(overrides: Partial<JournalEntry>): JournalEntry {
  return {
    id: "entry-1",
    date: "2026-04-25",
    title: "",
    content: "",
    stickers: [],
    photoIds: [],
    audioIds: [],
    tags: [],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe("memoryPortal", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("maps journal entries into deterministic portal nodes", () => {
    const nodes = buildMemoryPortalNodes(
      [
        entry({
          id: "first",
          title: "Quiet morning",
          content: "<p>One careful thought with enough words to count.</p>",
          photoIds: ["photo-1"],
          audioIds: ["audio-1"],
          createdAt: 2000,
        }),
      ],
      "2026-04-25"
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      entryId: "first",
      title: "Quiet morning",
      hasMedia: true,
      hasAudio: true,
      isSelectedDay: true,
      size: "lg",
    });
    expect(nodes[0].x).toBeGreaterThanOrEqual(8);
    expect(nodes[0].x).toBeLessThanOrEqual(92);
    expect(nodes[0].y).toBeGreaterThanOrEqual(8);
    expect(nodes[0].y).toBeLessThanOrEqual(92);
  });

  it("prioritizes selected-day nodes before newer entries from other days", () => {
    const nodes = buildMemoryPortalNodes(
      [
        entry({ id: "newer", date: "2026-04-24", createdAt: 5000 }),
        entry({ id: "selected", date: "2026-04-25", createdAt: 1000 }),
      ],
      "2026-04-25"
    );

    expect(nodes[0].entryId).toBe("selected");
  });

  it("filters day capsule entries by selected date", () => {
    const selected = getEntriesForPortalDate(
      [
        entry({ id: "old", date: "2026-04-25", createdAt: 1000 }),
        entry({ id: "new", date: "2026-04-25", createdAt: 3000 }),
        entry({ id: "other", date: "2026-04-24", createdAt: 5000 }),
      ],
      "2026-04-25"
    );

    expect(selected.map((item) => item.id)).toEqual(["new", "old"]);
  });

  it("saves and loads local-only portal preferences", () => {
    vi.setSystemTime(new Date("2026-04-25T12:00:00Z"));
    const saved = saveMemoryPortalPreferences({
      motionIntensity: "quiet",
      constellationVisible: false,
      actionOrder: ["focus", "write"],
    });

    expect(saved.motionIntensity).toBe("quiet");
    expect(saved.constellationVisible).toBe(false);
    expect(loadMemoryPortalPreferences()).toMatchObject({
      motionIntensity: "quiet",
      constellationVisible: false,
      actionOrder: ["focus", "write", "voice", "photo", "gratitude", "burn"],
    });
  });

  it("falls back from corrupted preferences without crashing", () => {
    localStorage.setItem("zenflow:journal-memory-portal-preferences:v1", "{bad json");

    expect(loadMemoryPortalPreferences()).toMatchObject(DEFAULT_MEMORY_PORTAL_PREFERENCES);
  });

  it("uses lucide icon keys and no emoji action icons", () => {
    const emojiPattern = /\p{Extended_Pictographic}/u;

    for (const action of MEMORY_PORTAL_ACTIONS) {
      expect(MEMORY_PORTAL_ACTION_ICON_KEYS[action]).toMatch(/^[a-z][a-zA-Z0-9]*$/);
      expect(MEMORY_PORTAL_ACTION_ICON_KEYS[action]).not.toMatch(emojiPattern);
    }
  });

  it("counts plain words from rich journal content", () => {
    expect(countJournalWords("<p>First&nbsp;line</p><p>second line</p>")).toBe(4);
  });

  it("uses the selected day's real mood signal before journal fallback", () => {
    const signal = getMemoryPortalMoodSignal(
      [entry({ id: "journal-mood", mood: "bad" })],
      [
        {
          id: "mood-1",
          mood: "great",
          date: "2026-04-25",
          timestamp: 1000,
          valence: 0.72,
        },
      ],
      "2026-04-25"
    );

    expect(signal).toMatchObject({
      hasMoodSignal: true,
      source: "mood",
    });
    expect(signal.valence).toBeCloseTo(0.72);
  });

  it("falls back to journal entry mood when no mood log exists for the selected day", () => {
    const signal = getMemoryPortalMoodSignal(
      [entry({ id: "journal-mood", mood: "bad" })],
      [],
      "2026-04-25"
    );

    expect(signal).toMatchObject({
      hasMoodSignal: true,
      source: "journal",
    });
    expect(signal.valence).toBeLessThan(0);
  });

  it("derives zodiac signs from an optional stored birth date", () => {
    expect(getZodiacSignForBirthDate("1994-04-10")).toBe("aries");
    expect(getZodiacSignForBirthDate("1994-12-28")).toBe("capricorn");
    expect(getZodiacSignForBirthDate("not-a-date")).toBeNull();
  });
});
