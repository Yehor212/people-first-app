import type { Event } from "@sentry/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@sentry/browser", () => sentryMocks);

async function loadSentry(dsn: string | undefined) {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  if (dsn !== undefined) {
    vi.stubEnv("VITE_SENTRY_DSN", dsn);
  }
  vi.stubGlobal("__APP_VERSION__", "2.0.0-test");
  sentryMocks.init.mockClear();
  const { initSentry } = await import("../sentry");

  initSentry();

  return sentryMocks.init.mock.calls[0]?.[0] as
    | {
        beforeSend?: (event: Event, hint?: unknown) => Event | null;
        environment?: string;
        release?: string;
        sendDefaultPii?: boolean;
        integrations?: Array<{ name?: string }>;
        replaysSessionSampleRate?: number;
        replaysOnErrorSampleRate?: number;
      }
    | undefined;
}

async function loadBeforeSend() {
  const options = await loadSentry("https://public@example.ingest.sentry.io/1");
  expect(options?.beforeSend, "Sentry.init should receive beforeSend").toBeTypeOf("function");
  return options!.beforeSend!;
}

describe("Sentry privacy scrubbing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("skips initialization for missing, placeholder, or malformed DSNs", async () => {
    for (const dsn of ["", "your_sentry_dsn_optional", "not-a-url"] as const) {
      await loadSentry(dsn);
      expect(sentryMocks.init, `Sentry.init should not run for DSN: ${dsn}`).not.toHaveBeenCalled();
    }
  });

  it("initializes error/performance monitoring without Session Replay", async () => {
    const options = await loadSentry("https://public@example.ingest.sentry.io/1");

    expect(sentryMocks.init).toHaveBeenCalledTimes(1);
    expect(sentryMocks.browserTracingIntegration).toHaveBeenCalledTimes(1);
    expect(sentryMocks.replayIntegration).not.toHaveBeenCalled();
    expect(options?.integrations?.map((integration) => integration.name)).toEqual([
      "browserTracingIntegration",
    ]);
    expect(options?.replaysSessionSampleRate).toBeUndefined();
    expect(options?.replaysOnErrorSampleRate).toBeUndefined();
  });


  it("uses the same release name format as source-map uploads", async () => {
    const options = await loadSentry("https://public@example.ingest.sentry.io/1");

    expect(options).toMatchObject({
      release: "zenflow@2.0.0-test",
      sendDefaultPii: false,
    });
    expect(options?.environment).toBeTypeOf("string");
    expect(options?.environment).not.toBe("");
  });

  it("redacts tokens from extra, contexts, and request payload fields before send", async () => {
    const beforeSend = await loadBeforeSend();
    const tokenValue = `tok_${"a".repeat(32)}`;
    const bearerValue = `Bearer ${tokenValue}`;
    const event = {
      message: "sync failed",
      user: {
        id: "safe-user-id",
        email: "person@example.com",
        username: "person",
        ip_address: "203.0.113.10",
      },
      extra: {
        safeCount: 2,
        sync: {
          accessToken: tokenValue,
          note: bearerValue,
        },
      },
      contexts: {
        auth: {
          refresh_token: `refresh_token=${tokenValue}`,
          nested: [`/callback#id_token=${tokenValue}`],
        },
      },
      request: {
        url: `https://app.test/callback#access_token=${tokenValue}`,
        query_string: `refresh_token=${tokenValue}&view=settings`,
        cookies: {
          session_token: tokenValue,
          theme: "dark",
        },
        headers: {
          authorization: bearerValue,
          "x-safe": "ok",
        },
        data: {
          authorization: bearerValue,
          nested: {
            token: tokenValue,
          },
        },
      },
      breadcrumbs: [
        {
          message: bearerValue,
          data: {
            callback: `/auth#access_token=${tokenValue}`,
          },
        },
      ],
    } satisfies Event;

    beforeSend(event, { originalException: new Error("sync failed") });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(tokenValue);
    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain("203.0.113.10");
    expect(serialized).toContain("[REDACTED]");
    expect(event.user).toEqual({});
    expect(event.request?.headers?.["x-safe"]).toBe("[REDACTED]");
    expect(event.extra?.safeCount).toBe(2);
  });

  it("redacts tokens from top-level message, exception, transaction, tags, and fingerprint", async () => {
    const beforeSend = await loadBeforeSend();
    const tokenValue = `tok_${"b".repeat(32)}`;
    const event = {
      message: `callback failed with access_token=${tokenValue}`,
      transaction: `GET /auth/callback#refresh_token=${tokenValue}`,
      fingerprint: [`id_token=${tokenValue}`, "stable"],
      tags: {
        auth_token: tokenValue,
        area: "auth",
      },
      exception: {
        values: [
          {
            type: "AuthCallbackError",
            value: `Bearer ${tokenValue}`,
          },
        ],
      },
    } satisfies Event;

    beforeSend(event, { originalException: new Error("callback failed") });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(tokenValue);
    expect(serialized).toContain("[REDACTED]");
    expect(event.tags?.area).toBe("[REDACTED]");
  });

  it("redacts structured journal and wellbeing strings while preserving scalar measurements", async () => {
    const beforeSend = await loadBeforeSend();
    const privateCanaries = {
      journal: "PRIVATE_JOURNAL_CANARY",
      moodNote: "PRIVATE_MOOD_NOTE_CANARY",
      coachPrompt: "PRIVATE_COACH_PROMPT_CANARY",
      transcript: "PRIVATE_AUDIO_TRANSCRIPT_CANARY",
    };
    const event = {
      message: "journal save failed",
      extra: {
        operation: "journal-save",
        retryCount: 2,
        journalEntry: privateCanaries.journal,
        mood_note: privateCanaries.moodNote,
      },
      contexts: {
        coach: {
          prompt: privateCanaries.coachPrompt,
          errorCode: "coach-timeout",
        },
      },
      request: {
        data: {
          audioTranscript: privateCanaries.transcript,
          status: "failed",
          contentType: "application/json",
          responseStatus: 503,
        },
      },
      breadcrumbs: [
        {
          category: "storage",
          message: "write rejected",
          data: {
            reflection_text: privateCanaries.journal,
            recordCount: 1,
          },
        },
      ],
    } satisfies Event;

    beforeSend(event, { originalException: new Error("journal save failed") });

    const serialized = JSON.stringify(event);
    for (const canary of Object.values(privateCanaries)) {
      expect(serialized).not.toContain(canary);
    }
    expect(serialized).toContain("[REDACTED]");
    expect(event.extra).toMatchObject({
      operation: "[REDACTED]",
      retryCount: 2,
      journalEntry: "[REDACTED]",
      mood_note: "[REDACTED]",
    });
    expect(event.contexts?.coach).toMatchObject({
      prompt: "[REDACTED]",
      errorCode: "[REDACTED]",
    });
    expect(event.request?.data).toMatchObject({
      audioTranscript: "[REDACTED]",
      status: "[REDACTED]",
      contentType: "[REDACTED]",
      responseStatus: 503,
    });
    expect(event.breadcrumbs?.[0]?.data).toMatchObject({
      reflection_text: "[REDACTED]",
      recordCount: 1,
    });
  });

  it("removes private canaries from every free-form telemetry string boundary", async () => {
    const beforeSend = await loadBeforeSend();
    const canary = "PRIVATE_JOURNAL_CANARY_DO_NOT_SEND";
    const event = {
      message: canary,
      transaction: `/diary/${canary}`,
      fingerprint: [canary],
      exception: {
        values: [{
          type: canary,
          value: canary,
          mechanism: { type: "generic", handled: true, data: { detail: canary } },
          stacktrace: { frames: [{ vars: { note: canary }, context_line: canary }] },
        }],
      },
      extra: { error: canary, count: 1 },
      contexts: { runtime: { detail: canary } },
      request: {
        url: `https://app.test/diary?note=${canary}`,
        query_string: `note=${canary}`,
        headers: { "x-debug-detail": canary },
        data: { error: canary },
      },
      breadcrumbs: [{ category: canary, message: canary, data: { error: canary } }],
      logentry: { message: canary, params: [canary] },
      spans: [{ span_id: "0123456789abcdef", trace_id: "0123456789abcdef0123456789abcdef", start_timestamp: 1, description: canary, data: { detail: canary } }],
    } satisfies Event;

    beforeSend(event, { originalException: new Error(canary) });

    expect(JSON.stringify(event)).not.toContain(canary);
    expect(event.extra?.count).toBe(1);
  });

  it("sanitizes private values before public helpers call the Sentry SDK", async () => {
    const canary = "PRIVATE_JOURNAL_CANARY_DO_NOT_SEND";
    const scope = {
      setTag: vi.fn(),
      setExtra: vi.fn(),
      setExtras: vi.fn(),
    };
    sentryMocks.withScope.mockImplementationOnce((callback: (value: typeof scope) => void) => {
      callback(scope);
    });
    const sentry = await import("../sentry");

    sentry.captureError(new Error(canary), { detail: canary, count: 2 });
    sentry.captureErrorWithCategory(new Error(canary), "sync", { error: canary });
    sentry.addCategorizedBreadcrumb("sync", canary, { detail: canary, count: 3 });
    sentry.captureMessage(canary);
    sentry.addBreadcrumb({ message: canary, data: { error: canary, count: 4 } });
    sentry.setUserContext(canary);

    const calls = JSON.stringify({
      captureException: sentryMocks.captureException.mock.calls,
      setExtras: scope.setExtras.mock.calls,
      addBreadcrumb: sentryMocks.addBreadcrumb.mock.calls,
      captureMessage: sentryMocks.captureMessage.mock.calls,
      setUser: sentryMocks.setUser.mock.calls,
    });
    expect(calls).not.toContain(canary);
    expect(calls).toContain("[REDACTED]");
    expect((sentryMocks.captureException.mock.calls[0]?.[0] as Error).message).toBe(
      "Application error",
    );
    expect(sentryMocks.setUser).toHaveBeenLastCalledWith({ id: "anonymous" });
  });
});
