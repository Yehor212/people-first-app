import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

const roleToneCss = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

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

    expect(standardTone.cssVar).toBe("--zf-role-body");
    expect(habitTone.cssVar).toBe("--zf-role-body");
    expect(standardTone.surfaceClass).toBe("zf-role-surface");
    expect(habitTone.surfaceClass).toBe("zf-habit-role-surface");
    expect(habitTone.activeSurfaceClass).toBe("zf-habit-role-surface-active");
    expect(habitTone.iconClass).toBe("zf-habit-role-icon");
    expect(habitTone.gradientClass).toBe("zf-habit-role-gradient");
    expect(roleToneCss).toContain(".zf-role-surface");
    expect(roleToneCss).toContain("background-color: hsl(var(--habit-role, var(--zf-role-space)) / 0.08)");
    expect(roleToneCss).toContain(".zf-habit-role-surface");
    expect(roleToneCss).toContain("background-color: hsl(var(--habit-role, var(--zf-role-space)) / 0.30)");
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
      expect(tone.tileClass).toBe("zf-habit-starter-tile");
      expect(tone.iconClass).toBe("zf-habit-starter-icon");
      expect(tone.proofClass).toBe("zf-habit-starter-proof");
      expect(tone.haloClass).toBe("zf-habit-starter-halo");
    }
    expect(roleToneCss).toContain(".zf-habit-starter-tile");
    expect(roleToneCss).toContain("linear-gradient(");
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
