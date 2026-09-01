import { createRef } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useScheduleData } from "../useScheduleData";

const calendarMocks = vi.hoisted(() => ({
  fetchCalendarEventsWithCache: vi.fn(),
  isCalendarEnabled: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/googleCalendar", () => ({
  fetchCalendarEventsWithCache: calendarMocks.fetchCalendarEventsWithCache,
  isCalendarEnabled: calendarMocks.isCalendarEnabled,
}));

vi.mock("@/lib/safeJson", () => ({
  safeLocalStorageGet: vi.fn((_key: string, fallback: unknown) => fallback),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: { breakTime: "Break" },
    language: "en",
    isRTL: false,
  }),
}));

vi.mock("@/lib/animationUtils", () => ({
  shouldAnimate: () => false,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: calendarMocks.loggerError,
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderScheduleData() {
  return renderHook(() =>
    useScheduleData([], createRef<HTMLDivElement>(), createRef<HTMLDivElement>(), "2026-07-29"),
  );
}

describe("useScheduleData Google Calendar state", () => {
  beforeEach(() => {
    calendarMocks.fetchCalendarEventsWithCache.mockReset();
    calendarMocks.isCalendarEnabled.mockReset();
    calendarMocks.loggerError.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports disabled without starting a calendar fetch", () => {
    calendarMocks.isCalendarEnabled.mockReturnValue(false);

    const { result } = renderScheduleData();

    expect(result.current.googleCalendarStatus).toBe("disabled");
    expect(result.current.isLoadingGoogle).toBe(false);
    expect(result.current.googleEvents).toEqual([]);
    expect(calendarMocks.fetchCalendarEventsWithCache).not.toHaveBeenCalled();
  });

  it("moves from loading to ready after one successful fetch without a fetch loop", async () => {
    const request = deferred<
      Array<{
        id: string;
        title: string;
        startTime: Date;
        endTime: Date;
        isAllDay: boolean;
      }>
    >();
    calendarMocks.isCalendarEnabled.mockReturnValue(true);
    calendarMocks.fetchCalendarEventsWithCache.mockReturnValue(request.promise);

    const { result } = renderScheduleData();

    expect(result.current.googleCalendarStatus).toBe("loading");
    expect(result.current.isLoadingGoogle).toBe(true);

    await act(async () => {
      request.resolve([
        {
          id: "provider-event-1",
          title: "Design review",
          startTime: new Date(2026, 6, 29, 9, 30),
          endTime: new Date(2026, 6, 29, 10, 15),
          isAllDay: false,
        },
      ]);
      await request.promise;
    });

    await waitFor(() => expect(result.current.googleCalendarStatus).toBe("ready"));
    expect(result.current.isLoadingGoogle).toBe(false);
    expect(result.current.googleEvents).toEqual([
      expect.objectContaining({
        id: "gcal-provider-event-1",
        title: "Design review",
        source: "google",
      }),
    ]);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(calendarMocks.fetchCalendarEventsWithCache).toHaveBeenCalledTimes(1);
  });

  it("reports a provider failure as error without returning the raw provider message", async () => {
    const providerMessage = "Google provider token secret-value was rejected";
    calendarMocks.isCalendarEnabled.mockReturnValue(true);
    calendarMocks.fetchCalendarEventsWithCache.mockRejectedValue(new Error(providerMessage));

    const { result } = renderScheduleData();

    await waitFor(() => expect(result.current.googleCalendarStatus).toBe("error"));
    expect(result.current.isLoadingGoogle).toBe(false);
    expect(result.current.googleEvents).toEqual([]);
    expect(JSON.stringify(result.current)).not.toContain(providerMessage);
    expect(calendarMocks.fetchCalendarEventsWithCache).toHaveBeenCalledTimes(1);
    expect(calendarMocks.loggerError).toHaveBeenCalledTimes(1);
    expect(calendarMocks.loggerError).toHaveBeenCalledWith(
      "[ScheduleTimeline] Google Calendar event load failed",
      { code: "GOOGLE_CALENDAR_LOAD_FAILED" },
    );
  });

  it("retries only on request and clears stale error state after a successful retry", async () => {
    const providerMessage = "calendar upstream response included private diagnostics";
    calendarMocks.isCalendarEnabled.mockReturnValue(true);
    calendarMocks.fetchCalendarEventsWithCache
      .mockRejectedValueOnce(new Error(providerMessage))
      .mockResolvedValueOnce([]);

    const { result } = renderScheduleData();

    await waitFor(() => expect(result.current.googleCalendarStatus).toBe("error"));
    expect(calendarMocks.fetchCalendarEventsWithCache).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.retryGoogleCalendar();
    });

    await waitFor(() => expect(result.current.googleCalendarStatus).toBe("ready"));
    expect(result.current.isLoadingGoogle).toBe(false);
    expect(JSON.stringify(result.current)).not.toContain(providerMessage);
    expect(calendarMocks.fetchCalendarEventsWithCache).toHaveBeenCalledTimes(2);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(calendarMocks.fetchCalendarEventsWithCache).toHaveBeenCalledTimes(2);
  });
});
