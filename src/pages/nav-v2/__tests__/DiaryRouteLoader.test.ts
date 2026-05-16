import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const diaryPageSource = readFileSync("src/pages/nav-v2/DiaryPage.tsx", "utf8");
const journalModuleSource = readFileSync("src/features/journal/JournalModule.tsx", "utf8");
const memoryPortalSource = readFileSync("src/features/journal/MemoryPortalCanvas.tsx", "utf8");
const indexSource = readFileSync("src/pages/Index.tsx", "utf8");
const authGateSource = readFileSync("src/components/AuthGate.tsx", "utf8");
const packageSource = readFileSync("package.json", "utf8");
const viteConfigSource = readFileSync("vite.config.ts", "utf8");
const v2SplashSmokeSource = readFileSync("scripts/smoke-v2-splash.cjs", "utf8");
const devPerformanceSource = readFileSync("scripts/diagnose-dev-performance.cjs", "utf8");

describe("V2 diary loading surface", () => {
  it("keeps every full-screen V2 loading surface bound to the active theme", () => {
    expect(indexSource).toContain("useThemeStore");
    expect(indexSource).toContain("const appliedTheme = useThemeStore((s) => s.appliedTheme)");
    expect(indexSource).toContain("<AuthGate isLoading={isLoading} splashTheme={appliedTheme}>");
    expect(indexSource).not.toContain("splashPreview");

    expect(authGateSource).toContain("splashTheme?: SplashThemePreference");
    expect(authGateSource).toContain("theme={splashTheme}");
    expect(authGateSource).toContain("if (splashTheme)");

    const v2LoadingSources = [
      indexSource,
      authGateSource,
      diaryPageSource,
      journalModuleSource,
      memoryPortalSource,
    ];

    for (const source of v2LoadingSources) {
      expect(source).not.toContain('theme="ink"');
      expect(source).not.toContain('theme="paper"');
      expect(source).not.toContain('theme="oled"');
      expect(source).not.toContain('scene="launch"');
    }
  });

  it("uses the shared theme-aware splash immediately for diary entry loading", () => {
    expect(diaryPageSource).toContain("useThemeStore");
    expect(diaryPageSource).toContain("theme={appliedTheme}");
    expect(diaryPageSource).toContain("loadingTheme={appliedTheme}");

    for (const source of [journalModuleSource, memoryPortalSource]) {
      expect(source).toContain("<SplashScreen");
      expect(source).toContain("loadingTheme");
      expect(source).toContain("theme={loadingTheme}");
      expect(source).toContain("instant");
      expect(source).not.toContain('theme="ink"');
    }
  });

  it("keeps the V2 splash smoke test on the real boot route", () => {
    expect(packageSource).toContain('"smoke:v2-splash": "node scripts/smoke-v2-splash.cjs"');
    expect(v2SplashSmokeSource).toContain("/people-first-app/orb?nav=v2&navLayout=phone");
    expect(v2SplashSmokeSource).toContain("data-testid=\"splash-theme-shell\"");
    expect(v2SplashSmokeSource).toContain("expectedScene: \"day\"");
    expect(v2SplashSmokeSource).toContain("expectedScene: \"night\"");
    expect(v2SplashSmokeSource).toContain("splashPreview");
    expect(v2SplashSmokeSource).not.toContain("/people-first-app/orb?nav=v2&dev=true");
  });

  it("mounts the shared ordered sync runtime for direct V2 routes", () => {
    expect(indexSource).toContain("useTelegramGradeSyncRuntime");
    expect(indexSource).toContain("useTelegramGradeSyncRuntime();");
    expect(indexSource).not.toContain('from "@/hooks/useDeltaSyncEffects"');
  });

  it("keeps local performance diagnostics explicit and excludes heavy generated folders from Vite watches", () => {
    expect(packageSource).toContain(
      '"diagnose:dev-performance": "node scripts/diagnose-dev-performance.cjs"',
    );
    expect(devPerformanceSource).toContain("watcherSensitiveDirs");

    for (const ignored of [
      "**/.claude/**",
      "**/.codex-artifacts/**",
      "**/.swarm/**",
      "**/android/app/build/**",
      "**/coverage/**",
      "**/dist/**",
      "**/output/**",
      "**/playwright-report/**",
      "**/screenshots/**",
      "**/test-results/**",
      "**/tmp/**",
    ]) {
      expect(viteConfigSource).toContain(`"${ignored}"`);
    }
  });
});
