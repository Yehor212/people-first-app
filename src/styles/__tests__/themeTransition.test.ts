import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("global theme transition CSS", () => {
  it("uses one two-phase pointer-transparent opacity veil without blur or page snapshots", () => {
    const css = readFileSync("src/index.css", "utf8");
    const start = css.indexOf("/* Theme transition veil start */");
    const end = css.indexOf("/* Theme transition veil end */");

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const block = css.slice(start, end);
    expect(block).toContain(".theme-transition-veil");
    expect(block).toContain(".theme-transition-veil--enter");
    expect(block).toContain(".theme-transition-veil--release");
    expect(block).toContain("pointer-events: none");
    expect(block).toContain("opacity: 0");
    expect(block).toContain("opacity: 0.96");
    expect(block).toContain("transition-duration: 96ms");
    expect(block).toContain("transition-duration: 180ms");
    expect(block).toContain("cubic-bezier(0.3, 0, 1, 1)");
    expect(block).toContain("cubic-bezier(0.2, 0, 0, 1)");
    expect(block).not.toMatch(/backdrop-filter|filter:\s*blur|view-transition|transform:/);
    expect(block).toContain("will-change: opacity");
    expect(block).not.toContain("data-theme-transition");
  });

  it("releases Android drawer blur surfaces only while the theme veil is active", () => {
    const css = readFileSync("src/index.css", "utf8");

    expect(css).toMatch(
      /\.drawer-v2-backdrop-partitioned\.theme-transition-blur-released::before[\s\S]*?backdrop-filter:\s*none\s*!important;/,
    );
    expect(css).toMatch(
      /\.drawer-v2-panel-partitioned\.theme-transition-blur-released[\s\S]*?backdrop-filter:\s*none\s*!important;/,
    );
  });

  it("keeps the palette atomic without stopping CSS animations or canonical canvases", () => {
    const css = readFileSync("src/index.css", "utf8");
    const start = css.indexOf("/* Atomic theme palette start */");
    const end = css.indexOf("/* Atomic theme palette end */");

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const block = css.slice(start, end);
    expect(block).toContain("html.theme-transition-palette-atomic");
    expect(block).toContain("transition-property: none !important");
    expect(block).toContain("html.theme-transition-palette-atomic body > div");
    expect(block).toContain("html.theme-transition-palette-atomic .card");
    expect(block).toContain("html.theme-transition-palette-atomic main");
    expect(block).toContain("html.theme-transition-palette-atomic aside");
    expect(block).toMatch(
      /html\.theme-transition-palette-atomic button\s*\{[\s\S]*?transition-property:\s*transform, opacity\s*!important;/
    );
    expect(block).not.toMatch(/html\.theme-transition-palette-atomic\s+\*/);
    expect(block).not.toMatch(/animation(?:-name|-duration)?:/);
    expect(block).not.toMatch(/canvas|ValenceOrb|MiniValenceOrb/);
  });
});
