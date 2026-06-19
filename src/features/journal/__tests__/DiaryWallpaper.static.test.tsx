import { existsSync, readFileSync } from "node:fs";

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const themeState = vi.hoisted(() => ({
  appliedTheme: "paper",
}));

vi.mock("@/stores/themeStore", () => ({
  useThemeStore: (selector: (state: { appliedTheme: string }) => unknown) =>
    selector(themeState),
}));

import { DiaryWallpaper } from "../DiaryWallpaper";

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

function extractWallpaperCss(source: string): string {
  const start = source.indexOf("/* Diary day/night wallpaper:");
  const end = source.indexOf("/* Diary paper panels:", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("Diary wallpaper contract", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    themeState.appliedTheme = "paper";
  });

  it("mounts one unified day/night wallpaper layer in the V2 diary page shell", () => {
    const moduleSource = readSource("src/features/journal/JournalModule.tsx");

    expect(moduleSource).toContain('import { DiaryWallpaper } from "./DiaryWallpaper";');
    expect(moduleSource).toContain('<DiaryWallpaper surface="page"');
    expect(moduleSource).toContain('showWallpaper={!isPagePresentation}');
    expect(moduleSource).not.toContain('data-testid="journal-light-atmosphere"');
  });

  it("keeps the empty diary canvas on the same wallpaper system", () => {
    const emptyCanvasSource = readSource("src/features/journal/DiaryEmptyCanvas.tsx");

    expect(emptyCanvasSource).toContain('import { DiaryWallpaper } from "./DiaryWallpaper";');
    expect(emptyCanvasSource).toContain('showWallpaper = true');
    expect(emptyCanvasSource).toContain('{showWallpaper && <DiaryWallpaper surface="empty" />}');
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

  it("updates paper theme tone at the live day to night boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T18:59:30"));
    themeState.appliedTheme = "paper";

    render(<DiaryWallpaper />);

    const wallpaper = screen.getByTestId("journal-wallpaper");
    expect(wallpaper).toHaveAttribute("data-wallpaper-tone", "day");

    act(() => {
      vi.setSystemTime(new Date("2026-06-17T19:00:00"));
      vi.advanceTimersByTime(30_000);
    });

    expect(wallpaper).toHaveAttribute("data-wallpaper-tone", "night");
  });

  it("updates paper theme tone at the live night to day boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T05:59:30"));
    themeState.appliedTheme = "paper";

    render(<DiaryWallpaper />);

    const wallpaper = screen.getByTestId("journal-wallpaper");
    expect(wallpaper).toHaveAttribute("data-wallpaper-tone", "night");

    act(() => {
      vi.setSystemTime(new Date("2026-06-18T06:00:00"));
      vi.advanceTimersByTime(30_000);
    });

    expect(wallpaper).toHaveAttribute("data-wallpaper-tone", "day");
  });

  it("keeps the premium wallpaper self-contained and theme-specific for all platforms", () => {
    const wallpaperSource = readSource("src/features/journal/DiaryWallpaper.tsx");
    const wallpaperCss = extractWallpaperCss(readSource("src/index.css"));

    expect(wallpaperSource).toContain('data-wallpaper-motion="static"');
    expect(wallpaperSource).toContain("journal-wallpaper__prism-field");
    expect(wallpaperSource).toContain("journal-wallpaper__starlace");
    expect(wallpaperSource).toContain("journal-wallpaper__margin-map");
    expect(wallpaperSource).toContain("journal-wallpaper__safe-frame");
    expect(wallpaperSource).toContain("journal-wallpaper__memory-bloom");
    expect(wallpaperSource).toContain("journal-wallpaper__luminance-wash");

    expect(wallpaperCss).toContain(".journal-wallpaper--day .journal-wallpaper__prism-field");
    expect(wallpaperCss).toContain(".journal-wallpaper--night .journal-wallpaper__starlace");
    expect(wallpaperCss).toContain(".journal-wallpaper__margin-map");
    expect(wallpaperCss).toContain(".journal-wallpaper__safe-frame");
    expect(wallpaperCss).toContain(".journal-wallpaper--day .journal-wallpaper__memory-bloom");
    expect(wallpaperCss).toContain(".journal-wallpaper--night .journal-wallpaper__luminance-wash");
    expect(wallpaperCss).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(wallpaperCss).not.toContain("url(");
    expect(wallpaperCss).not.toContain("@keyframes");
  });

  it("defines a universal premium wallpaper scene for Web, PWA, and native wrappers", () => {
    const wallpaperSource = readSource("src/features/journal/DiaryWallpaper.tsx");
    const wallpaperCss = extractWallpaperCss(readSource("src/index.css"));

    expect(wallpaperSource).toContain('data-wallpaper-platform="universal"');
    expect(wallpaperSource).toContain("journal-wallpaper__daybreak-arc");
    expect(wallpaperSource).toContain("journal-wallpaper__moon-gate");
    expect(wallpaperSource).toContain("journal-wallpaper__ink-river");
    expect(wallpaperSource).toContain("journal-wallpaper__quiet-grain");
    expect(wallpaperSource).toContain("journal-wallpaper__desktop-vista");

    expect(wallpaperCss).toContain(".journal-wallpaper--day .journal-wallpaper__daybreak-arc");
    expect(wallpaperCss).toContain(".journal-wallpaper--night .journal-wallpaper__moon-gate");
    expect(wallpaperCss).toContain(".journal-wallpaper__ink-river");
    expect(wallpaperCss).toContain(".journal-wallpaper__quiet-grain");
    expect(wallpaperCss).toContain("@media (min-width: 1024px)");
    expect(wallpaperCss).toContain("@media (orientation: landscape) and (max-height: 540px)");
    expect(wallpaperCss).toContain("@media (prefers-reduced-data: reduce)");
    expect(wallpaperCss).toContain("@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))");
    expect(wallpaperCss).not.toContain("background-attachment: fixed");
  });
});
