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
  });

  it("keeps Android WebView SystemBars CSS inset injection enabled", () => {
    const capacitorConfig = readProjectFile("capacitor.config.ts");

    expect(capacitorConfig).toContain("SystemBars");
    expect(capacitorConfig).toContain('insetsHandling: "css"');
    expect(capacitorConfig).toContain('style: "DEFAULT"');
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
