import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: "web",
  unenroll: vi.fn(),
}));

vi.mock("@/lib/platform", () => ({
  get isNative() {
    return mocks.platform === "android" || mocks.platform === "ios";
  },
}));

vi.mock("@/plugins/BiometricPlugin", () => ({
  default: {
    unenroll: mocks.unenroll,
  },
}));

import { clearNativeJournalBiometricCredential } from "@/lib/journalBiometricCredentials";

describe("journal biometric credential account-boundary cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.platform = "web";
    mocks.unenroll.mockResolvedValue({ success: true });
  });

  it.each(["android", "ios"] as const)(
    "removes the app-level journal vault credential on %s",
    async (nativePlatform) => {
      mocks.platform = nativePlatform;

      await expect(clearNativeJournalBiometricCredential()).resolves.toBe("removed");

      expect(mocks.unenroll).toHaveBeenCalledTimes(1);
    },
  );

  it("does not load or call the native credential bridge on web", async () => {
    mocks.platform = "web";

    await expect(clearNativeJournalBiometricCredential()).resolves.toBe("not-native");

    expect(mocks.unenroll).not.toHaveBeenCalled();
  });

  it.each(["android", "ios"] as const)(
    "rejects the %s boundary when the native bridge cannot prove deletion",
    async (nativePlatform) => {
      mocks.platform = nativePlatform;
      mocks.unenroll.mockResolvedValue({
        success: false,
        error: "credential delete failed",
      });

      await expect(clearNativeJournalBiometricCredential()).rejects.toThrow(
        "credential delete failed",
      );
    },
  );
});
