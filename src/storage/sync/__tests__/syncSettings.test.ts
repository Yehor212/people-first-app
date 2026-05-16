import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
  enqueue: vi.fn(),
  getPersistentDeviceId: vi.fn(),
  writeEventAndBroadcast: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: mocks.from },
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: { enqueue: mocks.enqueue },
}));

vi.mock("@/storage/eventSync", () => ({
  getPersistentDeviceId: mocks.getPersistentDeviceId,
  writeEventAndBroadcast: mocks.writeEventAndBroadcast,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../syncUtils", () => ({
  detectNetworkError: vi.fn(() => false),
}));

import { syncSetting } from "../syncSettings";

describe("syncSetting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.getPersistentDeviceId.mockResolvedValue("device-1");
  });

  it("writes a setting sync event after a successful cloud upsert", async () => {
    await syncSetting("mood-reminder-enabled", true);
    await Promise.resolve();

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        key: "mood-reminder-enabled",
        value: true,
        updated_at: expect.any(String),
      }),
      { onConflict: "user_id,key" }
    );
    expect(mocks.writeEventAndBroadcast).toHaveBeenCalledWith(
      "setting",
      "mood-reminder-enabled",
      "upsert",
      expect.objectContaining({
        key: "mood-reminder-enabled",
        value: true,
        updatedAt: expect.any(String),
      }),
      "device-1"
    );
  });

  it("queues setting changes while offline instead of writing partial cloud state", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await syncSetting("mood-reminder-enabled", false);

    expect(mocks.enqueue).toHaveBeenCalledWith("UPDATE_SETTINGS", "mood-reminder-enabled", {
      key: "mood-reminder-enabled",
      value: false,
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });
});
