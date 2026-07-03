import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const deleteBuilder = {} as { eq: ReturnType<typeof vi.fn> };
  deleteBuilder.eq = vi.fn(() => deleteBuilder);

  return {
    deleteBuilder,
    deleteFn: vi.fn(() => deleteBuilder),
    from: vi.fn(),
    getCurrentUserId: vi.fn(),
    getInfo: vi.fn(),
    upsert: vi.fn(),
  };
});

vi.mock("@/lib/platform", () => ({
  isNative: true,
  isAndroid: true,
}));

vi.mock("@capacitor/app", () => ({
  App: {
    getInfo: mocks.getInfo,
  },
}));

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    register: vi.fn(),
    addListener: vi.fn(),
  },
}));

vi.mock("../logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../supabaseClient", () => ({
  supabase: {
    from: mocks.from,
    auth: { getSession: vi.fn() },
  },
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/lib/env", () => ({
  SUPABASE_URL: "https://example.supabase.co",
}));

import { removePushToken, savePushToken } from "../pushNotifications";

const PUSH_INSTALL_ID_KEY = "zenflow_push_install_id";
const PUSH_TOKEN_KEY = "zenflow_push_token";

describe("push notification token lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.getInfo.mockResolvedValue({ id: "com.zenflow.app", build: "42" });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({
      upsert: mocks.upsert,
      delete: mocks.deleteFn,
    });
  });

  it("saves the current push token with a per-install id rather than the native app build id", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");

    await savePushToken("token-a");

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        token: "token-a",
        device_id: "install-a",
      }),
      { onConflict: "user_id,token" },
    );
    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBe("token-a");
  });

  it("removes only the current push token when consent is revoked", async () => {
    localStorage.setItem(PUSH_TOKEN_KEY, "token-a");

    await removePushToken();

    expect(mocks.deleteBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mocks.deleteBuilder.eq).toHaveBeenCalledWith("token", "token-a");
    expect(mocks.deleteBuilder.eq).not.toHaveBeenCalledWith("device_id", expect.any(String));
    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBeNull();
  });
});
