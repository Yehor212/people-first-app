import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const deleteBuilder = {} as { eq: ReturnType<typeof vi.fn> };
  deleteBuilder.eq = vi.fn(() => deleteBuilder);

  return {
    deleteBuilder,
    deleteResponse: { value: { error: null as { message: string } | null } },
    deleteFn: vi.fn(() => deleteBuilder),
    from: vi.fn(),
    addListener: vi.fn(),
    checkPermissions: vi.fn(),
    getCurrentUserId: vi.fn(),
    getInfo: vi.fn(),
    register: vi.fn(),
    requestPermissions: vi.fn(),
    unregister: vi.fn(),
    upsert: vi.fn(),
    rpc: vi.fn(),
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
    checkPermissions: mocks.checkPermissions,
    requestPermissions: mocks.requestPermissions,
    register: mocks.register,
    unregister: mocks.unregister,
    addListener: mocks.addListener,
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
    rpc: mocks.rpc,
    auth: { getSession: vi.fn() },
  },
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/lib/env", () => ({
  SUPABASE_URL: "https://example.supabase.co",
}));

import {
  initializePushNotifications,
  removePushToken,
  revokePushForAccountBoundary,
  savePushToken,
} from "../pushNotifications";

const PUSH_INSTALL_ID_KEY = "zenflow_push_install_id";
const PUSH_TOKEN_KEY = "zenflow_push_token";

