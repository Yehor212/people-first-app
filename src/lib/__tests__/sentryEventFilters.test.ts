import type { Event, EventHint } from "@sentry/core";
import { describe, expect, it } from "vitest";

import {
  isExpectedAbortError,
  shouldDropSentryEvent,
  SENTRY_ALLOW_URLS,
} from "../sentryEventFilters";

describe("sentryEventFilters", () => {
  it("drops chunk-load wording from Sentry event payloads even without an Error hint", () => {
    const event: Event = {
      exception: {
        values: [{ value: "error loading dynamically imported module: /assets/Diary.js" }],
      },
    };

    expect(shouldDropSentryEvent(event)).toBe(true);
  });

  it("drops Supabase auth lock contention errors", () => {
    const hint: EventHint = {
      originalException: new Error("navigator lock was stolen before auth finished"),
    };

    expect(shouldDropSentryEvent({}, hint)).toBe(true);
  });

  it("keeps first-party application errors", () => {
    const hint: EventHint = {
      originalException: new Error("Cannot read properties of undefined"),
    };

    expect(shouldDropSentryEvent({}, hint)).toBe(false);
  });

  it("recognizes abort errors as expected browser cancellation", () => {
    expect(isExpectedAbortError(new DOMException("The operation was aborted", "AbortError"))).toBe(
      true
    );
  });

  it("allows first-party deployment and native WebView frame URLs", () => {
    expect(
      SENTRY_ALLOW_URLS.some((pattern) =>
        pattern.test("https://yehor212.github.io/people-first-app/assets/index.js")
      )
    ).toBe(true);
    expect(SENTRY_ALLOW_URLS.some((pattern) => pattern.test("https://localhost/assets/app.js"))).toBe(
      true
    );
  });
});
