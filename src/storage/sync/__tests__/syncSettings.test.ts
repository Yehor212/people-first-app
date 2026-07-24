import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  match: vi.fn(),
  enqueue: vi.fn(),
  getPersistentDeviceId: vi.fn(),
  writeEventAndBroadcast: vi.fn(),
  supabase: null as { from: ReturnType<typeof vi.fn> } | null,
}));

vi.mock("@/lib/supabaseClient", () => ({
  get supabase() {
    return mocks.supabase;
  },
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
import { db } from "@/storage/db";
import { SK } from "@/lib/storageKeys";

describe("syncSettings", () => {
  beforeEach(async () => {
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
    mocks.supabase = { from: mocks.from };
    mocks.getPersistentDeviceId.mockResolvedValue("device-1");
    await db.settings.clear();
  });

  afterAll(() => {
    db.close();
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
      "device-1",
      { expectedOwnerUserId: "user-1" }
    );
  });

  it("refuses an owner-bound upsert when the active account changes before the mutation", async () => {
    mocks.getCurrentUserId.mockResolvedValueOnce("account-a").mockResolvedValueOnce("account-b");

    await expect(syncSetting("mood-reminder-enabled", true, "account-a")).rejects.toThrow(
      "account boundary"
    );

    expect(mocks.getCurrentUserId).toHaveBeenCalledTimes(2);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
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

    expect(mocks.enqueue).toHaveBeenCalledWith(
      "UPDATE_SETTINGS",
      "mood-reminder-enabled",
      {
        key: "mood-reminder-enabled",
        value: false,
      },
      {
        expectedOwnerUserId: "user-1",
      }
    );
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

  it("keeps ad and push consent on the device and removes a legacy cloud copy", async () => {
    localStorage.setItem(SK.PRIVACY, JSON.stringify({ adConsent: true, pushNotifications: true }));
    await syncSetting(SK.PRIVACY, {
      noTracking: false,
      analytics: false,
      consentShown: true,
      adConsent: true,
      pushNotifications: true,
    });

    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();

    await deleteSettingFromCloud(SK.PRIVACY, "user-1");
    expect(mocks.delete).toHaveBeenCalled();
    expect(mocks.match).toHaveBeenCalledWith({ user_id: "user-1", key: SK.PRIVACY });
    expect(localStorage.getItem(SK.PRIVACY)).toBe(
      JSON.stringify({ adConsent: true, pushNotifications: true })
    );
  });

  it("syncs the wrapped journal vault key so another device can recover encrypted diary data", async () => {
    const vaultSetting = {
      wrappedKey: "wrapped-key-fixture",
      createdAt: 1_781_580_000_000,
      updatedAt: 1_781_580_000_000,
    };
    await db.settings.bulkPut([
      { key: SK.JOURNAL_VAULT_KEY, value: vaultSetting },
      { key: SK.JOURNAL_VAULT_REVISION, value: vaultSetting.updatedAt },
    ]);

    await syncSetting("journal_vault_key", vaultSetting);

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

    const vaultSetting = {
      wrappedKey: "wrapped-key-fixture",
      createdAt: 1_781_580_000_000,
      updatedAt: 1_781_580_000_000,
    };
    await db.settings.bulkPut([
      { key: SK.JOURNAL_VAULT_KEY, value: vaultSetting },
      { key: SK.JOURNAL_VAULT_REVISION, value: vaultSetting.updatedAt },
    ]);

    await syncSetting("journal_vault_key", vaultSetting);

    expect(mocks.enqueue).toHaveBeenCalledWith(
      "UPDATE_SETTINGS",
      "journal_vault_key",
      {
        key: "journal_vault_key",
        value: vaultSetting,
      },
      {
        expectedOwnerUserId: "user-1",
      }
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("drops a stale queued vault upsert after local password removal", async () => {
    const removedVault = {
      wrappedKey: "removed-wrapped-key",
      createdAt: 100,
      updatedAt: 101,
    };
    await db.settings.put({ key: SK.JOURNAL_VAULT_REVISION, value: 101 });

    await syncSetting(SK.JOURNAL_VAULT_KEY, removedVault, "user-1");

    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("does not upload a vault while durable password removal is pending", async () => {
    const vaultSetting = {
      wrappedKey: "wrapped-key-raced-back",
      createdAt: 100,
      updatedAt: 101,
    };
    await db.settings.bulkPut([
      { key: SK.JOURNAL_VAULT_KEY, value: vaultSetting },
      { key: SK.JOURNAL_VAULT_REVISION, value: 101 },
      {
        key: SK.JOURNAL_SECURITY_REMOVAL,
        value: {
          version: 1,
          revision: "removal-1",
          ownerUserId: "user-1",
          createdAt: 102,
          status: "queued",
        },
      },
    ]);

    await syncSetting(SK.JOURNAL_VAULT_KEY, vaultSetting, "user-1");

    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("rechecks the active owner after validating the local vault state", async () => {
    const vaultSetting = {
      wrappedKey: "owner-a-wrapped-key",
      createdAt: 100,
      updatedAt: 101,
    };
    await db.settings.bulkPut([
      { key: SK.JOURNAL_VAULT_KEY, value: vaultSetting },
      { key: SK.JOURNAL_VAULT_REVISION, value: 101 },
    ]);
    mocks.getCurrentUserId.mockResolvedValueOnce("account-a").mockResolvedValueOnce("account-b");

    await expect(syncSetting(SK.JOURNAL_VAULT_KEY, vaultSetting, "account-a")).rejects.toThrow(
      "account boundary"
    );

    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("does not let a generic settings delete bypass the durable journal removal workflow", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await deleteSettingFromCloud("journal_vault_key");

    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("keeps the durable removal intent when its authorized vault delete is offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    await db.settings.bulkPut([
      { key: SK.JOURNAL_VAULT_REVISION, value: 101 },
      {
        key: SK.JOURNAL_SECURITY_REMOVAL,
        value: {
          version: 1,
          revision: "remove-101",
          ownerUserId: "user-1",
          createdAt: 102,
          status: "queued",
        },
      },
    ]);

    await expect(
      deleteSettingFromCloud(SK.JOURNAL_VAULT_KEY, "user-1", {
        journalSecurityRemovalRevision: "remove-101",
        queueOnNetworkError: false,
      })
    ).rejects.toThrow(/online.*removal/i);

    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
    await expect(db.settings.get(SK.JOURNAL_SECURITY_REMOVAL)).resolves.toBeDefined();
  });

  it("allows the exact owner-bound removal intent to delete the remote vault online", async () => {
    await db.settings.bulkPut([
      { key: SK.JOURNAL_VAULT_REVISION, value: 101 },
      {
        key: SK.JOURNAL_SECURITY_REMOVAL,
        value: {
          version: 1,
          revision: "remove-online-101",
          ownerUserId: "user-1",
          createdAt: 102,
          status: "queued",
        },
      },
    ]);

    await deleteSettingFromCloud(SK.JOURNAL_VAULT_KEY, "user-1", {
      journalSecurityRemovalRevision: "remove-online-101",
      queueOnNetworkError: false,
    });

    expect(mocks.delete).toHaveBeenCalled();
    expect(mocks.match).toHaveBeenCalledWith({
      user_id: "user-1",
      key: SK.JOURNAL_VAULT_KEY,
    });
    expect(mocks.writeEventAndBroadcast).toHaveBeenCalledWith(
      "setting",
      SK.JOURNAL_VAULT_KEY,
      "delete",
      expect.objectContaining({ key: SK.JOURNAL_VAULT_KEY }),
      "device-1",
      { expectedOwnerUserId: "user-1" }
    );
  });

  it("fails closed when an authorized vault removal has no Supabase client", async () => {
    await db.settings.put({
      key: SK.JOURNAL_SECURITY_REMOVAL,
      value: {
        version: 1,
        revision: "remove-without-client",
        ownerUserId: "user-1",
        createdAt: 102,
        status: "queued",
      },
    });
    mocks.supabase = null;

    await expect(
      deleteSettingFromCloud(SK.JOURNAL_VAULT_KEY, "user-1", {
        journalSecurityRemovalRevision: "remove-without-client",
        queueOnNetworkError: false,
      })
    ).rejects.toThrow(/Supabase.*unavailable/i);

    await expect(db.settings.get(SK.JOURNAL_SECURITY_REMOVAL)).resolves.toBeDefined();
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("fails closed for the durable vault migration step when Supabase is unavailable", async () => {
    const vaultSetting = {
      wrappedKey: "wrapped-without-client",
      createdAt: 100,
      updatedAt: 101,
    };
    await db.settings.bulkPut([
      { key: SK.JOURNAL_VAULT_KEY, value: vaultSetting },
      { key: SK.JOURNAL_VAULT_REVISION, value: 101 },
    ]);
    mocks.supabase = null;

    await expect(
      syncSetting(SK.JOURNAL_VAULT_KEY, vaultSetting, "user-1", {
        requireRemoteCommit: true,
      })
    ).rejects.toThrow(/Supabase.*unavailable/i);

    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
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
      "device-1",
      { expectedOwnerUserId: "user-1" }
    );
  });

  it("queues setting deletes while offline instead of writing partial cloud state", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await deleteSettingFromCloud("journal_draft_new");

    expect(mocks.enqueue).toHaveBeenCalledWith(
      "DELETE_SETTINGS",
      "journal_draft_new",
      {
        key: "journal_draft_new",
      },
      {
        expectedOwnerUserId: "user-1",
      }
    );
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