describe("push notification token lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.getInfo.mockResolvedValue({ id: "com.zenflow.app", build: "42" });
    mocks.checkPermissions.mockResolvedValue({ receive: "granted" });
    mocks.requestPermissions.mockResolvedValue({ receive: "granted" });
    mocks.register.mockResolvedValue(undefined);
    mocks.unregister.mockResolvedValue(undefined);
    mocks.addListener.mockResolvedValue({ remove: vi.fn() });
    mocks.deleteResponse.value = { error: null };
    mocks.deleteBuilder.eq.mockImplementation((column: string) =>
      column === "user_id" ? mocks.deleteBuilder : Promise.resolve(mocks.deleteResponse.value)
    );
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: "claimed-id", error: null });
    mocks.from.mockReturnValue({
      upsert: mocks.upsert,
      delete: mocks.deleteFn,
    });
  });

  it("saves the current push token with a per-install id rather than the native app build id", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");

    await savePushToken("token-a");

    expect(mocks.rpc).toHaveBeenCalledWith("claim_push_install", {
      p_token: "token-a",
      p_device_id: "install-a",
      p_platform: "android",
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBe("token-a");
  });

  it("removes every rotated token for the current install when consent is revoked", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
    localStorage.setItem(PUSH_TOKEN_KEY, "token-a");

    const result = await removePushToken();

    expect(mocks.rpc).toHaveBeenCalledWith("revoke_push_install", {
      p_device_id: "install-a",
      p_token: "token-a",
    });
    expect(mocks.deleteBuilder.eq).not.toHaveBeenCalled();
    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(PUSH_INSTALL_ID_KEY)).toBeNull();
    expect(mocks.unregister).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: "revoked",
      remote: "deleted",
      native: "unregistered",
    });
  });

  it("returns a partial result and keeps the token for retry when remote deletion fails", async () => {
    localStorage.setItem(PUSH_TOKEN_KEY, "token-a");
    mocks.deleteResponse.value = { error: { message: "permission denied" } };

    const result = await removePushToken();

    expect(result).toEqual({
      status: "partial",
      remote: "failed",
      native: "unregistered",
    });
    expect(mocks.unregister).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBe("token-a");
  });

  it("revokes account A by unguessable install id after a direct switch before B can claim it", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
    localStorage.setItem(PUSH_TOKEN_KEY, "token-a");
    mocks.getCurrentUserId.mockResolvedValue("user-b");

    const result = await revokePushForAccountBoundary("user-a");

    expect(mocks.rpc).toHaveBeenCalledWith("revoke_push_install", {
      p_device_id: "install-a",
      p_token: "token-a",
    });
    expect(mocks.unregister).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: "revoked",
      remote: "deleted",
      native: "unregistered",
    });
  });

  it("does not register after consent revocation wins an in-flight permission request", async () => {
    let resolvePermission!: (value: { receive: "granted" }) => void;
    mocks.checkPermissions.mockResolvedValueOnce({ receive: "prompt" });
    mocks.requestPermissions.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePermission = resolve;
      }),
    );

    const initialization = initializePushNotifications();
    await Promise.resolve();
    await removePushToken();
    resolvePermission({ receive: "granted" });
    await initialization;

    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("re-registers only after an in-flight revocation when enable is the newest intent", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
    localStorage.setItem(PUSH_TOKEN_KEY, "token-a");
    let resolveRemoteDeletion!: (value: { error: null }) => void;
    mocks.rpc.mockImplementation((functionName: string) => {
      if (functionName !== "revoke_push_install") {
        return Promise.resolve({ data: "claimed-id", error: null });
      }
      return new Promise<{ error: null }>((resolve) => {
        resolveRemoteDeletion = resolve;
      });
    });

    const revocation = removePushToken();
    while (mocks.rpc.mock.calls.length < 1) await Promise.resolve();

    const reenable = initializePushNotifications();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.register).not.toHaveBeenCalled();

    resolveRemoteDeletion({ error: null });
    await Promise.all([revocation, reenable]);

    expect(mocks.unregister).toHaveBeenCalledTimes(1);
    expect(mocks.register).toHaveBeenCalledTimes(1);
    expect(mocks.unregister.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.register.mock.invocationCallOrder[0],
    );
  });

  it("keeps re-enabled registration as the final native action when an older register settles late", async () => {
    let resolveOlderRegistration!: () => void;
    mocks.register
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveOlderRegistration = resolve;
          }),
      )
      .mockResolvedValueOnce(undefined);

    const olderInitialization = initializePushNotifications();
    while (mocks.register.mock.calls.length < 1) await Promise.resolve();

    await removePushToken();
    const reenable = initializePushNotifications();
    await new Promise((resolve) => setTimeout(resolve, 0));

    resolveOlderRegistration();
    await Promise.all([olderInitialization, reenable]);

    expect(mocks.register).toHaveBeenCalledTimes(2);
    expect(mocks.unregister).toHaveBeenCalledTimes(2);
    const finalRegisterOrder = mocks.register.mock.invocationCallOrder.at(-1);
    const finalUnregisterOrder = mocks.unregister.mock.invocationCallOrder.at(-1);
    expect(finalRegisterOrder).toBeDefined();
    expect(finalUnregisterOrder).toBeDefined();
    expect(finalUnregisterOrder!).toBeLessThan(finalRegisterOrder!);
  });

  it("rejects a late token callback from a revoked registration generation", async () => {
    let registrationListener: ((token: { value: string }) => Promise<void>) | undefined;
    mocks.addListener.mockImplementation((eventName: string, listener: unknown) => {
      if (eventName === "registration") {
        registrationListener = listener as (token: { value: string }) => Promise<void>;
      }
      return Promise.resolve({ remove: vi.fn() });
    });

    await initializePushNotifications();
    await removePushToken();
    await registrationListener?.({ value: "late-token" });

    expect(mocks.rpc).not.toHaveBeenCalledWith(
      "claim_push_install",
      expect.anything(),
    );
    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBeNull();
  });

  it("keeps the newest token when rotation callbacks overlap", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
    let resolveOldSave!: (value: { data?: number; error: null }) => void;
    mocks.rpc
      .mockImplementationOnce(
        (functionName: string) =>
          new Promise<{ data?: number; error: null }>((resolve) => {
            if (functionName === "claim_push_install") {
              resolveOldSave = resolve;
            } else {
              resolve({ data: 1, error: null });
            }
          }),
      )
      .mockResolvedValueOnce({ data: "claimed-id", error: null });

    const oldSave = savePushToken("token-old");
    while (mocks.rpc.mock.calls.length === 0) await Promise.resolve();
    const newSave = savePushToken("token-new");
    for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
    resolveOldSave({ error: null });
    await Promise.all([oldSave, newSave]);

    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBe("token-new");
    expect(mocks.rpc).toHaveBeenLastCalledWith("claim_push_install", {
      p_token: "token-new",
      p_device_id: "install-a",
      p_platform: "android",
    });
  });
});
