import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/platform", () => ({ isNative: false }));
vi.mock("@/storage/db", () => ({ db: { settings: { get: vi.fn(), put: vi.fn() } } }));
vi.mock("@/lib/localNotifications", () => ({
  scheduleJournalReminder: vi.fn(),
  cancelJournalReminder: vi.fn(),
}));

import { getDaysSinceLastEntry } from "../useJournalReminder";

describe("journal reminder civil dates", () => {
  it("counts calendar dates across a daylight-saving boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 9, 12));

    expect(getDaysSinceLastEntry(new Map([["2026-03-08", true]]))).toBe(1);

    vi.useRealTimers();
  });
});
