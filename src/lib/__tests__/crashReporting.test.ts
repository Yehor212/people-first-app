import { beforeEach, describe, expect, it, vi } from "vitest";

let mockLocalStorage: Record<string, unknown> = {};

vi.mock("@/lib/platform", () => ({ isNative: false }));
vi.mock("../logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("../safeJson", () => ({
  safeLocalStorageGet: vi.fn(<T>(key: string, defaultValue: T): T =>
    key in mockLocalStorage ? (mockLocalStorage[key] as T) : defaultValue,
  ),
  safeLocalStorageSet: vi.fn((key: string, value: unknown): boolean => {
    mockLocalStorage[key] = value;
    return true;
  }),
}));

import {
  CRASH_REPORT_RETENTION_MS,
  crashReporting,
  pruneRetainedCrashReports,
  recordError,
  withCrashReporting,
} from "@/lib/crashReporting";
import { logger } from "../logger";
import { safeLocalStorageSet } from "../safeJson";
import { SK } from "@/lib/storageKeys";

function retainedReport(index = 0, ageMs = 0) {
  return {
    code: "ZF_CRASH_RECORDED",
    errorName: "Error",
    stackFingerprint: "stack-present",
    context: { source: "react", count: index },
    time: new Date(Date.now() - ageMs).toISOString(),
  };
}

beforeEach(() => {
  mockLocalStorage = {};
  vi.clearAllMocks();
});

describe("crashReporting web boundary", () => {
  it("logs a fixed code instead of caller-provided text", () => {
    crashReporting.log("private message");
    expect(logger.log).toHaveBeenCalledWith("[Crash]");
  });

  it("emits fixed-code diagnostic metadata for an Error", () => {
    crashReporting.recordError(new Error("private message"));
    expect(logger.error).toHaveBeenCalledWith(
      "[Crash]",
      expect.objectContaining({
        code: "ZF_CRASH_RECORDED",
        errorName: "Error",
        stackFingerprint: expect.stringMatching(/^stack-/),
      }),
    );
  });

  it("preserves only allowlisted operational context", () => {
    crashReporting.recordError(new Error("private"), {
      component: "SettingsPage",
      source: "react",
      note: "private note",
    });
    expect(logger.error).toHaveBeenCalledWith(
      "[Crash]",
      expect.objectContaining({
        diagnostic: {
          component: "SettingsPage",
          source: "react",
          note: "[REDACTED]",
        },
      }),
    );
  });

  it("stores only the fixed report schema", () => {
    crashReporting.recordError(new Error("stored private error"));
    expect(safeLocalStorageSet).toHaveBeenCalledWith(
      SK.CRASH_LOG,
      [expect.objectContaining({
        code: "ZF_CRASH_RECORDED",
        errorName: "Error",
        stackFingerprint: expect.stringMatching(/^stack-/),
        time: expect.any(String),
      })],
    );
    expect(JSON.stringify(mockLocalStorage[SK.CRASH_LOG])).not.toContain("stored private error");
  });

  it("appends a new report after current schema-valid entries", () => {
    mockLocalStorage[SK.CRASH_LOG] = [retainedReport(1)];
    crashReporting.recordError(new Error("new private error"));
    expect(mockLocalStorage[SK.CRASH_LOG]).toHaveLength(2);
  });

  it("drops legacy and expired retained entries", () => {
    mockLocalStorage[SK.CRASH_LOG] = [
      { message: "legacy raw error", time: new Date().toISOString() },
      retainedReport(1, CRASH_REPORT_RETENTION_MS + 1_000),
      retainedReport(2),
    ];
    crashReporting.recordError(new Error("new private error"));
    const retained = mockLocalStorage[SK.CRASH_LOG] as unknown[];
    expect(retained).toHaveLength(2);
    expect(JSON.stringify(retained)).not.toContain("legacy raw error");
  });

  it("prunes legacy and expired reports without waiting for another crash", () => {
    mockLocalStorage[SK.CRASH_LOG] = [
      { message: "legacy private error", time: new Date().toISOString() },
      retainedReport(1, CRASH_REPORT_RETENTION_MS + 1_000),
      retainedReport(2),
    ];

    expect(pruneRetainedCrashReports()).toBe(true);

    expect(mockLocalStorage[SK.CRASH_LOG]).toEqual([
      expect.objectContaining({
        code: "ZF_CRASH_RECORDED",
        errorName: "Error",
        stackFingerprint: "stack-present",
        context: { source: "react", count: 2 },
      }),
    ]);
  });

  it("re-sanitizes poisoned fields in a current-schema retained report", () => {
    const retainedCanary = "ZF_T172_RETAINED_CRASH_8Q4M7K2R9P6D";
    mockLocalStorage[SK.CRASH_LOG] = [{
      code: "ZF_CRASH_RECORDED",
      errorName: retainedCanary,
      stackFingerprint: `stack-${retainedCanary}`,
      context: {
        note: retainedCanary,
        metadata: { userId: retainedCanary },
      },
      time: new Date().toISOString(),
    }];

    expect(pruneRetainedCrashReports()).toBe(true);

    const serialized = JSON.stringify(mockLocalStorage[SK.CRASH_LOG]);
    expect(serialized).not.toContain(retainedCanary);
    expect(mockLocalStorage[SK.CRASH_LOG]).toEqual([
      expect.objectContaining({
        code: "ZF_CRASH_RECORDED",
        errorName: "UnknownError",
        stackFingerprint: "stack-none",
        context: {
          note: "[REDACTED]",
          metadata: { userId: "[REDACTED]" },
        },
      }),
    ]);
  });

  it("clears a valid JSON non-array retained payload instead of leaving it poisoned", () => {
    const retainedCanary = "ZF_T172_RETAINED_OBJECT_4K8N2V7Q5M9R";
    mockLocalStorage[SK.CRASH_LOG] = {
      code: "ZF_CRASH_RECORDED",
      note: retainedCanary,
    };

    expect(pruneRetainedCrashReports()).toBe(true);
    expect(mockLocalStorage[SK.CRASH_LOG]).toEqual([]);
    expect(JSON.stringify(mockLocalStorage[SK.CRASH_LOG])).not.toContain(retainedCanary);
  });

  it("drops a poisoned report with a far-future timestamp", () => {
    const retainedCanary = "ZF_T172_FUTURE_CRASH_5R9M2K7V4Q8N";
    mockLocalStorage[SK.CRASH_LOG] = [{
      ...retainedReport(),
      context: { note: retainedCanary },
      time: new Date(Date.now() + CRASH_REPORT_RETENTION_MS).toISOString(),
    }];

    expect(pruneRetainedCrashReports()).toBe(true);
    expect(mockLocalStorage[SK.CRASH_LOG]).toEqual([]);
  });

  it("caps retained reports at 20", () => {
    mockLocalStorage[SK.CRASH_LOG] = Array.from({ length: 20 }, (_, index) =>
      retainedReport(index),
    );
    crashReporting.recordError(new Error("new private error"));
    const retained = mockLocalStorage[SK.CRASH_LOG] as ReturnType<typeof retainedReport>[];
    expect(retained).toHaveLength(20);
    expect(retained[0].stackFingerprint).toBe("stack-present");
    expect(retained[19].code).toBe("ZF_CRASH_RECORDED");
  });

  it("retains no context field when none is supplied", () => {
    crashReporting.recordError(new Error("private"));
    const retained = mockLocalStorage[SK.CRASH_LOG] as Array<Record<string, unknown>>;
    expect(retained[0]).not.toHaveProperty("context");
  });

  it("retains only fixed diagnostics and allowlisted metadata for private errors", () => {
    const canaries = [
      "ZF_T172_DIARY_7H2K9Q4M6P8R",
      "ZF_T172_HABIT_4N8C2V7X5L3D",
      "ZF_T172_AUTH_9B6W3J8S2F5K",
      "ZF_T172_IDENTITY_5M7R2Q9T4C8P",
    ];
    const privateError = new Error(canaries[0]) as Error & { cause?: unknown };
    privateError.cause = new Error(canaries[2]);
    crashReporting.recordError(privateError, {
      source: "react",
      note: canaries[1],
      userId: canaries[3],
    });

    const serialized = JSON.stringify({
      logs: vi.mocked(logger.error).mock.calls,
      retained: mockLocalStorage[SK.CRASH_LOG],
    });
    for (const canary of canaries) expect(serialized).not.toContain(canary);
    expect(serialized).toContain("source");
    expect(serialized).toContain("react");
  });

  it("provides an explicit retained-report clear path", () => {
    mockLocalStorage[SK.CRASH_LOG] = [retainedReport()];
    expect(crashReporting.clearRetainedReports()).toBe(true);
    expect(mockLocalStorage[SK.CRASH_LOG]).toEqual([]);
  });

  it("does not log a raw user ID when identity is set", () => {
    crashReporting.setUserId("user-123");
    const serialized = JSON.stringify(vi.mocked(logger.log).mock.calls);
    expect(serialized).not.toContain("user-123");
    expect(logger.log).toHaveBeenCalledWith("[CrashIdentity]", { state: "set" });
  });

  it("records only the cleared identity state for null", () => {
    crashReporting.setUserId(null);
    expect(logger.log).toHaveBeenCalledWith("[CrashIdentity]", { state: "cleared" });
  });

  it("records the reporting enabled flag", () => {
    crashReporting.setEnabled(true);
    expect(logger.log).toHaveBeenCalledWith("[CrashReporting]", { enabled: true });
  });

  it("does not log arbitrary custom key names or values", () => {
    crashReporting.setCustomKey("private_key", "private value");
    const serialized = JSON.stringify(vi.mocked(logger.log).mock.calls);
    expect(serialized).not.toContain("private_key");
    expect(serialized).not.toContain("private value");
    expect(logger.log).toHaveBeenCalledWith("[CrashCustomKey]");
  });
});

