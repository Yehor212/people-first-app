import { beforeEach, describe, expect, it, vi } from "vitest";

let mockLocalStorage: Record<string, unknown> = {};

vi.mock("@/lib/platform", () => ({ isNative: false }));
vi.mock("../logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("../safeJson", () => ({
  safeLocalStorageGet: vi.fn(<T>(key: string, defaultValue: T): T =>
    key in mockLocalStorage ? (mockLocalStorage[key] as T) : defaultValue
  ),
  safeLocalStorageSet: vi.fn((key: string, value: unknown): boolean => {
    mockLocalStorage[key] = value;
    return true;
  }),
}));

import { crashReporting, recordError, withCrashReporting } from "@/lib/crashReporting";
import {
  DIAGNOSTIC_CODES,
  LOCAL_CRASH_RECORD_LIMIT,
  resetExternalDiagnosticSinkStateForTests,
} from "@/lib/diagnosticPrivacy";
import { logger } from "../logger";
import { SK } from "@/lib/storageKeys";

beforeEach(() => {
  mockLocalStorage = {};
  vi.clearAllMocks();
  resetExternalDiagnosticSinkStateForTests();
});

describe("privacy-safe crash reporting", () => {
  it("logs and stores only a fixed code", () => {
    const canary = "PRIVATE_CRASH_CANARY";
    const error = new Error(canary);
    error.stack = `Error: ${canary}\n at ${canary}:1:1`;

    crashReporting.log(canary);
    crashReporting.recordError(error, {
      content: canary,
      componentStack: canary,
      retryable: true,
      count: 2,
    });

    expect(logger.log).toHaveBeenCalledWith(DIAGNOSTIC_CODES.crash);
    expect(logger.error).toHaveBeenCalledWith(DIAGNOSTIC_CODES.crash);
    expect(JSON.stringify(mockLocalStorage)).not.toContain(canary);
    expect(mockLocalStorage[SK.CRASH_LOG]).toEqual([
      expect.objectContaining({
        schemaVersion: 1,
        code: DIAGNOSTIC_CODES.crash,
        metadata: { retryable: true, count: 2 },
      }),
    ]);
  });

  it("discards legacy content-bearing entries instead of migrating them", () => {
    mockLocalStorage[SK.CRASH_LOG] = [
      {
        message: "PRIVATE_LEGACY_MESSAGE",
        stack: "PRIVATE_LEGACY_STACK",
        context: { content: "PRIVATE_LEGACY_CONTEXT" },
        time: "2026-02-16T00:00:00.000Z",
      },
    ];

    crashReporting.recordError(new Error("PRIVATE_NEW_MESSAGE"));

    const serialized = JSON.stringify(mockLocalStorage[SK.CRASH_LOG]);
    expect(serialized).not.toContain("PRIVATE_LEGACY");
    expect(serialized).not.toContain("PRIVATE_NEW_MESSAGE");
    expect(mockLocalStorage[SK.CRASH_LOG]).toEqual([
      expect.objectContaining({ code: DIAGNOSTIC_CODES.crash }),
    ]);
  });

  it("keeps at most the documented number of safe local records", () => {
    for (let index = 0; index < LOCAL_CRASH_RECORD_LIMIT + 3; index += 1) {
      crashReporting.recordError(new Error(`private-${index}`), { count: index });
    }

    const stored = mockLocalStorage[SK.CRASH_LOG] as unknown[];
    expect(stored).toHaveLength(LOCAL_CRASH_RECORD_LIMIT);
    expect(JSON.stringify(stored)).not.toContain("private-");
  });

  it("provides clear and explicit external-sink state controls", () => {
    mockLocalStorage[SK.ERROR_LOG] = [{ legacy: "private" }];
    mockLocalStorage[SK.CRASH_LOG] = [{ legacy: "private" }];

    expect(crashReporting.getState()).toEqual({
      externalSink: "disabled-by-default",
      localRecordLimit: LOCAL_CRASH_RECORD_LIMIT,
    });

    crashReporting.clearLocalRecords();

    expect(mockLocalStorage[SK.ERROR_LOG]).toEqual([]);
    expect(mockLocalStorage[SK.CRASH_LOG]).toEqual([]);
  });

  it("does not log owner identifiers or arbitrary custom keys", () => {
    crashReporting.setUserId("PRIVATE_OWNER_CANARY");
    crashReporting.setCustomKey("private", "PRIVATE_CUSTOM_CANARY");
    crashReporting.setEnabled(true);

    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe("recordError helper", () => {
  it.each([
    new Error("PRIVATE_ERROR_CANARY"),
    "PRIVATE_STRING_CANARY",
    { nested: ["PRIVATE_OBJECT_CANARY"] },
  ])("normalizes arbitrary thrown values without serializing them", (value) => {
    recordError(value, { content: "PRIVATE_CONTEXT_CANARY" });

    expect(logger.error).toHaveBeenCalledWith(DIAGNOSTIC_CODES.crash);
    expect(JSON.stringify(mockLocalStorage)).not.toContain("PRIVATE_");
  });
});

describe("withCrashReporting", () => {
  it("passes through successful return values and arguments", async () => {
    const fn = async (a: unknown, b: unknown) => `${String(a)}-${String(b)}`;
    const wrapped = withCrashReporting(fn);
    await expect(wrapped("x", "y")).resolves.toBe("x-y");
  });

  it("records a fixed code and rethrows the original failure", async () => {
    const fn = async () => {
      throw new Error("PRIVATE_ASYNC_CANARY");
    };
    const wrapped = withCrashReporting(fn, { content: "PRIVATE_CONTEXT_CANARY" });

    await expect(wrapped()).rejects.toThrow("PRIVATE_ASYNC_CANARY");
    expect(logger.error).toHaveBeenCalledWith(DIAGNOSTIC_CODES.crash);
    expect(JSON.stringify(mockLocalStorage)).not.toContain("PRIVATE_");
  });
});
