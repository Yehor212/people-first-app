import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  from: vi.fn(),
  limit: vi.fn(),
  single: vi.fn(),
  settingsGet: vi.fn(),
  settingsPut: vi.fn(),
  table: vi.fn(),
  transaction: vi.fn(),
  habitTableGet: vi.fn(),
  habitTablePut: vi.fn(),
  habitTableDelete: vi.fn(),
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

vi.mock("@/storage/db", () => ({
  db: {
    settings: {
      get: mocks.settingsGet,
      put: mocks.settingsPut,
    },
    table: mocks.table,
    transaction: mocks.transaction,
  },
}));

import { fetchDelta, getServerMaxSeq, pullAndApplyDeltasFromLastSeq } from "@/storage/eventSync";

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
    mocks.settingsGet.mockImplementation(async (key: string) => {
      if (key === "sync-last-seq") return { key, value: 10 };
      if (key === "zenflow-device-id") return { key, value: "current-device" };
      return undefined;
    });
    mocks.settingsPut.mockResolvedValue(undefined);
    mocks.habitTableGet.mockResolvedValue(undefined);
    mocks.habitTablePut.mockResolvedValue(undefined);
    mocks.habitTableDelete.mockResolvedValue(undefined);
    mocks.table.mockImplementation((tableName: string) => {
      if (tableName === "habits") {
        return {
          get: mocks.habitTableGet,
          put: mocks.habitTablePut,
          delete: mocks.habitTableDelete,
        };
      }
      throw new Error(`Unexpected Dexie table: ${tableName}`);
    });
    mocks.transaction.mockImplementation(
      async (_mode: string, _tables: unknown[], callback: () => Promise<void>) => callback()
    );
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

  it("pulls from the eventSync cursor and applies fetched remote events", async () => {
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    const remoteHabit = { id: "habit-1", title: "Drink water", updatedAt: 11 };
    mocks.limit.mockResolvedValueOnce({
      data: [
        {
          id: "event-11",
          seq: 11,
          entity_type: "habit",
          entity_id: "habit-1",
          op: "upsert",
          payload: remoteHabit,
          device_id: "remote-device",
          created_at: "2026-05-11T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await pullAndApplyDeltasFromLastSeq();

    expect(mocks.settingsGet).toHaveBeenCalledWith("sync-last-seq");
    expect(mocks.settingsGet).toHaveBeenCalledWith("zenflow-device-id");
    expect(mocks.habitTablePut).toHaveBeenCalledWith(remoteHabit);
    expect(mocks.settingsPut).toHaveBeenCalledWith({ key: "sync-last-seq", value: 11 });
    expect(result).toEqual({ fetched: 1, applied: 1, lastSeq: 11 });
  });
});
