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
  SDK_VERSION: "10.52.0-test",
}));

vi.mock("@sentry/browser", () => sentryMocks);

async function loadSentry(dsn: string | undefined, dev?: boolean) {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  if (dsn !== undefined) {
    vi.stubEnv("VITE_SENTRY_DSN", dsn);
  }
  if (dev !== undefined) {
    vi.stubEnv("DEV", dev);
  }
  vi.stubGlobal("__APP_VERSION__", "2.0.0-test");
  sentryMocks.init.mockClear();
  const { initSentry } = await import("../sentry");

  initSentry();

  return sentryMocks.init.mock.calls[0]?.[0] as
    | {
        beforeSend?: (event: Event, hint?: unknown) => Event | null;
        beforeSendTransaction?: (event: Event, hint?: unknown) => Event | null;
        environment?: string;
        release?: string;
        sendDefaultPii?: boolean;
        integrations?: Array<{ name?: string }>;
        replaysSessionSampleRate?: number;
        replaysOnErrorSampleRate?: number;
      }
    | undefined;
}

async function loadBeforeSend(dev?: boolean) {
  const options = await loadSentry("https://public@example.ingest.sentry.io/1", dev);
  expect(options?.beforeSend, "Sentry.init should receive beforeSend").toBeTypeOf("function");
  return options!.beforeSend!;
}

