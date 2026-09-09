import { afterEach, describe, expect, it, vi } from "vitest";

const { platform } = vi.hoisted(() => ({ platform: { isAndroid: true } }));
vi.mock("@/lib/platform", () => platform);

const NativeDateTimeFormat = Intl.DateTimeFormat;
const NativeNumberFormat = Intl.NumberFormat;

function spyDateTimeFormat() {
  return vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (locales, options) {
    return new NativeDateTimeFormat(locales, options);
  });
}

function spyNumberFormat() {
  return vi.spyOn(Intl, "NumberFormat").mockImplementation(function (locales, options) {
    return new NativeNumberFormat(locales, options);
  });
}

afterEach(async () => {
  await Promise.resolve();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  platform.isAndroid = true;
});

async function loadFormatting() {
  return import("../scheduleFormatting");
}

describe("Android schedule formatting work", () => {
  it("constructs one time formatter for an entire synchronous timeline render", async () => {
    const { formatScheduleTime } = await loadFormatting();
    const constructor = spyDateTimeFormat();

    for (let day = 0; day < 5; day += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        expect(formatScheduleTime("en", hour, 0)).toBe(
          new NativeDateTimeFormat("en", { hour: "2-digit", minute: "2-digit" })
            .format(new Date(2000, 0, 1, hour, 0)),
        );
      }
    }

    expect(constructor).toHaveBeenCalledTimes(1);
  });

  it("shares equivalent number formatting without mixing two-digit input options", async () => {
    const { formatScheduleDayNumber, formatScheduleNumber, formatScheduleNumericPart } =
      await loadFormatting();
    const constructor = spyNumberFormat();

    for (let day = 1; day <= 28; day += 1) {
      const date = `2026-02-${String(day).padStart(2, "0")}`;
      expect(formatScheduleDayNumber(date, "ar")).toBe(
        new NativeNumberFormat("ar", { useGrouping: false }).format(day),
      );
      expect(formatScheduleNumber("ar", day)).toBe(
        new NativeNumberFormat("ar", { useGrouping: false }).format(day),
      );
      expect(formatScheduleNumericPart("ar", day)).toBe(
        new NativeNumberFormat("ar", { useGrouping: false, minimumIntegerDigits: 2 }).format(day),
      );
    }

    expect(constructor).toHaveBeenCalledTimes(2);
  });

  it("discards formatters at the microtask checkpoint instead of retaining a timezone snapshot", async () => {
    const { formatScheduleTime } = await loadFormatting();
    const constructor = spyDateTimeFormat();
    formatScheduleTime("en", 9, 0);
    formatScheduleTime("en", 10, 0);
    expect(constructor).toHaveBeenCalledTimes(1);

    await Promise.resolve();

    formatScheduleTime("en", 9, 0);
    expect(constructor).toHaveBeenCalledTimes(2);
  });

  it("does not share work between different active languages", async () => {
    const { formatScheduleTime } = await loadFormatting();
    const constructor = spyDateTimeFormat();
    for (const language of ["en", "ar", "en", "ar"]) {
      expect(formatScheduleTime(language, 13, 5)).toBe(
        new NativeDateTimeFormat(language, { hour: "2-digit", minute: "2-digit" })
          .format(new Date(2000, 0, 1, 13, 5)),
      );
    }
    expect(constructor).toHaveBeenCalledTimes(2);
  });

  it("leaves the non-Android construction path unchanged", async () => {
    platform.isAndroid = false;
    const { formatScheduleTime } = await loadFormatting();
    const constructor = spyDateTimeFormat();
    formatScheduleTime("en", 9, 0);
    formatScheduleTime("en", 10, 0);
    expect(constructor).toHaveBeenCalledTimes(2);
  });

  it("reuses full-date and weekday preparation without mixing their formats", async () => {
    const { formatScheduleDateLabel } = await loadFormatting();
    const { formatDayShort } = await import("../constants");
    const constructor = spyDateTimeFormat();
    for (let day = 1; day <= 28; day += 1) {
      const date = `2026-02-${String(day).padStart(2, "0")}`;
      const localDate = new Date(2026, 1, day);
      expect(formatScheduleDateLabel(date, "he")).toBe(
        new NativeDateTimeFormat("he", { dateStyle: "full" }).format(localDate),
      );
      expect(formatDayShort(date, "he").weekday).toBe(
        new NativeDateTimeFormat("he", { weekday: "short" }).format(localDate),
      );
    }
    expect(constructor).toHaveBeenCalledTimes(2);
  });

  it("bounds preparation even when one task requests many locale tags", async () => {
    const { formatScheduleTime } = await loadFormatting();
    const constructor = spyDateTimeFormat();
    for (let i = 0; i < 40; i += 1) {
      formatScheduleTime(`en-x-${String(i).padStart(3, "0")}`, 9, 0);
    }
    expect(constructor).toHaveBeenCalledTimes(40);
    formatScheduleTime("en-x-000", 9, 0);
    expect(constructor).toHaveBeenCalledTimes(40);
    formatScheduleTime("en-x-039", 9, 0);
    expect(constructor).toHaveBeenCalledTimes(41);
  });

  it("does not cache invalid locale errors or change subsequent valid output", async () => {
    const { formatScheduleTime } = await loadFormatting();
    expect(() => formatScheduleTime("en-_", 9, 0)).toThrow(RangeError);
    expect(() => formatScheduleTime("en-_", 9, 0)).toThrow(RangeError);
    expect(formatScheduleTime("en", 9, 0)).toBe(
      new NativeDateTimeFormat("en", { hour: "2-digit", minute: "2-digit" })
        .format(new Date(2000, 0, 1, 9, 0)),
    );
  });

  it("uses the original uncached path when microtask cleanup is unavailable", async () => {
    const { formatScheduleTime } = await loadFormatting();
    vi.stubGlobal("queueMicrotask", undefined);
    const constructor = spyDateTimeFormat();
    formatScheduleTime("en", 9, 0);
    formatScheduleTime("en", 10, 0);
    expect(constructor).toHaveBeenCalledTimes(2);
  });

  it.each(["en", "uk", "es", "de", "fr", "ja", "ar", "he"])(
    "preserves exact locale output for %s",
    async (language) => {
      const { formatScheduleTime, formatScheduleDayNumber, formatScheduleNumericPart,
        formatScheduleDateLabel, formatScheduleWeekday } =
        await loadFormatting();
      for (const hour of [0, 9, 13, 23]) {
        expect(formatScheduleTime(language, hour, 5)).toBe(
          new NativeDateTimeFormat(language, { hour: "2-digit", minute: "2-digit" })
            .format(new Date(2000, 0, 1, hour, 5)),
        );
      }
      expect(formatScheduleDayNumber("2026-09-08", language)).toBe(
        new NativeNumberFormat(language, { useGrouping: false }).format(8),
      );
      expect(formatScheduleNumericPart(language, 8)).toBe(
        new NativeNumberFormat(language, { minimumIntegerDigits: 2, useGrouping: false }).format(8),
      );
      const localDate = new Date(2026, 8, 8);
      expect(formatScheduleDateLabel("2026-09-08", language)).toBe(
        new NativeDateTimeFormat(language, { dateStyle: "full" }).format(localDate),
      );
      expect(formatScheduleWeekday("2026-09-08", language)).toBe(
        new NativeDateTimeFormat(language, { weekday: "short" }).format(localDate),
      );
    },
  );
});
