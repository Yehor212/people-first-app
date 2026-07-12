import { beforeEach, describe, expect, it, vi } from "vitest";

const widgetMock = vi.hoisted(() => ({ clearAccountData: vi.fn() }));
const cacheMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/platform", () => ({ isNative: true }));
vi.mock("@/plugins/WidgetPlugin", () => ({ default: widgetMock }));
vi.mock("@/lib/shareActions", () => ({ cleanupAllAccountCacheFiles: cacheMock }));

import { clearAccountDeviceSurfaces } from "../accountDeviceCleanup";

describe("clearAccountDeviceSurfaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    widgetMock.clearAccountData.mockResolvedValue(undefined);
    cacheMock.mockResolvedValue(undefined);
  });

  it("clears widget state and account-owned cache artifacts", async () => {
    await clearAccountDeviceSurfaces();

    expect(widgetMock.clearAccountData).toHaveBeenCalledOnce();
    expect(cacheMock).toHaveBeenCalledOnce();
  });

  it("fails closed when either native surface cannot be cleared", async () => {
    widgetMock.clearAccountData.mockRejectedValue(new Error("widget cleanup failed"));

    await expect(clearAccountDeviceSurfaces()).rejects.toThrow("widget cleanup failed");
    expect(cacheMock).toHaveBeenCalledOnce();
  });
});
