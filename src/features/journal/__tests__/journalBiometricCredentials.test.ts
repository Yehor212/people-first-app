import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: "web",
  enroll: vi.fn(),
  unenroll: vi.fn(),
}));

vi.mock("@/lib/platform", () => ({
  get isNative() {
    return mocks.platform === "android" || mocks.platform === "ios";
  },
}));

vi.mock("@/plugins/BiometricPlugin", () => ({
  default: {
    enroll: mocks.enroll,
    unenroll: mocks.unenroll,
  },
}));

import {
  clearNativeJournalBiometricCredential,
  enrollNativeJournalBiometricCredential,
} from "@/lib/journalBiometricCredentials";

describe("journal biometric credential account-boundary cleanup", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.platform = "web";
    mocks.enroll.mockResolvedValue({ success: true });
    mocks.unenroll.mockResolvedValue({ success: true });
  });

  it.each(["android", "ios"] as const)(
    "removes the app-level journal vault credential on %s",
    async (nativePlatform) => {
      mocks.platform = nativePlatform;

      await expect(clearNativeJournalBiometricCredential()).resolves.toBe("removed");

      expect(mocks.unenroll).toHaveBeenCalledTimes(1);
    }
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
        "credential delete failed"
      );
    }
  );

  it("fails within the caller deadline while retaining the late bridge operation", async () => {
    vi.useFakeTimers();
    mocks.platform = "ios";
    let resolveUnenroll!: (value: { success: true }) => void;
    mocks.unenroll.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUnenroll = resolve;
        })
    );

    const cleanup = clearNativeJournalBiometricCredential(1_000);
    const cleanupOutcome = expect(cleanup).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(1_000);

    await cleanupOutcome;
    resolveUnenroll({ success: true });
    await Promise.resolve();
    expect(mocks.unenroll).toHaveBeenCalledTimes(1);
  });

  it("rejects enrollment promptly while a timed-out native cleanup remains unsettled", async () => {
    vi.useFakeTimers();
    mocks.platform = "ios";
    let resolveUnenroll!: (value: { success: true }) => void;
    mocks.unenroll.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUnenroll = resolve;
        })
    );
    const cleanup = clearNativeJournalBiometricCredential(1_000);
    const cleanupOutcome = expect(cleanup).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(1_000);
    await cleanupOutcome;
    const enrollment = enrollNativeJournalBiometricCredential(
      {
        reason: "Enable biometric diary unlock",
        secret: "old-vault-secret",
      },
      async () => undefined
    );

    expect(mocks.enroll).not.toHaveBeenCalled();
    await expect(enrollment).rejects.toThrow(/lane is waiting/i);
    resolveUnenroll({ success: true });
    await Promise.resolve();
    expect(mocks.enroll).not.toHaveBeenCalled();
  });

  it("does not queue a vault secret behind cleanup before its deadline expires", async () => {
    vi.useFakeTimers();
    mocks.platform = "android";
    let resolveUnenroll!: (value: { success: true }) => void;
    mocks.unenroll.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUnenroll = resolve;
        })
    );

    const cleanup = clearNativeJournalBiometricCredential(1_000);
    const cleanupOutcome = expect(cleanup).rejects.toThrow(/timed out/i);
    const enrollment = enrollNativeJournalBiometricCredential(
      {
        reason: "Enable biometric diary unlock",
        secret: "must-not-be-queued",
      },
      async () => undefined
    );

    await expect(enrollment).rejects.toThrow(/lane is waiting/i);
    expect(mocks.enroll).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    await cleanupOutcome;
    resolveUnenroll({ success: true });
    await Promise.resolve();
  });

  it("compensates an enrollment that loses its protection boundary before acknowledgement", async () => {
    mocks.platform = "ios";
    let releaseEnroll!: () => void;
    let enrollmentCurrent = true;
    mocks.enroll.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseEnroll = () => resolve({ success: true });
        })
    );
    const assertCurrent = vi.fn(async () => {
      if (!enrollmentCurrent) throw new Error("diary removal won the race");
    });

    const enrollment = enrollNativeJournalBiometricCredential(
      {
        reason: "Enable biometric diary unlock",
        secret: "old-vault-secret",
      },
      assertCurrent
    );
    await vi.waitFor(() => expect(mocks.enroll).toHaveBeenCalledTimes(1));
    enrollmentCurrent = false;
    const cleanup = clearNativeJournalBiometricCredential();
    releaseEnroll();

    await expect(enrollment).rejects.toThrow(/diary removal won the race/i);
    await expect(cleanup).resolves.toBe("removed");
    expect(mocks.unenroll).toHaveBeenCalledTimes(2);
    expect(assertCurrent).toHaveBeenCalledTimes(2);
  });

  it("compensates before releasing the mutex when durable enrollment acknowledgement fails", async () => {
    mocks.platform = "android";
    const commitEnrollment = vi.fn(async () => {
      throw new Error("diary removal committed before biometric acknowledgement");
    });

    await expect(
      enrollNativeJournalBiometricCredential(
        {
          reason: "Enable biometric diary unlock",
          secret: "old-vault-secret",
        },
        async () => undefined,
        commitEnrollment
      )
    ).rejects.toThrow(/removal committed/i);

    expect(commitEnrollment).toHaveBeenCalledTimes(1);
    expect(mocks.unenroll).toHaveBeenCalledTimes(1);
  });
});
