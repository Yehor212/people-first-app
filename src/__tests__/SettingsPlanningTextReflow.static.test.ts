import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const deviceSessionsSource = read("src/components/sync/DeviceSessionsCard.tsx");
const syncHealthSource = read("src/components/sync/SyncHealthCard.tsx");
const syncHealthPartsSource = read("src/components/sync/SyncHealthCardParts.tsx");
const scheduleTimelineSource = read("src/components/schedule/ScheduleTimeline.tsx");

describe("settings and planning text reflow contracts", () => {
  it("uses scalable type tokens instead of fixed tiny pixel sizes", () => {
    for (const source of [
      deviceSessionsSource,
      syncHealthSource,
      syncHealthPartsSource,
      scheduleTimelineSource,
    ]) {
      expect(source).not.toMatch(/text-\[(?:9|10|11)px\]/);
    }
  });

  it("lets sync metrics and inbox headings stack before labels compete for width", () => {
    expect(syncHealthSource).toContain('"grid-cols-1 min-[420px]:grid-cols-3"');
    expect(syncHealthSource).toContain(
      'className="flex flex-col items-start gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"',
    );
    expect(syncHealthSource).toContain("whitespace-normal break-words");
  });

  it("keeps pending actions and device names fully readable beside their controls", () => {
    expect(syncHealthSource).not.toContain("truncate");
    expect(syncHealthSource).toContain(
      'className="flex flex-col items-stretch gap-2 rounded-lg',
    );
    expect(syncHealthSource).toContain("min-[420px]:flex-row");

    expect(deviceSessionsSource).not.toContain("truncate");
    expect(deviceSessionsSource).toContain(
      'className="flex flex-col items-stretch gap-3 rounded-xl',
    );
    expect(deviceSessionsSource).toContain("min-[420px]:flex-row");
  });

  it("keeps planning sync status auto-height with a scalable label", () => {
    expect(scheduleTimelineSource).toContain("whitespace-normal break-words text-xs");
    expect(scheduleTimelineSource).toContain("text-muted-foreground");
    expect(scheduleTimelineSource).not.toContain("text-blue-600");
    expect(scheduleTimelineSource).not.toContain("text-[10px]");
  });
});
