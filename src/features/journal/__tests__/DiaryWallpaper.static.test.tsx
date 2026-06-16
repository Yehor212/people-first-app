import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

describe("Diary wallpaper contract", () => {
  it("mounts one unified day/night wallpaper layer in the V2 diary page shell", () => {
    const moduleSource = readSource("src/features/journal/JournalModule.tsx");

    expect(moduleSource).toContain('import { DiaryWallpaper } from "./DiaryWallpaper";');
    expect(moduleSource).toContain('<DiaryWallpaper surface="page"');
    expect(moduleSource).not.toContain('data-testid="journal-light-atmosphere"');
  });

  it("keeps the empty diary canvas on the same wallpaper system", () => {
    const emptyCanvasSource = readSource("src/features/journal/DiaryEmptyCanvas.tsx");

    expect(emptyCanvasSource).toContain('import { DiaryWallpaper } from "./DiaryWallpaper";');
    expect(emptyCanvasSource).toContain('<DiaryWallpaper surface="empty"');
  });

  it("uses tokenized CSS with day, night, and forced-colors support", () => {
    expect(existsSync("src/features/journal/DiaryWallpaper.tsx")).toBe(true);

    const wallpaperSource = readSource("src/features/journal/DiaryWallpaper.tsx");
    const cssSource = readSource("src/index.css");

    expect(wallpaperSource).toContain('data-testid="journal-wallpaper"');
    expect(wallpaperSource).toContain("journal-wallpaper--day");
    expect(wallpaperSource).toContain("journal-wallpaper--night");
    expect(wallpaperSource).toContain("journal-wallpaper--paper");
    expect(wallpaperSource).toContain("journal-wallpaper__constellation");
    expect(wallpaperSource).toContain("journal-wallpaper__sheet");
    expect(wallpaperSource).toContain("journal-wallpaper__botanical");
    expect(wallpaperSource).toContain("journal-wallpaper__veil");
    expect(cssSource).toContain(".journal-wallpaper");
    expect(cssSource).toContain(".journal-wallpaper--day {");
    expect(cssSource).toContain(".journal-wallpaper--night");
    expect(cssSource).toContain(".journal-wallpaper--paper");
    expect(cssSource).toContain("\n.journal-wallpaper__constellation {");
    expect(cssSource).toContain("\n.journal-wallpaper__sheet {");
    expect(cssSource).toContain("\n.journal-wallpaper__botanical {");
    expect(cssSource).toContain(".journal-wallpaper--night ~ .relative :where");
    expect(cssSource).toContain("@media (forced-colors: active)");
    expect(cssSource).not.toContain("@keyframes journal-wallpaper");
  });
});
