import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  match: vi.fn(),
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

import { deleteSettingFromCloud, syncSetting } from "../syncSettings";

describe("syncSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.match.mockResolvedValue({ error: null });
    mocks.delete.mockReturnValue({ match: mocks.match });
    mocks.from.mockReturnValue({ upsert: mocks.upsert, delete: mocks.delete });
    mocks.getPersistentDeviceId.mockResolvedValue("device-1");
  });

  it("writes a setting sync event after a successful cloud upsert", async () => {
    await syncSetting("mood-reminder-enabled", true);

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

  it("does not resolve before the durable sync event/outbox write finishes", async () => {
    let releaseEventWrite: () => void = () => {};
    mocks.writeEventAndBroadcast.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        releaseEventWrite = resolve;
      })
    );

    let resolved = false;
    const syncPromise = syncSetting("mood-reminder-enabled", true).then(() => {
      resolved = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.writeEventAndBroadcast).toHaveBeenCalled();
    await Promise.resolve();
    expect(resolved).toBe(false);

    releaseEventWrite();
    await syncPromise;
    expect(resolved).toBe(true);
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

  it("does not sync local-only cursor or device settings to the account", async () => {
    await syncSetting("zenflow-device-id", "device-from-this-browser");
    await syncSetting("sync-last-seq", 42);

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("syncs the wrapped journal vault key so another device can recover encrypted diary data", async () => {
    await syncSetting("journal_vault_key", {
      wrappedKey: "wrapped-key-fixture",
      createdAt: 1_781_580_000_000,
      updatedAt: 1_781_580_000_000,
    });

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        key: "journal_vault_key",
        value: {
          wrappedKey: "wrapped-key-fixture",
          createdAt: 1_781_580_000_000,
          updatedAt: 1_781_580_000_000,
        },
      }),
      { onConflict: "user_id,key" }
    );
  });

  it("does not sync password cooldown security settings", async () => {
    await syncSetting("journal_password_cooldown", {
      failedAttempts: 3,
      cooldownUntil: 1_781_580_030_000,
    });

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("does not sync journal reset pending/proof security settings", async () => {
    await syncSetting("journal_password_reset_pending", {
      email: "owner@example.invalid",
      nonce: "reset-proof",
      startedAt: 1_781_580_000_000,
    });
    await syncSetting("journal_password_reset_proof", {
      nonce: "reset-proof",
      receivedAt: 1_781_580_000_000,
    });

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("queues the wrapped journal vault key while offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await syncSetting("journal_vault_key", { wrappedKey: "wrapped-key-fixture" });

    expect(mocks.enqueue).toHaveBeenCalledWith("UPDATE_SETTINGS", "journal_vault_key", {
      key: "journal_vault_key",
      value: { wrappedKey: "wrapped-key-fixture" },
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("queues wrapped journal vault key deletion while offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await deleteSettingFromCloud("journal_vault_key");

    expect(mocks.enqueue).toHaveBeenCalledWith("DELETE_SETTINGS", "journal_vault_key", {
      key: "journal_vault_key",
    });
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("does not queue password cooldown while offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await syncSetting("journal_password_cooldown", { failedAttempts: 4 });

    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("does not queue journal reset pending/proof while offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await syncSetting("journal_password_reset_pending", { nonce: "reset-proof" });
    await syncSetting("journal_password_reset_proof", { nonce: "reset-proof" });

    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("does not sync unsaved journal drafts to the account channel", async () => {
    await syncSetting("journal_draft_new", {
      title: "private unsaved draft",
      content: "<p>not saved yet</p>",
      audioIds: ["audio-local"],
      photoIds: ["photo-local"],
    });

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("does not queue unsaved journal drafts while offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await syncSetting("journal_draft_entry-1", {
      title: "offline private draft",
      content: "<p>still local only</p>",
    });

    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("writes a setting delete sync event after a successful cloud delete", async () => {
    await deleteSettingFromCloud("journal_draft_new");

    expect(mocks.delete).toHaveBeenCalled();
    expect(mocks.match).toHaveBeenCalledWith({
      user_id: "user-1",
      key: "journal_draft_new",
    });
    expect(mocks.writeEventAndBroadcast).toHaveBeenCalledWith(
      "setting",
      "journal_draft_new",
      "delete",
      expect.objectContaining({
        key: "journal_draft_new",
        deletedAt: expect.any(String),
      }),
      "device-1"
    );
  });

  it("queues setting deletes while offline instead of writing partial cloud state", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await deleteSettingFromCloud("journal_draft_new");

    expect(mocks.enqueue).toHaveBeenCalledWith("DELETE_SETTINGS", "journal_draft_new", {
      key: "journal_draft_new",
    });
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("does not delete local-only settings from the account channel", async () => {
    await deleteSettingFromCloud("sync-cursor-v2");

    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });
});
