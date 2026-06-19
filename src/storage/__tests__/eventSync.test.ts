import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  insertSingle: vi.fn(),
  limit: vi.fn(),
  single: vi.fn(),
  settingsGet: vi.fn(),
  settingsPut: vi.fn(),
  settingsDelete: vi.fn(),
  table: vi.fn(),
  transaction: vi.fn(),
  habitTableGet: vi.fn(),
  habitTablePut: vi.fn(),
  habitTableDelete: vi.fn(),
  broadcastChange: vi.fn(),
  enqueue: vi.fn(),
  storageRemove: vi.fn(),
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

vi.mock("@/lib/syncBroadcast", () => ({
  broadcastChange: mocks.broadcastChange,
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    enqueue: mocks.enqueue,
  },
}));

vi.mock("@/lib/safeJson", () => ({
  storageRemove: mocks.storageRemove,
}));

vi.mock("@/storage/db", () => ({
  db: {
    settings: {
      get: mocks.settingsGet,
      put: mocks.settingsPut,
      delete: mocks.settingsDelete,
    },
    habits: {
      get: mocks.habitTableGet,
      put: mocks.habitTablePut,
      delete: mocks.habitTableDelete,
    },
    table: mocks.table,
    transaction: mocks.transaction,
  },
}));

import { ENTRY } from "@/types";
import {
  applyDelta,
  fetchDelta,
  getServerMaxSeq,
  normalizeSyncEventWriteIntent,
  pullAndApplyDeltasFromLastSeq,
  writeEventAndBroadcast,
} from "@/storage/eventSync";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createSyncEventsQuery() {
  return {
    insert: mocks.insert,
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
    mocks.insert.mockReturnValue({
      select: () => ({
        single: mocks.insertSingle,
      }),
    });
    mocks.insertSingle.mockResolvedValue({
      data: {
        id: "event-written",
        seq: 21,
        entity_type: "habit",
        entity_id: "habit-written",
        op: "upsert",
        payload: { id: "habit-written" },
        device_id: "device-1",
        created_at: "2026-05-11T12:00:00.000Z",
      },
      error: null,
    });
    mocks.settingsGet.mockImplementation(async (key: string) => {
      if (key === "sync-last-seq") return { key, value: 10 };
      if (key === "zenflow-device-id") return { key, value: "current-device" };
      return undefined;
    });
    mocks.settingsPut.mockResolvedValue(undefined);
    mocks.settingsDelete.mockResolvedValue(undefined);
    mocks.habitTableGet.mockResolvedValue(undefined);
    mocks.habitTablePut.mockResolvedValue(undefined);
    mocks.habitTableDelete.mockResolvedValue(undefined);
    mocks.enqueue.mockResolvedValue(undefined);
    mocks.table.mockImplementation((tableName: string) => {
      if (tableName === "habits") {
        return {
          get: mocks.habitTableGet,
          put: mocks.habitTablePut,
          delete: mocks.habitTableDelete,
        };
      }
      if (tableName === "settings") {
        return {
          get: mocks.settingsGet,
          put: mocks.settingsPut,
          delete: mocks.settingsDelete,
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

  it("applies habit completion events into embedded habit entries", async () => {
    mocks.habitTableGet.mockResolvedValue({
      id: "habit-1",
      name: "Water",
      habitType: "boolean",
      entries: {},
      updatedAt: "2026-05-10T07:00:00.000Z",
    });

    const applied = await applyDelta(
      [
        {
          id: "event-12",
          seq: 12,
          entity_type: "habit_completion",
          entity_id: "habit-1_2026-05-11",
          op: "upsert",
          payload: {
            habitId: "habit-1",
            date: "2026-05-11",
            habitType: "boolean",
            count: 1,
          },
          device_id: "remote-device",
          created_at: "2026-05-11T09:00:00.000Z",
        },
      ],
      "current-device"
    );

    expect(applied).toBe(1);
    expect(mocks.habitTablePut).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "habit-1",
        updatedAt: "2026-05-11T09:00:00.000Z",
        entries: {
          "2026-05-11": expect.objectContaining({
            value: ENTRY.YES_MANUAL,
            loggedAt: "2026-05-11T09:00:00.000Z",
          }),
        },
      })
    );
    expect(mocks.settingsPut).toHaveBeenCalledWith({ key: "sync-last-seq", value: 12 });
  });

  it("applies habit completion delete events without refetching the whole backup", async () => {
    mocks.habitTableGet.mockResolvedValue({
      id: "habit-1",
      name: "Water",
      habitType: "boolean",
      entries: {
        "2026-05-11": { value: ENTRY.YES_MANUAL, loggedAt: "2026-05-11T08:00:00.000Z" },
      },
      updatedAt: "2026-05-11T08:00:00.000Z",
    });

    const applied = await applyDelta(
      [
        {
          id: "event-13",
          seq: 13,
          entity_type: "habit_completion",
          entity_id: "habit-1_2026-05-11",
          op: "delete",
          payload: null,
          device_id: "remote-device",
          created_at: "2026-05-11T09:30:00.000Z",
        },
      ],
      "current-device"
    );

    expect(applied).toBe(1);
    expect(mocks.habitTablePut).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: {},
        updatedAt: "2026-05-11T09:30:00.000Z",
      })
    );
    expect(mocks.settingsPut).toHaveBeenCalledWith({ key: "sync-last-seq", value: 13 });
  });

  it("applies setting events directly through the ordered event log", async () => {
    const applied = await applyDelta(
      [
        {
          id: "event-14",
          seq: 14,
          entity_type: "setting",
          entity_id: "mood-reminder-enabled",
          op: "upsert",
          payload: {
            key: "mood-reminder-enabled",
            value: true,
            updatedAt: "2026-05-11T10:00:00.000Z",
          },
          device_id: "remote-device",
          created_at: "2026-05-11T10:00:00.000Z",
        },
      ],
      "current-device"
    );

    expect(applied).toBe(1);
    expect(mocks.settingsPut).toHaveBeenCalledWith({
      key: "mood-reminder-enabled",
      value: true,
    });
    expect(mocks.settingsPut).toHaveBeenCalledWith({ key: "sync-last-seq", value: 14 });
  });

  it("ignores remote deletes for local-only unsaved journal drafts", async () => {
    const applied = await applyDelta(
      [
        {
          id: "event-setting-delete",
          seq: 15,
          entity_type: "setting",
          entity_id: "journal_draft_new",
          op: "delete",
          payload: { key: "journal_draft_new", deletedAt: "2026-05-11T10:00:00.000Z" },
          device_id: "remote-device",
          created_at: "2026-05-11T10:00:00.000Z",
        },
      ],
      "current-device"
    );

    expect(applied).toBe(0);
    expect(mocks.settingsDelete).not.toHaveBeenCalledWith("journal_draft_new");
    expect(mocks.storageRemove).not.toHaveBeenCalledWith("journal_draft_new");
    expect(mocks.settingsPut).toHaveBeenCalledWith({ key: "sync-last-seq", value: 15 });
  });

  it("ignores remote setting events for local-only sync cursor and device keys", async () => {
    const applied = await applyDelta(
      [
        {
          id: "event-local-only-setting",
          seq: 16,
          entity_type: "setting",
          entity_id: "zenflow-device-id",
          op: "upsert",
          payload: {
            key: "zenflow-device-id",
            value: "remote-device-id",
            updatedAt: "2026-05-11T10:05:00.000Z",
          },
          device_id: "remote-device",
          created_at: "2026-05-11T10:05:00.000Z",
        },
      ],
      "current-device"
    );

    expect(applied).toBe(0);
    expect(mocks.settingsPut).not.toHaveBeenCalledWith({
      key: "zenflow-device-id",
      value: "remote-device-id",
    });
    expect(mocks.settingsPut).toHaveBeenCalledWith({ key: "sync-last-seq", value: 16 });
  });

  it("records tombstones when applying remote delete events", async () => {
    const applied = await applyDelta(
      [
        {
          id: "event-15",
          seq: 15,
          entity_type: "habit",
          entity_id: "habit-deleted",
          op: "delete",
          payload: null,
          device_id: "remote-device",
          created_at: "2026-05-11T11:00:00.000Z",
        },
      ],
      "current-device"
    );

    expect(applied).toBe(1);
    expect(mocks.habitTableDelete).toHaveBeenCalledWith("habit-deleted");
    expect(mocks.settingsPut).toHaveBeenCalledWith({
      key: "zenflow-deleted-habit-ids",
      value: ["habit-deleted"],
    });
    expect(mocks.settingsPut).toHaveBeenCalledWith({ key: "sync-last-seq", value: 15 });
  });

  it("keeps habit tombstones authoritative over later stale upsert events", async () => {
    const staleHabit = {
      id: "habit-deleted",
      name: "Stale resurrected habit",
      updatedAt: "2026-05-11T09:00:00.000Z",
    };

    const applied = await applyDelta(
      [
        {
          id: "event-delete-habit",
          seq: 16,
          entity_type: "habit",
          entity_id: "habit-deleted",
          op: "delete",
          payload: null,
          device_id: "remote-device",
          created_at: "2026-05-11T10:00:00.000Z",
        },
        {
          id: "event-stale-upsert",
          seq: 17,
          entity_type: "habit",
          entity_id: "habit-deleted",
          op: "upsert",
          payload: staleHabit,
          device_id: "other-stale-device",
          created_at: "2026-05-11T10:30:00.000Z",
        },
      ],
      "current-device"
    );

    expect(applied).toBe(1);
    expect(mocks.habitTableDelete).toHaveBeenCalledWith("habit-deleted");
    expect(mocks.habitTablePut).not.toHaveBeenCalledWith(staleHabit);
    expect(mocks.settingsPut).toHaveBeenCalledWith({ key: "sync-last-seq", value: 17 });
  });

  it("does not apply habit completion events for locally tombstoned habits", async () => {
    mocks.settingsGet.mockImplementation(async (key: string) => {
      if (key === "zenflow-deleted-habit-ids") return { key, value: ["habit-deleted"] };
      if (key === "sync-last-seq") return { key, value: 17 };
      if (key === "zenflow-device-id") return { key, value: "current-device" };
      return undefined;
    });
    mocks.habitTableGet.mockResolvedValue({
      id: "habit-deleted",
      name: "Stale local habit",
      habitType: "boolean",
      entries: {},
    });

    const applied = await applyDelta(
      [
        {
          id: "event-stale-completion",
          seq: 18,
          entity_type: "habit_completion",
          entity_id: "habit-deleted_2026-05-11",
          op: "upsert",
          payload: {
            habitId: "habit-deleted",
            date: "2026-05-11",
            habitType: "boolean",
            count: 1,
          },
          device_id: "other-stale-device",
          created_at: "2026-05-11T10:40:00.000Z",
        },
      ],
      "current-device"
    );

    expect(applied).toBe(0);
    expect(mocks.habitTableDelete).toHaveBeenCalledWith("habit-deleted");
    expect(mocks.habitTablePut).not.toHaveBeenCalled();
    expect(mocks.settingsPut).toHaveBeenCalledWith({ key: "sync-last-seq", value: 18 });
  });

  it("keeps newer local entities when remote event timestamps are ISO strings", async () => {
    const remoteHabit = {
      id: "habit-iso",
      name: "Remote stale",
      updatedAt: "2026-05-11T09:00:00.000Z",
    };
    mocks.habitTableGet.mockResolvedValue({
      id: "habit-iso",
      name: "Local newer",
      updatedAt: "2026-05-11T10:00:00.000Z",
    });

    const applied = await applyDelta(
      [
        {
          id: "event-16",
          seq: 16,
          entity_type: "habit",
          entity_id: "habit-iso",
          op: "upsert",
          payload: remoteHabit,
          device_id: "remote-device",
          created_at: "2026-05-11T09:01:00.000Z",
        },
      ],
      "current-device"
    );

    expect(applied).toBe(0);
    expect(mocks.habitTablePut).not.toHaveBeenCalled();
    expect(mocks.settingsPut).toHaveBeenCalledWith({ key: "sync-last-seq", value: 16 });
  });

  it("applies later durable server events even when payload timestamps are stale", async () => {
    const remoteHabit = {
      id: "habit-seq-wins",
      name: "Remote server event wins",
      updatedAt: "2026-05-11T09:00:00.000Z",
    };
    mocks.habitTableGet.mockResolvedValue({
      id: "habit-seq-wins",
      name: "Local older durable state",
      updatedAt: "2026-05-11T10:00:00.000Z",
    });

    const applied = await applyDelta(
      [
        {
          id: "event-17",
          seq: 17,
          entity_type: "habit",
          entity_id: "habit-seq-wins",
          op: "upsert",
          payload: remoteHabit,
          device_id: "remote-device",
          created_at: "2026-05-11T10:30:00.000Z",
        },
      ],
      "current-device"
    );

    expect(applied).toBe(1);
    expect(mocks.habitTablePut).toHaveBeenCalledWith(remoteHabit);
    expect(mocks.settingsPut).toHaveBeenCalledWith({ key: "sync-last-seq", value: 17 });
  });

  it("writes the durable event before broadcasting the remote wake-up signal", async () => {
    mocks.getCurrentUserId.mockResolvedValue("user-1");

    const event = await writeEventAndBroadcast(
      "habit",
      "habit-written",
      "upsert",
      { id: "habit-written" },
      "device-1"
    );

    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      entity_type: "habit",
      entity_id: "habit-written",
      op: "upsert",
      payload: { id: "habit-written" },
      device_id: "device-1",
      idempotency_key: expect.stringMatching(UUID_RE),
    });
    expect(mocks.insertSingle).toHaveBeenCalled();
    expect(mocks.broadcastChange).toHaveBeenCalledWith("habits", 21);
    expect(event?.seq).toBe(21);
  });

  it("queues a durable event retry and avoids stale wake-up when the event write is unavailable", async () => {
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.insertSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "temporary insert failure" },
    });

    const event = await writeEventAndBroadcast("mood", "mood-1", "delete", null, "device-1");

    expect(event).toBeNull();
    expect(mocks.broadcastChange).not.toHaveBeenCalled();
    expect(mocks.enqueue).toHaveBeenCalledWith(
      "WRITE_SYNC_EVENT",
      expect.stringContaining("sync-event:mood:mood-1:delete:"),
      {
        entityType: "mood",
        entityId: "mood-1",
        op: "delete",
        payload: null,
        deviceId: "device-1",
        idempotencyKey: expect.stringMatching(UUID_RE),
      },
      {
        deduplicate: false,
        maxRetries: 20,
        priority: "critical",
      }
    );
  });

  it("normalizes legacy queued idempotency keys to live Supabase UUID format", () => {
    const normalized = normalizeSyncEventWriteIntent({
      entityType: "journal",
      entityId: "journal-1",
      op: "upsert",
      payload: { id: "journal-1" },
      deviceId: "device-1",
      idempotencyKey: "device-1:journal:journal-1:upsert:legacy",
    });

    expect(normalized.idempotencyKey).toEqual(expect.stringMatching(UUID_RE));
  });
});
