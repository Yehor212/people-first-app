import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/platform", () => ({ isNative: true }));
vi.mock("../logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("../safeJson", () => ({
  safeLocalStorageGet: vi.fn((_key: string, fallback: unknown) => fallback),
  safeLocalStorageSet: vi.fn(() => true),
}));

import { crashReporting } from "@/lib/crashReporting";

const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

describe("native crash diagnostic privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps private log, Error, cause, context, and custom-key values out of native console sinks", () => {
    const diaryCanary = "ZF_T172_DIARY_7H2K9Q4M6P8R";
    const habitCanary = "ZF_T172_HABIT_4N8C2V7X5L3D";
    const authCanary = "ZF_T172_AUTH_9B6W3J8S2F5K";
    const identityCanary = "ZF_T172_IDENTITY_5M7R2Q9T4C8P";

    crashReporting.log(diaryCanary);
    const privateError = new Error(habitCanary) as Error & { cause?: unknown };
    privateError.cause = new Error(authCanary);
    crashReporting.recordError(
      privateError,
      { source: "react", userId: identityCanary },
    );
    crashReporting.setCustomKey("detail", diaryCanary);

    const serialized = JSON.stringify({
      log: consoleLog.mock.calls,
      error: consoleError.mock.calls,
    });
    for (const canary of [diaryCanary, habitCanary, authCanary, identityCanary]) {
      expect(serialized).not.toContain(canary);
    }
    expect(serialized).toContain("ZenFlow");
  });

  it("reports native retained-provider clearing as unsupported instead of a false success", () => {
    expect(crashReporting.clearRetainedReports()).toBe(false);
  });

  it("reports native provider enablement as unsupported with a fixed code", () => {
    crashReporting.setEnabled(true);

    expect(consoleLog).toHaveBeenCalledWith(
      "[ZenFlow Crash]",
      "ZF_CRASH_REPORTING_UNSUPPORTED",
    );
  });
});
