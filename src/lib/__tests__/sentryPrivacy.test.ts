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
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("skips initialization for missing, placeholder, or malformed DSNs", async () => {
    for (const dsn of ["", "your_sentry_dsn_optional", "not-a-url"] as const) {
      await loadSentry(dsn);
      expect(sentryMocks.init, `Sentry.init should not run for DSN: ${dsn}`).not.toHaveBeenCalled();
    }
  });

  it("initializes when the DSN is a valid Sentry HTTPS URL", async () => {
    await loadSentry("https://public@example.ingest.sentry.io/1");

    expect(sentryMocks.init).toHaveBeenCalledTimes(1);
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
    expect(event.user).toEqual({ id: "safe-user-id" });
    expect(event.request?.headers?.["x-safe"]).toBe("ok");
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
});
