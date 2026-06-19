import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

describe("EntryGate cross-platform safe areas", () => {
  it("uses web env and Capacitor SystemBars inset variables", () => {
    const css = readProjectFile("src/components/EntryGate.css");

    expect(css).toContain("env(safe-area-inset-bottom, 0px)");
    expect(css).toContain("var(--safe-area-inset-bottom, 0px)");
    expect(css).toContain("var(--zenflow-test-nav-inset-bottom, 0px)");
    expect(css).toContain("margin-block: calc(-1 * var(--entry-safe-top))");
    expect(css).toContain("calc(100dvh + var(--entry-safe-top) + var(--entry-safe-bottom))");
  });

  it("delegates Android WebView insets to the SafeArea plugin instead of SystemBars CSS injection", () => {
    const capacitorConfig = readProjectFile("capacitor.config.ts");

    expect(capacitorConfig).toContain("SystemBars");
    expect(capacitorConfig).toContain('insetsHandling: "disable"');
    expect(capacitorConfig).not.toContain('insetsHandling: "css"');
    expect(capacitorConfig).toContain("SafeArea");
    expect(capacitorConfig).toContain("initialViewportFitCover: true");
    expect(capacitorConfig).toContain('style: "DEFAULT"');
  });

  it("paints non-flat edge bleed backgrounds for light and ink entry surfaces", () => {
    const css = readProjectFile("src/components/EntryGate.css");

    expect(css).toContain("--entry-edge-bleed-background");
    expect(css).toContain("--entry-ink-edge-bleed-background");
    expect(css).toContain("linear-gradient(90deg");
    expect(css).toContain("radial-gradient(ellipse 112% 20% at 50% -4%");
    expect(css).toContain("background: var(--entry-edge-bleed-background)");
    expect(css).toContain("background: var(--entry-ink-edge-bleed-background)");
  });

  it("keeps the entry brand below native status areas in the V2 edge-to-edge shell", () => {
    const css = readProjectFile("src/components/EntryGate.css");

    expect(css).toContain("--entry-brand-clearance");
    expect(css).toContain("padding-block-start: calc(var(--entry-safe-top) + var(--entry-brand-clearance))");
    expect(css).toContain("body.zenflow-v2-edge-to-edge .entry-gate-screen");
    expect(css).toContain("margin-block-start: 0");
    expect(css).toContain("min-height: 100dvh");
  });

  it("declares an ink-specific dark parity treatment for Android and iOS entry surfaces", () => {
    const css = readProjectFile("src/components/EntryGate.css");

    expect(css).toContain('.entry-gate-screen[data-entry-theme="ink"]');
    expect(css).toContain('.entry-gate-screen[data-entry-theme="ink"] .entry-gate-aurora');
    expect(css).toContain('.entry-gate-screen[data-entry-theme="ink"] .entry-glass-panel');
    expect(css).toContain(
      '.entry-gate-screen[data-entry-theme="ink"] [data-testid="entry-theme-switcher"].entry-action-tile'
    );
    expect(css).toContain(
      '.entry-gate-screen[data-entry-theme="ink"] .entry-glass-panel .entry-action-tile'
    );
    expect(css).toContain("--entry-ink-panel-top");
    expect(css).toContain("--entry-ink-action-surface");
  });
});
