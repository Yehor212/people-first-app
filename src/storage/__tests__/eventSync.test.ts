import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  from: vi.fn(),
  limit: vi.fn(),
  single: vi.fn(),
  supabase: null as { from: ReturnType<typeof vi.fn> } | null,
}));

vi.mock("@/lib/supabaseClient", () => ({
  get supabase() {
    return mocks.supabase;
  },
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    sync: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  triggerDataRefresh: vi.fn(),
}));

import { fetchDelta, getServerMaxSeq } from "@/storage/eventSync";

function createSyncEventsQuery() {
  return {
    select: () => ({
      gt: () => ({
        order: () => ({
          limit: mocks.limit,
        }),
      }),
    }),
  };
}

function createCountersQuery() {
  return {
    select: () => ({
      single: mocks.single,
    }),
  };
}

describe("eventSync auth guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserId.mockResolvedValue(null);
    mocks.limit.mockResolvedValue({ data: [], error: null });
    mocks.single.mockResolvedValue({ data: { last_seq: 42 }, error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === "sync_events") {
        return createSyncEventsQuery();
      }
      if (table === "sync_seq_counters") {
        return createCountersQuery();
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.supabase = { from: mocks.from };
  });

  it("returns an empty delta without querying supabase when the user is signed out", async () => {
    const result = await fetchDelta(10);

    expect(result).toEqual({ events: [], hasMore: false });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns zero max seq without querying supabase when the user is signed out", async () => {
    const result = await getServerMaxSeq();

    expect(result).toBe(0);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
