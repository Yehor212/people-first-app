import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ isAndroid: true }));
const cancel = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const deleteChannel = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/platform", () => platform);
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: { cancel, deleteChannel },
}));

import { retireLegacyQuickActions } from "../legacyQuickActionsRetirement";
import { SK } from "../storageKeys";

describe("legacy Android Quick Actions retirement", () => {
  beforeEach(() => {
    localStorage.clear();
    platform.isAndroid = true;
    cancel.mockClear().mockResolvedValue(undefined);
    deleteChannel.mockClear().mockResolvedValue(undefined);
  });

  it("cancels the orphaned ongoing notification before removing its preference", async () => {
    localStorage.setItem(SK.QUICK_ACTIONS_ENABLED, "true");

    await expect(retireLegacyQuickActions()).resolves.toBe(true);

    expect(cancel).toHaveBeenCalledWith({ notifications: [{ id: 8888 }] });
    expect(deleteChannel).toHaveBeenCalledWith({ id: "zenflow_quick_actions" });
    expect(localStorage.getItem(SK.QUICK_ACTIONS_ENABLED)).toBeNull();
    expect(localStorage.getItem(SK.LEGACY_QUICK_ACTIONS_RETIREMENT)).toBe("complete");
  });

  it("retries later by preserving the flag when cancellation fails", async () => {
    localStorage.setItem(SK.QUICK_ACTIONS_ENABLED, "true");
    cancel.mockRejectedValueOnce(new Error("native failure"));

    await expect(retireLegacyQuickActions()).resolves.toBe(false);

    expect(localStorage.getItem(SK.QUICK_ACTIONS_ENABLED)).toBe("true");
    expect(deleteChannel).not.toHaveBeenCalled();
    expect(localStorage.getItem(SK.LEGACY_QUICK_ACTIONS_RETIREMENT)).toBeNull();
  });

  it("skips native cleanup after a previous successful retirement", async () => {
    localStorage.setItem(SK.LEGACY_QUICK_ACTIONS_RETIREMENT, "complete");

    await expect(retireLegacyQuickActions()).resolves.toBe(true);

    expect(cancel).not.toHaveBeenCalled();
    expect(deleteChannel).not.toHaveBeenCalled();
  });

  it("does nothing outside Android", async () => {
    platform.isAndroid = false;
    localStorage.setItem(SK.QUICK_ACTIONS_ENABLED, "true");

    await expect(retireLegacyQuickActions()).resolves.toBe(true);

    expect(cancel).not.toHaveBeenCalled();
    expect(localStorage.getItem(SK.QUICK_ACTIONS_ENABLED)).toBe("true");
  });
});
