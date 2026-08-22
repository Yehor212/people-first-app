import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  validateSyncOwner: vi.fn(),
  broadcastCommittedSyncEvent: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { rpc: mocks.rpc },
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: mocks.validateSyncOwner,
}));

vi.mock("@/storage/eventSync", () => ({
  broadcastCommittedSyncEvent: mocks.broadcastCommittedSyncEvent,
}));

import { commitManualSyncEvent } from "../manualSyncAcceptance";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OPERATION = "22222222-2222-4222-8222-222222222222";

const request = {
  ownerUserId: OWNER,
  operationId: OPERATION,
  entityType: "setting" as const,
  entityId: "zenflow-schedule-events",
  op: "upsert" as const,
  projection: [{ id: "opaque-event", completed: false }],
  deviceId: "device-a",
};

const acceptedEvent = {
  id: "33333333-3333-4333-8333-333333333333",
  seq: 17,
  entity_type: "setting" as const,
  entity_id: "zenflow-schedule-events",
  op: "upsert" as const,
  payload: {
    key: "zenflow-schedule-events",
    value: [{ id: "opaque-event", completed: false }],
    updatedAt: 101,
  },
  device_id: "device-a",
  created_at: "2026-08-13T08:00:00.000Z",
};

describe("manual sync atomic acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateSyncOwner.mockResolvedValue(OWNER);
    mocks.rpc.mockResolvedValue({
      data: {
        schemaVersion: 1,
        code: "COMMITTED",
        operationId: OPERATION,
        event: acceptedEvent,
      },
      error: null,
    });
  });

  it("submits one owner-bound RPC and broadcasts only its validated canonical event", async () => {
    await expect(commitManualSyncEvent(request)).resolves.toEqual(acceptedEvent);

    expect(mocks.rpc).toHaveBeenCalledWith("commit_manual_sync_event", {
      p_request: {
        schemaVersion: 1,
        operationId: OPERATION,
        entityType: "setting",
        entityId: "zenflow-schedule-events",
        op: "upsert",
        projection: request.projection,
        deviceId: "device-a",
      },
    });
    expect(mocks.validateSyncOwner).toHaveBeenNthCalledWith(
      1,
      OWNER,
      "Manual sync acceptance",
    );
    expect(mocks.validateSyncOwner).toHaveBeenNthCalledWith(
      2,
      OWNER,
      "Manual sync acceptance receipt",
    );
    expect(mocks.broadcastCommittedSyncEvent).toHaveBeenCalledWith(acceptedEvent);
  });

  it("rejects a mismatched receipt without broadcasting or acknowledging it", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        schemaVersion: 1,
        code: "ALREADY_COMMITTED",
        operationId: OPERATION,
        event: { ...acceptedEvent, entity_id: "different-setting" },
      },
      error: null,
    });

    await expect(commitManualSyncEvent(request)).rejects.toThrow(
      "Manual sync acceptance receipt is invalid",
    );
    expect(mocks.broadcastCommittedSyncEvent).not.toHaveBeenCalled();
  });

  it("keeps a provider failure retryable without including its raw message", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "PRIVATE_PROVIDER_CANARY" },
    });

    await expect(commitManualSyncEvent(request)).rejects.toThrow(
      "Manual sync acceptance failed",
    );
  });
});
