import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  localCounts: {
    moods: vi.fn(),
    habits: vi.fn(),
    focusSessions: vi.fn(),
    gratitude: vi.fn(),
    journal: vi.fn(),
  },
  remoteResults: [] as Array<{ count: number | null; error: Error | null }>,
  getCurrentUserId: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/storage/db", () => ({
  db: {
    moods: { count: mocks.localCounts.moods },
    habits: { count: mocks.localCounts.habits },
    focusSessions: { count: mocks.localCounts.focusSessions },
    gratitudeEntries: { count: mocks.localCounts.gratitude },
    journalEntries: { count: mocks.localCounts.journal },
  },
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(async () => mocks.remoteResults.shift() ?? { count: 0, error: null }),
      })),
    })),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { log: mocks.log, warn: mocks.warn, error: mocks.error },
}));

import { verifySyncIntegrity } from "@/lib/syncIntegrity";

describe("verifySyncIntegrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    Object.values(mocks.localCounts).forEach((count) => count.mockResolvedValue(0));
    mocks.remoteResults.splice(0, mocks.remoteResults.length,
      { count: 0, error: null },
      { count: 0, error: null },
      { count: 0, error: null },
      { count: 0, error: null },
      { count: 0, error: null },
    );
  });

  it("keeps real zero counts as a verified result", async () => {
    const report = await verifySyncIntegrity();

    expect(report).toMatchObject({
      status: "verified",
      localCounts: { moods: 0, habits: 0, focusSessions: 0, gratitude: 0, journal: 0 },
      remoteCounts: { moods: 0, habits: 0, focusSessions: 0, gratitude: 0, journal: 0 },
      maxDivergence: 0,
      needsReconciliation: false,
    });
    expect(mocks.log).toHaveBeenCalledWith("[SyncIntegrity] Data consistent:", report);
  });

  it("reports local read failure as unavailable instead of fabricated zero counts", async () => {
    mocks.localCounts.moods.mockRejectedValueOnce(new Error("IndexedDB unavailable"));

    const report = await verifySyncIntegrity();

    expect(report).toMatchObject({
      status: "unavailable",
      localCounts: null,
      remoteCounts: null,
      divergence: {},
      maxDivergence: null,
      needsReconciliation: false,
      failureCode: "count-read-failed",
    });
    expect(mocks.log).not.toHaveBeenCalledWith("[SyncIntegrity] Data consistent:", expect.anything());
    expect(mocks.warn).toHaveBeenCalledWith("[SyncIntegrity] Verification unavailable:", expect.any(Object));
  });

  it("treats a Supabase count error as unavailable rather than count zero", async () => {
    mocks.remoteResults[2] = { count: null, error: new Error("remote read failed") };

    const report = await verifySyncIntegrity();

    expect(report).toMatchObject({
      status: "unavailable",
      localCounts: null,
      remoteCounts: null,
      maxDivergence: null,
      failureCode: "count-read-failed",
    });
    expect(mocks.log).not.toHaveBeenCalledWith("[SyncIntegrity] Data consistent:", expect.anything());
  });
});
