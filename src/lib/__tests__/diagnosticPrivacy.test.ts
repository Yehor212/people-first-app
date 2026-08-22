import type { Event } from "@sentry/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PRIVATE_CANARY = "PRIVATE_JOURNAL_CANARY_DO_NOT_DIAGNOSE";

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({ name: "browserTracingIntegration" })),
  replayIntegration: vi.fn(() => ({ name: "replayIntegration" })),
  captureException: vi.fn(),
  withScope: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
}));

let mockLocalStorage: Record<string, unknown> = {};

vi.mock("@sentry/browser", () => sentryMocks);
vi.mock("@/lib/env", () => ({ IS_DEV: true }));
vi.mock("../safeJson", () => ({
  safeLocalStorageGet: vi.fn(<T>(key: string, fallback: T): T =>
    key in mockLocalStorage ? (mockLocalStorage[key] as T) : fallback
  ),
  safeLocalStorageSet: vi.fn((key: string, value: unknown): boolean => {
    mockLocalStorage[key] = value;
    return true;
  }),
}));

const consoleSpies = [
  vi.spyOn(console, "log").mockImplementation(() => undefined),
  vi.spyOn(console, "warn").mockImplementation(() => undefined),
  vi.spyOn(console, "error").mockImplementation(() => undefined),
];

function serializedConsoleCalls(): string {
  return JSON.stringify(consoleSpies.flatMap((spy) => spy.mock.calls));
}

async function loadCrashReporting(native: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/platform", () => ({ isNative: native }));
  return import("../crashReporting");
}

async function loadBeforeSend() {
  vi.resetModules();
  vi.stubEnv("VITE_SENTRY_DSN", "https://public@example.ingest.sentry.io/1");
  vi.stubGlobal("__APP_VERSION__", "2.1.0-test");
  sentryMocks.init.mockClear();

  const { initSentry } = await import("../sentry");
  initSentry({ externalDiagnosticsEnabled: true });

  const options = sentryMocks.init.mock.calls[0]?.[0] as
    | { beforeSend?: (event: Event, hint?: unknown) => Event | null }
    | undefined;
  expect(options?.beforeSend).toBeTypeOf("function");
  return options!.beforeSend!;
}

describe("diagnostic privacy boundary", () => {
  beforeEach(() => {
    mockLocalStorage = {};
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/platform");
  });

  it("keeps Error messages, arrays, stacks, and arbitrary context out of web diagnostics", async () => {
    const { logger } = await import("../logger");
    const { crashReporting, recordError } = await loadCrashReporting(false);
    const error = new Error(PRIVATE_CANARY);
    error.stack = `Error: ${PRIVATE_CANARY}\n at ${PRIVATE_CANARY}:1:1`;

    logger.error(error, [PRIVATE_CANARY], { arbitrary: PRIVATE_CANARY });
    crashReporting.log(PRIVATE_CANARY);
    crashReporting.recordError(error, {
      component: PRIVATE_CANARY,
      content: PRIVATE_CANARY,
    });
    recordError({ nested: [PRIVATE_CANARY] }, { source: PRIVATE_CANARY });

    expect(serializedConsoleCalls()).not.toContain(PRIVATE_CANARY);
    expect(JSON.stringify(mockLocalStorage)).not.toContain(PRIVATE_CANARY);
  });

  it("keeps the same canary out of native console and Crashlytics-facing calls", async () => {
    const { crashReporting, recordError } = await loadCrashReporting(true);
    const error = new Error(PRIVATE_CANARY);
    error.stack = `Error: ${PRIVATE_CANARY}\n at ${PRIVATE_CANARY}:1:1`;

    crashReporting.log(PRIVATE_CANARY);
    crashReporting.recordError(error, { arbitrary: PRIVATE_CANARY });
    crashReporting.setUserId(PRIVATE_CANARY);
    crashReporting.setCustomKey("private", PRIVATE_CANARY);
    recordError([PRIVATE_CANARY], { content: PRIVATE_CANARY });

    expect(serializedConsoleCalls()).not.toContain(PRIVATE_CANARY);
  });

  it("sanitizes buffered errors before an explicitly registered sink sees them", async () => {
    const {
      __resetForTests,
      captureOrBuffer,
      setCaptureSink,
    } = await import("../errorBuffer");
    __resetForTests();
    const sink = vi.fn();
    const error = new Error(PRIVATE_CANARY);
    error.stack = `Error: ${PRIVATE_CANARY}\n at ${PRIVATE_CANARY}:1:1`;

    captureOrBuffer(error, { arbitrary: PRIVATE_CANARY, retryable: true });
    setCaptureSink(sink);

    expect(sink).toHaveBeenCalledTimes(1);
    expect((sink.mock.calls[0][0] as Error).message).not.toContain(PRIVATE_CANARY);
    expect((sink.mock.calls[0][0] as Error).stack ?? "").not.toContain(PRIVATE_CANARY);
    expect(JSON.stringify(sink.mock.calls[0][1])).not.toContain(PRIVATE_CANARY);
  });

  it("removes private content from the final Sentry transport event", async () => {
    const beforeSend = await loadBeforeSend();
    const event = {
      message: PRIVATE_CANARY,
      transaction: PRIVATE_CANARY,
      exception: {
        values: [{ type: PRIVATE_CANARY, value: PRIVATE_CANARY, stacktrace: { frames: [] } }],
      },
      extra: { arbitrary: PRIVATE_CANARY, nested: [PRIVATE_CANARY] },
      contexts: { arbitrary: { content: PRIVATE_CANARY } },
      tags: { arbitrary: PRIVATE_CANARY },
      fingerprint: [PRIVATE_CANARY],
      request: {
        url: `https://example.test/${PRIVATE_CANARY}`,
        query_string: `q=${PRIVATE_CANARY}`,
        headers: { "x-arbitrary": PRIVATE_CANARY },
        cookies: { arbitrary: PRIVATE_CANARY },
        data: { arbitrary: PRIVATE_CANARY },
      },
      breadcrumbs: [{ message: PRIVATE_CANARY, data: { arbitrary: PRIVATE_CANARY } }],
    } satisfies Event;

    beforeSend(event, { originalException: new Error(PRIVATE_CANARY) });

    expect(JSON.stringify(event)).not.toContain(PRIVATE_CANARY);
  });
});
