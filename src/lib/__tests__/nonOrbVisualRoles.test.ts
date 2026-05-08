import { describe, expect, it } from "vitest";
import {
  getHabitCategoryVisualRole,
  getHabitRoleTone,
  getHabitStarterPlayTone,
  getNavVisualRole,
  getRoleTone,
  getSpaceVisualRole,
  getTemplateCategoryVisualRole,
  getTimeOfDayVisualRole,
} from "../nonOrbVisualRoles";

function extractBgAlpha(className: string): number {
  const match = /bg-\[hsl\(var\(--zf-role-[^)]+\)\/(0\.\d+)\)\]/.exec(className);
  return match ? Number(match[1]) : 0;
}

describe("nonOrbVisualRoles", () => {
  it("maps habit categories to distinct wellness roles", () => {
    expect(getHabitCategoryVisualRole("health")).toBe("body");
    expect(getHabitCategoryVisualRole("mindfulness")).toBe("mind");
    expect(getHabitCategoryVisualRole("productivity")).toBe("focus");
    expect(getHabitCategoryVisualRole("self-care")).toBe("rest");
    expect(getHabitCategoryVisualRole("creativity")).toBe("release");
    expect(getHabitCategoryVisualRole("finance")).toBe("focus");
    expect(getHabitCategoryVisualRole("social")).toBe("mind");
    expect(getHabitCategoryVisualRole("other")).toBe("space");
  });

  it("keeps template tabs and time groups multi-hue", () => {
    expect(getTemplateCategoryVisualRole("body")).toBe("body");
    expect(getTemplateCategoryVisualRole("mind")).toBe("mind");
    expect(getTemplateCategoryVisualRole("focus")).toBe("focus");
    expect(getTemplateCategoryVisualRole("rest")).toBe("rest");
    expect(getTemplateCategoryVisualRole("quit")).toBe("release");

    expect(getTimeOfDayVisualRole("morning")).toBe("energy");
    expect(getTimeOfDayVisualRole("afternoon")).toBe("focus");
    expect(getTimeOfDayVisualRole("evening")).toBe("rest");
    expect(getTimeOfDayVisualRole("anytime")).toBe("body");
  });

  it("uses stronger habit tones without making all non-orb surfaces loud", () => {
    const standardTone = getRoleTone("body");
    const habitTone = getHabitRoleTone("body");

    expect(extractBgAlpha(standardTone.surfaceClass)).toBeLessThan(0.16);
    expect(extractBgAlpha(habitTone.surfaceClass)).toBeGreaterThanOrEqual(0.3);
    expect(extractBgAlpha(habitTone.activeSurfaceClass)).toBeGreaterThanOrEqual(0.46);
    expect(extractBgAlpha(habitTone.iconClass)).toBeGreaterThanOrEqual(0.4);
    expect(habitTone.gradientClass).toContain("/0.62");
    expect(habitTone.gradientClass).not.toContain("/0.07");
  });

  it("gives routine starters distinct playful companion stamp tones", () => {
    const starterIds = [
      "drink-water",
      "walk-distance",
      "exercise",
      "read",
      "meditate",
      "sleep",
    ] as const;

    const tones = starterIds.map((id) => getHabitStarterPlayTone(id));

    expect(new Set(tones.map((tone) => tone.role)).size).toBeGreaterThanOrEqual(5);
    for (const tone of tones) {
      expect(tone.tileClass).toContain("linear-gradient");
      expect(tone.tileClass).toContain("border-[hsl");
      expect(tone.iconClass).toContain("hsl(var(");
      expect(tone.proofClass).toContain("hsl(var(");
    }
    expect(getHabitStarterPlayTone("unknown-template").role).toBe("space");
  });

  it("separates drawer destinations without touching orb rendering", () => {
    expect(getNavVisualRole("habits")).toBe("body");
    expect(getNavVisualRole("diary")).toBe("diary");
    expect(getNavVisualRole("settings")).toBe("settings");
    expect(getNavVisualRole("orb")).toBe("mind");
  });

  it("makes gratitude garden stable and user folders varied", () => {
    expect(
      getSpaceVisualRole({
        id: "space-gratitude",
        autoSource: "gratitude",
        coverKey: "gratitude",
      }),
    ).toBe("gratitude");

    const projectRole = getSpaceVisualRole({
      id: "space-projects",
      coverKey: "folder",
      accent: "sky",
    });
    const privateRole = getSpaceVisualRole({
      id: "space-private",
      private: true,
      coverKey: "folder",
    });

    expect(projectRole).not.toBe("gratitude");
    expect(privateRole).toBe("rest");
  });
});