describe("Sentry privacy scrubbing", () => {
  beforeEach(() => {
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

  it("scrubs breadcrumbs created directly by SDK integrations", async () => {
    const options = await loadSentry("https://public@example.ingest.sentry.io/1") as
      | { beforeBreadcrumb?: (breadcrumb: { category?: string; message?: string; data?: Record<string, unknown> }) => unknown }
      | undefined;
    const beforeBreadcrumb = options?.beforeBreadcrumb;
    const breadcrumbCanary = "ZF_T172_SDK_BREADCRUMB_7Q4M9K2R8P6D";
    expect(beforeBreadcrumb).toBeTypeOf("function");

    const result = beforeBreadcrumb!({
      category: breadcrumbCanary,
      message: breadcrumbCanary,
      data: { url: `https://${breadcrumbCanary}.example.test/${breadcrumbCanary}` },
    });

    expect(JSON.stringify(result)).not.toContain(breadcrumbCanary);
  });

  it("does not forward raw breadcrumb hints to the SDK", async () => {
    const canary = "ZF_T172_BREADCRUMB_HINT_4d29a7c1";
    const { addBreadcrumb } = await import("../sentry");

    addBreadcrumb(
      { message: canary, data: { url: `https://example.test/?code=${canary}` } },
      { input: new Error(canary) },
    );

    expect(sentryMocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ message: "ZF_SENTRY_BREADCRUMB" }),
    );
    expect(JSON.stringify(sentryMocks.addBreadcrumb.mock.calls)).not.toContain(canary);
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
    expect(event.request?.headers).toEqual({});
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
    expect(event.tags?.area).toBe("auth");
  });

  it("does not derive an event code from an arbitrary bracketed private value", async () => {
    const beforeSend = await loadBeforeSend();
    const bracketCanary = "ZF_T172_PRIV_6Q9M4K2R8P7D";
    const event = { message: `[${bracketCanary}] failed` } satisfies Event;

    beforeSend(event, {});

    expect(event.message).toBe("ZF_SENTRY_EVENT");
    expect(JSON.stringify(event)).not.toContain(bracketCanary);
  });

  it("redacts structured journal and wellbeing content while preserving operational metadata", async () => {
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
      operation: "journal-save",
      retryCount: 2,
      journalEntry: "[REDACTED]",
      mood_note: "[REDACTED]",
    });
    expect(event.contexts?.coach).toMatchObject({
      prompt: "[REDACTED]",
      errorCode: "coach-timeout",
    });
    expect(event.request?.data).toMatchObject({
      audioTranscript: "[REDACTED]",
      status: "failed",
      contentType: "application/json",
      responseStatus: 503,
    });
    expect(event.breadcrumbs?.[0]?.data).toMatchObject({
      reflection_text: "[REDACTED]",
      recordCount: 1,
    });
  });

  it("removes arbitrary private canaries from encoded, nested, error, breadcrumb, tag, context, query, and deep-link variants", async () => {
    const beforeSend = await loadBeforeSend();
    const canaries = {
      diary: "ZF_T172_DIARY_7H2K9Q4M6P8R",
      habit: "ZF_T172_HABIT_4N8C2V7X5L3D",
      auth: "ZF_T172_AUTH_9B6W3J8S2F5K",
      identity: "ZF_T172_IDENTITY_5M7R2Q9T4C8P",
    };
    const encodedDiary = encodeURIComponent(canaries.diary);
    const base64Habit = btoa(canaries.habit);
    const deepLink = `zenflow://challenge?data=${base64Habit}&state=${canaries.auth}`;
    const event = {
      message: canaries.diary,
      transaction: encodedDiary,
      exception: {
        values: [{ type: "Error", value: canaries.habit }],
      },
      breadcrumbs: [
        {
          category: "navigation",
          message: canaries.identity,
          data: { url: deepLink },
        },
      ],
      tags: { detail: canaries.auth, diagnostic_code: "T172_CANARY" },
      contexts: { runtime: { detail: canaries.diary, retry_count: 2 } },
      extra: { nested: [{ cause: canaries.habit }] },
      request: {
        url: deepLink,
        query_string: `note=${encodedDiary}&identity=${canaries.identity}`,
      },
    } satisfies Event;

    const originalException = new Error(canaries.diary) as Error & { cause?: unknown };
    originalException.cause = new Error(canaries.auth);
    beforeSend(event, { originalException });

    const serialized = JSON.stringify(event);
    for (const value of [
      ...Object.values(canaries),
      encodedDiary,
      base64Habit,
      deepLink,
    ]) {
      expect(serialized).not.toContain(value);
    }
    expect(JSON.stringify(event)).not.toContain("T172_CANARY");
    expect(event.contexts?.runtime).toMatchObject({ retry_count: 2 });
  });

  it("drops canaries from top-level SDK and unknown event fields", async () => {
    const beforeSend = await loadBeforeSend();
    const fieldCanary = "ZF_T172_EVENT_FIELD_3K8Q5M2R9P7D";
    const event = {
      message: "fixed",
      event_id: fieldCanary,
      release: fieldCanary,
      dist: fieldCanary,
      environment: fieldCanary,
      platform: fieldCanary,
      logger: fieldCanary,
      server_name: fieldCanary,
      sdk: { name: fieldCanary, version: fieldCanary },
      transaction_info: { source: fieldCanary },
      private_payload: fieldCanary,
    } as unknown as Event & Record<string, unknown>;

    beforeSend(event, {});

    expect(JSON.stringify(event)).not.toContain(fieldCanary);
    expect(event.message).toBe("ZF_SENTRY_EVENT");
    expect(event.platform).toBe("javascript");
    expect(event.release).toBe("zenflow@2.0.0-test");
    expect(event.sdk).toMatchObject({
      name: "sentry.javascript.browser",
      settings: { infer_ip: "never" },
    });
    expect(event.private_payload).toBeUndefined();
  });

  it("drops raw original-exception values that arrive through a Sentry event hint", async () => {
    const beforeSend = await loadBeforeSend();
    const hintCanary = "ZF_T172_HINT_CAUSE_4N9C2V7X5L3D";
    const original = new Error(hintCanary) as Error & { cause?: unknown };
    original.cause = new Error(hintCanary);
    const hint = { originalException: original };

    beforeSend({ message: "fixed" }, hint);

    expect(JSON.stringify(hint)).not.toContain(hintCanary);
    expect(hint.originalException).toBeUndefined();
  });

  it("does not retain private canaries embedded in metadata keys", async () => {
    const beforeSend = await loadBeforeSend();
    const privateKey = ["ZF_T172", "IDENTITY_KEY", "8D4K2M7Q9P6R"].join("_");
    const event = {
      extra: {
        status: privateKey,
        metadata: {
          [privateKey]: "ordinary-value",
        },
      },
    } satisfies Event;

    const attachmentCanary = "ZF_T172_DIARY_ATTACHMENT_7H2K9Q4M6P8R";
    const hint = {
      attachments: [{ filename: "diagnostic.txt", data: attachmentCanary }],
    };
    beforeSend(event, hint);

    expect(JSON.stringify({ event, hint })).not.toContain(privateKey);
    expect(JSON.stringify({ event, hint })).not.toContain(attachmentCanary);
    expect(hint.attachments).toEqual([]);
  });

  it("does not retain private canaries embedded in URL host or path segments", async () => {
    const beforeSend = await loadBeforeSend();
    const hostCanary = "zf-t172-identity-host-8d4k2m7q9p6r";
    const pathCanary = "ZF_T172_DIARY_PATH_7H2K9Q4M6P8R";
    const event = {
      request: {
        url: `https://${hostCanary}.example.test/journal/${pathCanary}?view=detail`,
      },
      exception: {
        values: [{
          type: "Error",
          value: "fixed",
          stacktrace: {
            frames: [{
              filename: `/Users/${pathCanary}/app.js`,
              function: "render",
            }],
          },
        }],
      },
    } satisfies Event;

    beforeSend(event, {});

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(hostCanary);
    expect(serialized).not.toContain(pathCanary);
  });

  it("scrubs transaction and span payloads through the same boundary", async () => {
    const options = await loadSentry("https://public@example.ingest.sentry.io/1");
    const beforeSendTransaction = options?.beforeSendTransaction;
    expect(beforeSendTransaction).toBeTypeOf("function");
    const privateCanary = "ZF_T172_HABIT_SPAN_4N8C2V7X5L3D";
    const event = {
      type: "transaction",
      transaction: `/habits/${privateCanary}`,
      spans: [{
        data: {
          url: `https://example.test/habits/${privateCanary}`,
          privateCanary,
        },
        description: `GET /habits/${privateCanary}`,
        op: "http.client",
        span_id: "0123456789abcdef",
        trace_id: "0123456789abcdef0123456789abcdef",
        start_timestamp: 1,
        timestamp: 2,
        profile_id: privateCanary,
        measurements: { custom_private_metric: { value: 1, unit: privateCanary } },
        links: [{ trace_id: privateCanary, span_id: privateCanary }],
      }],
      measurements: {
        lcp: { value: 1, unit: privateCanary },
        private_metric: { value: 2, unit: privateCanary },
      },
    } satisfies Event;

    beforeSendTransaction!(event, {});

    expect(JSON.stringify(event)).not.toContain(privateCanary);
    expect(event.measurements).toEqual({ lcp: { value: 1, unit: "none" } });
  });

  it("fails closed without throwing for hostile and frozen event, hint, and breadcrumb values", async () => {
    const options = await loadSentry("https://public@example.ingest.sentry.io/1") as {
      beforeSend?: (event: unknown, hint?: unknown) => Event | null;
      beforeSendTransaction?: (event: unknown, hint?: unknown) => Event | null;
      beforeBreadcrumb?: (breadcrumb: unknown) => unknown;
    };
    const canary = "ZF_T172_SENTRY_HOSTILE_91c4e2a7";
    const hostileEvent = new Proxy({ message: canary }, {
      get: () => { throw new Error(canary); },
      ownKeys: () => { throw new Error(encodeURIComponent(canary)); },
    });
    const frozenHint = Object.freeze({
      originalException: new Error(canary),
      attachments: Object.freeze([{ filename: canary, data: canary }]),
    });
    const hostileBreadcrumb = new Proxy({}, {
      get: () => { throw new Error(canary); },
    });

    expect(() => options.beforeSend?.(hostileEvent, frozenHint)).not.toThrow();
    expect(options.beforeSend?.(hostileEvent, frozenHint)).toBeNull();
    expect(() => options.beforeSendTransaction?.(hostileEvent, frozenHint)).not.toThrow();
    expect(options.beforeSendTransaction?.(hostileEvent, frozenHint)).toBeNull();
    expect(() => options.beforeBreadcrumb?.(hostileBreadcrumb)).not.toThrow();
    expect(options.beforeBreadcrumb?.(hostileBreadcrumb)).toBeNull();
  });

  it("drops an otherwise safe event when a frozen hint attachment cannot be detached", async () => {
    const beforeSend = await loadBeforeSend(false);
    const canary = "ZF_T172_SENTRY_FROZEN_ATTACHMENT_6e3b9c1a";
    const event = { message: "ZF_RUNTIME_ERROR" } satisfies Event;
    const frozenHint = Object.freeze({
      originalException: new Error(canary),
      attachments: Object.freeze([{ filename: "diagnostic.txt", data: canary }]),
    });

    expect(() => beforeSend(event, frozenHint)).not.toThrow();
    expect(beforeSend(event, frozenHint)).toBeNull();
  });
});
