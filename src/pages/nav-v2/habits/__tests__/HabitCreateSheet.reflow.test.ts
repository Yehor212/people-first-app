import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/pages/nav-v2/habits/HabitCreateSheet.tsx", "utf8");

describe("HabitCreateSheet viewport and text reflow contract", () => {
  it("uses the live app viewport and safe areas instead of raw vh", () => {
    expect(source).toContain(
      "mt-24 flex !h-[calc(var(--app-viewport-height)-var(--safe-top)-0.75rem)] max-h-[calc(var(--app-viewport-height)-var(--safe-top)-0.75rem)]",
    );
    expect(source).toContain(
      "max-h-[calc(var(--app-viewport-height)-var(--safe-top)-0.75rem)]",
    );
    expect(source).not.toContain("max-h-[92vh]");
    expect(source).toContain("var(--safe-inline-start)");
    expect(source).toContain("var(--safe-inline-end)");
    expect(source).toContain("var(--safe-bottom)");
  });

  it("keeps the translated title and final form actions reachable", () => {
    expect(source).toContain("overflow-y-auto overscroll-contain");
    expect(source).toContain("min-w-0 whitespace-normal break-words");
    expect(source).toContain("[hyphens:manual] [overflow-wrap:break-word]");
    expect(source).toContain("pb-[max(1.5rem,var(--safe-bottom))]");
  });
});
