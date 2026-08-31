import { beforeEach, describe, expect, it, vi } from "vitest";

const graceStorage = vi.hoisted<{ value: unknown }>(() => ({ value: null }));

vi.mock("@/lib/safeJson", () => ({
  safeLocalStorageGet: vi.fn(() => graceStorage.value),
  safeLocalStorageSet: vi.fn((_key: string, value: unknown) => {
    graceStorage.value = value;
    return true;
  }),
}));

import { recordAdActiveDate } from "@/lib/adGracePeriod";

describe("ad onboarding active-day grace", () => {
  beforeEach(() => {
    graceStorage.value = null;
  });

  it("requires four distinct active local dates for a new-user cohort", () => {
    expect(recordAdActiveDate({ localDate: "2026-08-27", hasExistingData: false })).toBe(false);
    expect(recordAdActiveDate({ localDate: "2026-08-27", hasExistingData: true })).toBe(false);
    expect(recordAdActiveDate({ localDate: "2026-08-28", hasExistingData: true })).toBe(false);
    expect(recordAdActiveDate({ localDate: "2026-08-29", hasExistingData: true })).toBe(false);
    expect(recordAdActiveDate({ localDate: "2026-08-30", hasExistingData: true })).toBe(true);
  });

  it("treats data present on the first observed run as an existing-user cohort", () => {
    expect(recordAdActiveDate({ localDate: "2026-08-30", hasExistingData: true })).toBe(true);
  });

  it("fails closed and restarts safely for malformed or missing dates", () => {
    graceStorage.value = { cohort: "new", activeDates: ["not-a-date"] };
    expect(recordAdActiveDate({ localDate: "", hasExistingData: true })).toBe(false);
    expect(recordAdActiveDate({ localDate: "2026-08-30", hasExistingData: false })).toBe(false);
  });
});
