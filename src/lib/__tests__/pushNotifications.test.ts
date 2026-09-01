import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const deleteBuilder = {} as { eq: ReturnType<typeof vi.fn> };
  deleteBuilder.eq = vi.fn(() => deleteBuilder);
  const localOwner: { value: string | null } = { value: "user-1" };
  const claimStatus: {
    value: "none" | "pending" | "invalid" | "unavailable";
  } = { value: "none" };

  return {
    deleteBuilder,
    deleteResponse: { value: { error: null as { message: string } | null } },
    deleteFn: vi.fn(() => deleteBuilder),
    from: vi.fn(),
    addListener: vi.fn(),
    checkPermissions: vi.fn(),
    getCurrentChannelId: vi.fn(),
    getCurrentUserId: vi.fn(),
    getSession: vi.fn(),
    getInfo: vi.fn(),
    register: vi.fn(),
    requestPermissions: vi.fn(),
    unregister: vi.fn(),
    activateNativePushRealm: vi.fn(),
    suspendNativePushRealm: vi.fn(),
    updateNativePushPresentation: vi.fn(),
    upsert: vi.fn(),
    rpc: vi.fn(),
    getLocalDataOwnerId: vi.fn(),
    localOwner,
    claimStatus,
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

vi.mock("../nativePushRealm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../nativePushRealm")>();
  return {
    ...actual,
    activateNativePushRealm: mocks.activateNativePushRealm,
    suspendNativePushRealm: mocks.suspendNativePushRealm,
    updateNativePushPresentation: mocks.updateNativePushPresentation,
  };
});

vi.mock("../notificationSounds", () => ({
  getCurrentChannelId: mocks.getCurrentChannelId,
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
    auth: { getSession: mocks.getSession },
  },
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/lib/env", () => ({
  SUPABASE_URL: "https://example.supabase.co",
}));

vi.mock("@/storage/db", () => ({
  getLocalDataOwnerId: mocks.getLocalDataOwnerId,
}));

vi.mock("@/storage/accountBoundaryRuntime", () => ({
  readPendingLocalBackupAccountClaim: vi.fn(() => ({ status: mocks.claimStatus.value })),
}));

import {
  cancelPendingPushRegistration,
  initializePushNotifications,
  readPushRegistrationEvidence,
  removePushToken,
  revokePushForAccountBoundary,
  savePushToken,
  sendTestPush,
} from "../pushNotifications";

const PUSH_INSTALL_ID_KEY = "zenflow_push_install_id";
const PUSH_TOKEN_KEY = "zenflow_push_token";
const CLAIM_INSTALLATION_ID = "9d38b63d-59e0-4a70-9ec6-91db88bd7074";

