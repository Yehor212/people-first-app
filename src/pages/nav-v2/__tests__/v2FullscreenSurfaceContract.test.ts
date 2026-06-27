import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const v2FullscreenPages = [
  {
    id: "orb",
    source: "src/pages/nav-v2/OrbPage.tsx",
    testId: "orb-page",
  },
  {
    id: "habits",
    source: "src/pages/nav-v2/habits/HabitsPage.tsx",
    testId: "habits-page",
  },
  {
    id: "diary",
    source: "src/pages/nav-v2/DiaryPage.tsx",
    testId: "diary-page",
  },
  {
    id: "planning",
    source: "src/pages/nav-v2/planning/PlanningPage.tsx",
    testId: "planning-page",
  },
  {
    id: "settings",
    source: "src/pages/nav-v2/settings/components/SettingsPageComponents.tsx",
    testId: "settings-page",
  },
] as const;

describe("V2 fullscreen surface contract", () => {
  it("uses one V2-owned document fullscreen mode instead of body safe-area gutters", () => {
    const indexSource = read("src/pages/Index.tsx");
    const css = read("src/index.css");
    const navSource = read("src/components/navigation-v2/NavV2Orchestrator.tsx");

    expect(indexSource).toContain("useV2FullscreenSurface");
    expect(css).toContain(".zenflow-v2-edge-to-edge");
    expect(css).toContain("padding-top: 0");
    expect(css).toContain("padding-bottom: 0");
    expect(css).toContain("--v2-edge-bleed-background");
    expect(css).toContain("background: var(--v2-edge-bleed-background)");
    expect(navSource).toContain("v2-edge-to-edge-surface");
    expect(navSource).toContain('data-fullscreen-surface="v2"');
  });

  it("defines shared viewport and safe-area fallbacks for browser, PWA, and Capacitor WebView", () => {
    const css = read("src/index.css");
    const capacitorConfig = read("capacitor.config.ts");

    expect(css).toContain("--app-viewport-height: 100vh");
    expect(css).toContain("--app-viewport-height: 100dvh");
    expect(css).toContain("max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))");
    expect(css).toContain("max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px))");
    expect(capacitorConfig).toContain("SystemBars");
    expect(capacitorConfig).toContain('insetsHandling: "disable"');
    expect(capacitorConfig).toContain("SafeArea");
    expect(capacitorConfig).toContain("initialViewportFitCover: true");
    expect(capacitorConfig).toContain('contentInset: "never"');
    expect(capacitorConfig).not.toContain('contentInset: "automatic"');
    expect(capacitorConfig).not.toContain('insetsHandling: "css"');
  });

  it("paints a non-flat shared edge bleed behind every V2 page", () => {
    const css = read("src/index.css");

    expect(css).toContain("--v2-edge-bleed-background");
    expect(css).toContain("linear-gradient(90deg");
    expect(css).toContain("radial-gradient(ellipse 105% 18% at 50% -2%");
    expect(css).toContain("html.zenflow-v2-edge-to-edge");
    expect(css).toContain("body.zenflow-v2-edge-to-edge #root");
    expect(css).toContain(".v2-edge-to-edge-surface");
    expect(css).not.toContain("background: hsl(var(--background));\n  }\n\n  body.zenflow-v2-edge-to-edge");
  });

  it("keeps every V2 route on the shared fullscreen page layer", () => {
    for (const page of v2FullscreenPages) {
      const source = read(page.source);

      expect(source).toContain(`data-testid="${page.testId}"`);
      expect(source).toContain(`data-v2-readable-page="${page.id}"`);
      expect(source).toContain("v2-fullscreen-page");
      expect(source).toContain("var(--app-viewport-height)");
      expect(source).not.toContain("h-[100svh]");
      expect(source).not.toContain("min-h-[100svh]");
    }

    const journalModuleSource = read("src/features/journal/JournalModule.tsx");
    expect(journalModuleSource).toContain("v2-fullscreen-page");
    expect(journalModuleSource).toContain("var(--app-viewport-height)");
    expect(journalModuleSource).not.toContain("h-[100svh]");
    expect(journalModuleSource).not.toContain("min-h-[100svh]");
  });

  it("keeps V2 fullscreen overlays off legacy viewport units", () => {
    const overlaySources = [
      read("src/features/journal/JournalEntryEditor.tsx"),
      read("src/features/journal/JournalModule.tsx"),
    ];

    for (const source of overlaySources) {
      expect(source).toContain("var(--app-viewport-height)");
      expect(source).not.toContain("h-screen");
      expect(source).not.toContain("100svh");
    }
  });
});