describe("recordError helper", () => {
  it("converts Error input to a fixed diagnostic", () => {
    recordError(new Error("direct private error"), { source: "test" });
    const serialized = JSON.stringify(vi.mocked(logger.error).mock.calls);
    expect(serialized).not.toContain("direct private error");
    expect(serialized).toContain("ZF_CRASH_RECORDED");
  });

  it("converts string input to a fixed diagnostic", () => {
    recordError("string private failure");
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("string private failure");
  });

  it("converts object input without serializing its values", () => {
    recordError({ note: "object private failure" });
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("object private failure");
  });
});

describe("withCrashReporting", () => {
  it("passes through a successful return value", async () => {
    const wrapped = withCrashReporting(async () => 42);
    await expect(wrapped()).resolves.toBe(42);
  });

  it("records a fixed diagnostic and rethrows the original failure", async () => {
    const wrapped = withCrashReporting(async () => {
      throw new Error("async private failure");
    }, { action: "test" });
    await expect(wrapped()).rejects.toThrow("async private failure");
    const serialized = JSON.stringify(vi.mocked(logger.error).mock.calls);
    expect(serialized).not.toContain("async private failure");
    expect(serialized).toContain("ZF_CRASH_RECORDED");
  });

  it("passes arguments through to the wrapped function", async () => {
    const wrapped = withCrashReporting(async (a: unknown, b: unknown) => `${a}-${b}`);
    await expect(wrapped("x", "y")).resolves.toBe("x-y");
  });
});