describe("push notification token lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.getCurrentChannelId.mockReturnValue("zenflow_default_v4");
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "test-session-access-token" } },
    });
    mocks.localOwner.value = "user-1";
    mocks.claimStatus.value = "none";
    mocks.getLocalDataOwnerId.mockImplementation(async () => mocks.localOwner.value);
    mocks.getInfo.mockResolvedValue({ id: "com.zenflow.app", build: "42" });
    mocks.checkPermissions.mockResolvedValue({ receive: "granted" });
    mocks.requestPermissions.mockResolvedValue({ receive: "granted" });
    mocks.register.mockResolvedValue(undefined);
    mocks.unregister.mockResolvedValue(undefined);
    mocks.activateNativePushRealm.mockResolvedValue(undefined);
    mocks.suspendNativePushRealm.mockResolvedValue(undefined);
    mocks.updateNativePushPresentation.mockResolvedValue(undefined);
    mocks.addListener.mockResolvedValue({ remove: vi.fn() });
    mocks.deleteResponse.value = { error: null };
    mocks.deleteBuilder.eq.mockImplementation((column: string) =>
      column === "user_id" ? mocks.deleteBuilder : Promise.resolve(mocks.deleteResponse.value)
    );
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.rpc.mockImplementation((functionName: string) =>
      Promise.resolve(
        functionName === "revoke_push_install"
          ? { data: 1, error: null }
          : { data: CLAIM_INSTALLATION_ID, error: null },
      ),
    );
    mocks.from.mockReturnValue({
      upsert: mocks.upsert,
      delete: mocks.deleteFn,
    });
  });

  it("reports absent registration evidence on a clean install", () => {
    expect(readPushRegistrationEvidence()).toBe("absent");
  });

  it.each([
    [PUSH_TOKEN_KEY, "token-a"],
    [PUSH_INSTALL_ID_KEY, "install-a"],
  ])("reports present registration evidence from %s", (key, value) => {
    localStorage.setItem(key, value);

    expect(readPushRegistrationEvidence()).toBe("present");
  });

  it("fails closed when registration storage cannot be read", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    try {
      expect(readPushRegistrationEvidence()).toBe("unavailable");
    } finally {
      getItem.mockRestore();
    }
  });

  it("saves the current push token with a per-install id rather than the native app build id", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");

    await savePushToken("token-a");

    expect(mocks.rpc).toHaveBeenCalledWith("claim_push_install", {
      p_token: "token-a",
      p_device_id: "install-a",
      p_platform: "android",
      p_expected_owner_user_id: "user-1",
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBe("token-a");
    expect(mocks.activateNativePushRealm).toHaveBeenCalledWith({
      installationId: CLAIM_INSTALLATION_ID,
      language: "en",
      channelId: "zenflow_default_v4",
    });
  });

  it.each([null, "", "claimed-id", "9D38B63D-59E0-4A70-9EC6-91DB88BD7074"])(
    "rejects a non-canonical claim result %s and revokes the owner-bound claim",
    async (claimResult) => {
      localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
      mocks.rpc.mockResolvedValueOnce({ data: claimResult, error: null });

      await expect(savePushToken("token-a")).resolves.toBe(false);

      expect(mocks.activateNativePushRealm).not.toHaveBeenCalled();
      expect(mocks.suspendNativePushRealm).toHaveBeenCalledTimes(1);
      expect(mocks.rpc).toHaveBeenNthCalledWith(2, "revoke_push_install", {
        p_device_id: "install-a",
        p_expected_owner_user_id: "user-1",
        p_token: "token-a",
      });
      expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBeNull();
    },
  );

  it("activates the exact claim with the current allowlisted language and channel", async () => {
    const versionSevenClaim = "018f8b2d-7ea8-7d38-9b92-61fbb5ce3f29";
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
    localStorage.setItem("zenflow-language", "uk");
    mocks.getCurrentChannelId.mockReturnValue("zenflow_gentle_v4");
    mocks.rpc.mockResolvedValueOnce({ data: versionSevenClaim, error: null });

    await expect(savePushToken("token-a")).resolves.toBe(true);

    expect(mocks.activateNativePushRealm).toHaveBeenCalledWith({
      installationId: versionSevenClaim,
      language: "uk",
      channelId: "zenflow_gentle_v4",
    });
  });

  it("suspends the native realm before rolling back a failed activation", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
    const order: string[] = [];
    mocks.activateNativePushRealm.mockImplementationOnce(async () => {
      order.push("activate");
      throw new Error("native realm unavailable");
    });
    mocks.suspendNativePushRealm.mockImplementationOnce(async () => {
      order.push("suspend");
    });
    mocks.rpc.mockImplementation(async (functionName: string) => {
      if (functionName === "claim_push_install") {
        order.push("claim");
        return { data: CLAIM_INSTALLATION_ID, error: null };
      }
      order.push("revoke");
      return { data: 1, error: null };
    });

    await expect(savePushToken("token-a")).resolves.toBe(false);

    expect(order).toEqual(["claim", "activate", "suspend", "revoke"]);
    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBeNull();
  });

  it("keeps the token retryable when rollback reports that no claimed row was removed", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
    mocks.activateNativePushRealm.mockRejectedValueOnce(
      new Error("native realm unavailable"),
    );
    mocks.rpc
      .mockResolvedValueOnce({ data: CLAIM_INSTALLATION_ID, error: null })
      .mockResolvedValueOnce({ data: 0, error: null });

    await expect(savePushToken("token-a")).resolves.toBe(false);

    expect(mocks.suspendNativePushRealm).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBe("token-a");
  });

  it.each(["pending", "invalid", "unavailable"] as const)(
    "does not register or claim a push installation while backup claim is %s",
    async (status) => {
      mocks.claimStatus.value = status;

      await initializePushNotifications();
      await savePushToken("blocked-token");

      expect(mocks.register).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalledWith("claim_push_install", expect.anything());
      expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBeNull();
    },
  );

  it.each([null, "user-2"])(
    "does not register or claim a push installation when local owner is %s",
    async (owner) => {
      mocks.localOwner.value = owner;

      await initializePushNotifications();
      await savePushToken("blocked-token");

      expect(mocks.register).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalledWith("claim_push_install", expect.anything());
    },
  );

  it("rechecks ownership after resolving the install id and before claiming it", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    let ownerReads = 0;
    mocks.getLocalDataOwnerId.mockImplementation(async () => {
      ownerReads += 1;
      return ownerReads === 1 ? "user-1" : "user-2";
    });

    await savePushToken("blocked-token");

    expect(mocks.rpc).not.toHaveBeenCalledWith("claim_push_install", expect.anything());
    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBeNull();
  });

  it("does not register after ownership changes during the permission request", async () => {
    let resolvePermission!: (value: { receive: "granted" }) => void;
    mocks.checkPermissions.mockResolvedValueOnce({ receive: "prompt" });
    mocks.requestPermissions.mockReturnValueOnce(
      new Promise((resolve) => { resolvePermission = resolve; })
    );

    const initialization = initializePushNotifications();
    while (mocks.requestPermissions.mock.calls.length === 0) await Promise.resolve();
    mocks.localOwner.value = "user-2";
    mocks.getCurrentUserId.mockResolvedValue("user-2");
    resolvePermission({ receive: "granted" });
    await initialization;

    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("binds the server claim to account A and discards it when A changes to B during the RPC", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
    let resolveClaim!: (value: { data: string; error: null }) => void;
    mocks.rpc.mockImplementationOnce(
      () => new Promise((resolve) => { resolveClaim = resolve; })
    );

    const saving = savePushToken("token-a");
    while (mocks.rpc.mock.calls.length === 0) await Promise.resolve();
    expect(mocks.rpc).toHaveBeenCalledWith("claim_push_install", {
      p_token: "token-a",
      p_device_id: "install-a",
      p_platform: "android",
      p_expected_owner_user_id: "user-1",
    });

    mocks.localOwner.value = "user-2";
    mocks.getCurrentUserId.mockResolvedValue("user-2");
    resolveClaim({ data: CLAIM_INSTALLATION_ID, error: null });

    await expect(saving).resolves.toBe(false);
    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBeNull();
  });

  it("revokes a remote claim when the new token cannot be persisted locally", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key: string, value: string) {
        if (key === PUSH_TOKEN_KEY) {
          throw new DOMException("storage unavailable", "SecurityError");
        }
        return originalSetItem.call(this, key, value);
      });

    try {
      await expect(savePushToken("token-new")).resolves.toBe(false);

      expect(mocks.rpc).toHaveBeenNthCalledWith(1, "claim_push_install", {
        p_token: "token-new",
        p_device_id: "install-a",
        p_platform: "android",
        p_expected_owner_user_id: "user-1",
      });
      expect(mocks.rpc).toHaveBeenNthCalledWith(2, "revoke_push_install", {
        p_device_id: "install-a",
        p_expected_owner_user_id: "user-1",
        p_token: "token-new",
      });
    } finally {
      setItem.mockRestore();
    }
  });

  it("removes every rotated token for the current install when consent is revoked", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
    localStorage.setItem(PUSH_TOKEN_KEY, "token-a");

    const result = await removePushToken();

    expect(mocks.suspendNativePushRealm).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("revoke_push_install", {
      p_device_id: "install-a",
      p_expected_owner_user_id: "user-1",
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

  it("blocks remote cleanup and preserves retry identifiers when native suspension fails", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
    localStorage.setItem(PUSH_TOKEN_KEY, "token-a");
    mocks.suspendNativePushRealm.mockRejectedValueOnce(
      new Error("native realm could not be suspended"),
    );

    const result = await revokePushForAccountBoundary("user-1");

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.unregister).not.toHaveBeenCalled();
    expect(localStorage.getItem(PUSH_INSTALL_ID_KEY)).toBe("install-a");
    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBe("token-a");
    expect(result).toEqual({
      status: "partial",
      remote: "failed",
      native: "failed",
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

  it("unregisters natively instead of claiming remote proof when boundary identifiers are absent", async () => {
    mocks.getCurrentUserId.mockResolvedValue("user-b");

    const result = await revokePushForAccountBoundary("user-a");

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.unregister).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: "partial",
      remote: "failed",
      native: "unregistered",
    });
  });

  it("fails closed when boundary identifiers are absent and native unregister fails", async () => {
    mocks.getCurrentUserId.mockResolvedValue("user-b");
    mocks.unregister.mockRejectedValueOnce(new Error("native unregister failed"));

    const first = await revokePushForAccountBoundary("user-a");

    expect(first).toEqual({
      status: "partial",
      remote: "failed",
      native: "failed",
    });

    mocks.unregister.mockResolvedValueOnce(undefined);
    const retry = await revokePushForAccountBoundary("user-a");
    expect(retry).toEqual({
      status: "partial",
      remote: "failed",
      native: "unregistered",
    });
  });

  it("fails closed on unreadable push storage unless native unregister succeeds", async () => {
    mocks.getCurrentUserId.mockResolvedValue("user-b");
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("storage unavailable", "SecurityError");
      });

    try {
      const result = await revokePushForAccountBoundary("user-a");

      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.unregister).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        status: "partial",
        remote: "failed",
        native: "unregistered",
      });
    } finally {
      getItem.mockRestore();
    }
  });

  it("revokes account A by unguessable install id after a direct switch before B can claim it", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
    localStorage.setItem(PUSH_TOKEN_KEY, "token-a");
    mocks.getCurrentUserId.mockResolvedValue("user-b");

    const result = await revokePushForAccountBoundary("user-a");

    expect(mocks.rpc).toHaveBeenCalledWith("revoke_push_install", {
      p_device_id: "install-a",
      p_expected_owner_user_id: "user-a",
      p_token: "token-a",
    });
    expect(mocks.unregister).not.toHaveBeenCalled();
    expect(localStorage.getItem(PUSH_INSTALL_ID_KEY)).toBe("install-a");
    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBe("token-a");
    expect(result).toEqual({
      status: "revoked",
      remote: "deleted",
      native: "owner-changed",
    });
  });

  it("preserves account B when B claims the same native installation while account A revocation is in flight", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
    localStorage.setItem(PUSH_TOKEN_KEY, "token-a");

    let remoteOwner: string | null = "user-a";
    let nativeOwner: string | null = "user-a";
    mocks.getCurrentUserId.mockResolvedValueOnce("user-a");
    mocks.rpc.mockImplementationOnce(
      async (
        functionName: string,
        args: {
          p_device_id: string;
          p_expected_owner_user_id?: string;
          p_token: string | null;
        },
      ) => {
        expect(functionName).toBe("revoke_push_install");

        // Exact failure interleaving: A passed its client-side owner check, then
        // B signed in and atomically claimed the same FCM token/installation.
        remoteOwner = "user-b";
        nativeOwner = "user-b";
        mocks.getCurrentUserId.mockResolvedValue("user-b");

        if (args.p_expected_owner_user_id === remoteOwner) {
          remoteOwner = null;
          return { data: 1, error: null };
        }
        return { data: 0, error: null };
      },
    );
    mocks.unregister.mockImplementationOnce(async () => {
      nativeOwner = null;
    });

    const result = await revokePushForAccountBoundary("user-a");

    expect(mocks.rpc).toHaveBeenCalledWith("revoke_push_install", {
      p_device_id: "install-a",
      p_expected_owner_user_id: "user-a",
      p_token: "token-a",
    });
    expect(remoteOwner).toBe("user-b");
    expect(nativeOwner).toBe("user-b");
    expect(mocks.unregister).not.toHaveBeenCalled();
    expect(localStorage.getItem(PUSH_INSTALL_ID_KEY)).toBe("install-a");
    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toBe("token-a");
    expect(result).toEqual({
      status: "revoked",
      remote: "not-registered",
      native: "owner-changed",
    });
  });

  it("forces native revocation when account A still owns the installation with a rotated token", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
    localStorage.setItem(PUSH_TOKEN_KEY, "token-old");
    mocks.getCurrentUserId.mockResolvedValue("user-b");
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Push installation token changed" },
    });

    const result = await revokePushForAccountBoundary("user-a");

    expect(mocks.rpc).toHaveBeenCalledWith("revoke_push_install", {
      p_device_id: "install-a",
      p_expected_owner_user_id: "user-a",
      p_token: "token-old",
    });
    expect(mocks.unregister).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: "partial",
      remote: "failed",
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

  it("cancels an in-flight clean-start registration without starting remote cleanup", async () => {
    let resolvePermission!: (value: { receive: "granted" }) => void;
    mocks.checkPermissions.mockResolvedValueOnce({ receive: "prompt" });
    mocks.requestPermissions.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePermission = resolve;
      }),
    );

    const initialization = initializePushNotifications();
    await Promise.resolve();
    cancelPendingPushRegistration();
    resolvePermission({ receive: "granted" });
    await initialization;

    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalledWith(
      "revoke_push_install",
      expect.any(Object),
    );
  });

  it("re-registers only after an in-flight revocation when enable is the newest intent", async () => {
    localStorage.setItem(PUSH_INSTALL_ID_KEY, "install-a");
    localStorage.setItem(PUSH_TOKEN_KEY, "token-a");
    let resolveRemoteDeletion!: (value: { error: null }) => void;
    mocks.rpc.mockImplementation((functionName: string) => {
      if (functionName !== "revoke_push_install") {
        return Promise.resolve({ data: CLAIM_INSTALLATION_ID, error: null });
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
      .mockResolvedValueOnce({ data: CLAIM_INSTALLATION_ID, error: null });

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
      p_expected_owner_user_id: "user-1",
    });
  });

  it("removes every previous listener handle before installing a new listener set", async () => {
    const firstRemovers = Array.from({ length: 4 }, () => vi.fn().mockResolvedValue(undefined));
    const secondRemovers = Array.from({ length: 4 }, () => vi.fn().mockResolvedValue(undefined));
    let handleIndex = 0;
    mocks.addListener.mockImplementation(() => {
      const removers = handleIndex < 4 ? firstRemovers : secondRemovers;
      const remove = removers[handleIndex % 4];
      handleIndex += 1;
      return Promise.resolve({ remove });
    });

    await initializePushNotifications();
    await initializePushNotifications();

    expect(firstRemovers.every((remove) => remove.mock.calls.length === 1)).toBe(true);
    expect(secondRemovers.every((remove) => remove.mock.calls.length === 0)).toBe(true);
    expect(mocks.addListener).toHaveBeenCalledTimes(8);
  });

  it("keeps the active listener set when replacement registration fails", async () => {
    const activeRemovers = Array.from({ length: 4 }, () => vi.fn().mockResolvedValue(undefined));
    const partialReplacementRemove = vi.fn().mockResolvedValue(undefined);
    let handleIndex = 0;
    mocks.addListener.mockImplementation(() => {
      handleIndex += 1;
      if (handleIndex <= 4) {
        return Promise.resolve({ remove: activeRemovers[handleIndex - 1] });
      }
      if (handleIndex === 5) {
        return Promise.resolve({ remove: partialReplacementRemove });
      }
      return Promise.reject(new Error("listener registration unavailable"));
    });

    await initializePushNotifications();
    await expect(initializePushNotifications()).rejects.toThrow(
      "listener registration unavailable",
    );

    expect(activeRemovers.every((remove) => remove.mock.calls.length === 0)).toBe(true);
    expect(partialReplacementRemove).toHaveBeenCalledTimes(1);
  });

  it("activates a complete replacement and retries only stale listener cleanup", async () => {
    const failedOldRemove = vi
      .fn()
      .mockRejectedValueOnce(new Error("listener removal interrupted"))
      .mockResolvedValue(undefined);
    const oldRemovers = [
      failedOldRemove,
      ...Array.from({ length: 3 }, () => vi.fn().mockResolvedValue(undefined)),
    ];
    const replacementRemovers = Array.from({ length: 4 }, () =>
      vi.fn().mockResolvedValue(undefined),
    );
    const finalRemovers = Array.from({ length: 4 }, () => vi.fn().mockResolvedValue(undefined));
    let handleIndex = 0;
    mocks.addListener.mockImplementation(() => {
      const removers =
        handleIndex < 4
          ? oldRemovers
          : handleIndex < 8
            ? replacementRemovers
            : finalRemovers;
      const remove = removers[handleIndex % 4];
      handleIndex += 1;
      return Promise.resolve({ remove });
    });

    await initializePushNotifications();
    await expect(initializePushNotifications()).resolves.toBeUndefined();
    await expect(initializePushNotifications()).resolves.toBeUndefined();

    expect(failedOldRemove).toHaveBeenCalledTimes(2);
    expect(oldRemovers.slice(1).every((remove) => remove.mock.calls.length === 1)).toBe(true);
    expect(replacementRemovers.every((remove) => remove.mock.calls.length === 1)).toBe(true);
    expect(finalRemovers.every((remove) => remove.mock.calls.length === 0)).toBe(true);
  });

  it("sends only the bounded test kind to the Edge function", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(sendTestPush()).resolves.toBe(true);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(typeof request.body).toBe("string");
      if (typeof request.body !== "string") {
        throw new Error("Expected a serialized test-push request body");
      }
      expect(JSON.parse(request.body)).toEqual({ type: "test" });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
