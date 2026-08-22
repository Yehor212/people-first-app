import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("V2 readability contract", () => {

  it("opts every V2 route shell into the shared readable page layer", () => {
    const routeSources = [
      readFileSync("src/pages/nav-v2/OrbPage.tsx", "utf8"),
      readFileSync("src/pages/nav-v2/habits/HabitsPage.tsx", "utf8"),
      readFileSync("src/pages/nav-v2/DiaryPage.tsx", "utf8"),
      readFileSync("src/pages/nav-v2/planning/PlanningPage.tsx", "utf8"),
      readFileSync("src/pages/nav-v2/settings/components/SettingsPageComponents.tsx", "utf8"),
    ];

    for (const source of routeSources) {
      expect(source).toContain("data-v2-readable-page");
      expect(source).toContain("v2-readable-page");
    }
  });

  it("defines a V2 readability veil, text shadow, and stronger muted text tokens", () => {
    const css = readFileSync("src/index.css", "utf8");

    expect(css).toContain(".v2-readable-page");
    expect(css).toContain("--v2-readable-veil");
    expect(css).toContain("--v2-readable-text-shadow");
    expect(css).toContain("--v2-readable-muted");
    expect(css).toContain("--v2-readable-accent");
    expect(css).toContain("text-primary/");
    expect(css).toContain("-webkit-backdrop-filter");
  });

  it("keeps the Android readability veil without a full-viewport backdrop surface", () => {
    const css = readFileSync("src/index.css", "utf8");
    const selector =
      ':root[data-platform="android"] .v2-readable-page--ambient::before';
    const selectorStart = css.indexOf(selector);

    expect(selectorStart).toBeGreaterThan(-1);

    const rule = css.slice(selectorStart, css.indexOf("}", selectorStart) + 1);
    expect(rule).toContain("-webkit-backdrop-filter: none;");
    expect(rule).toContain("backdrop-filter: none;");
    expect(rule).not.toContain("display: none");
  });
});
