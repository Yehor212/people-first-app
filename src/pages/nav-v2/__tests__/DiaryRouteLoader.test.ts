import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const diaryPageSource = readFileSync("src/pages/nav-v2/DiaryPage.tsx", "utf8");
const journalModuleSource = readFileSync("src/features/journal/JournalModule.tsx", "utf8");
const journalEntryListSource = readFileSync("src/features/journal/JournalEntryList.tsx", "utf8");
const diaryEmptyCanvasSource = readFileSync("src/features/journal/DiaryEmptyCanvas.tsx", "utf8");
const useJournalSource = readFileSync("src/features/journal/useJournal.ts", "utf8");
const memoryPortalSource = readFileSync("src/features/journal/MemoryPortalCanvas.tsx", "utf8");
const indexSource = readFileSync("src/pages/Index.tsx", "utf8");
const authGateSource = readFileSync("src/components/AuthGate.tsx", "utf8");
const packageSource = readFileSync("package.json", "utf8");
const viteConfigSource = readFileSync("vite.config.ts", "utf8");
const chromePerformanceBudgetSource = readFileSync("config/chrome-performance-budgets.json", "utf8");
const chromePerformanceSmokeSource = readFileSync("scripts/smoke-chrome-performance.cjs", "utf8");
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
    expect(viteConfigSource).toContain("isDeferredJournalPreload");
    expect(viteConfigSource).toContain('dep.startsWith("assets/JournalCalendarFull-")');
    expect(viteConfigSource).toContain('dep.startsWith("assets/RemovePasswordConfirmDialog-")');

    for (const ignored of [
      "**/.codex/auto-context/**",
      "**/.codex-artifacts/**",
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

  it("keeps diary startup work off the first interactive frame", () => {
    expect(useJournalSource).toContain("startTransition");
    expect(useJournalSource).toContain("getEntriesPage({ limit: JOURNAL_INITIAL_ENTRY_LIMIT })");
    expect(useJournalSource).toContain("scheduleRemainingLoad");
    expect(useJournalSource).not.toContain("setEntries(all)");

    expect(journalEntryListSource).toContain('import { scheduleIdle } from "@/lib/scheduleIdle"');
    expect(journalEntryListSource).toContain("Promise.all([");
    expect(journalEntryListSource).toContain("getJournalSpaces()");
    expect(journalEntryListSource).toContain("getJournalSpaceCaptures()");
    expect(journalEntryListSource).toContain("getSpaceEntryLinks()");
    expect(journalEntryListSource).toContain("setJournalSpaces(spaces)");
    expect(journalEntryListSource).toContain("setSpaceCaptures(captures)");
    expect(journalEntryListSource).toContain("setSpaceEntryLinks(links)");

    expect(journalModuleSource).toContain("import.meta.glob");
    expect(journalModuleSource).toContain("lazyDeferredJournalComponent");
    expect(journalModuleSource).toContain("./JournalCalendarFull.tsx");
    expect(journalModuleSource).toContain("./RemovePasswordConfirmDialog.tsx");
    expect(journalModuleSource).toContain('lazyWithRetry(\n  () => import("./DiaryEmptyCanvas")');
    expect(journalModuleSource).not.toContain('import { DiaryEmptyCanvas } from "./DiaryEmptyCanvas"');
    expect(journalModuleSource).toContain('import { scheduleIdle } from "@/lib/scheduleIdle"');
    expect(journalModuleSource).toContain("scheduleIdle(");
    expect(journalModuleSource).toContain("showSpaces={false}");
    expect(journalModuleSource).toContain("showFab={false}");
    expect(journalModuleSource).toContain("JournalCompactEmptyListShell");
    expect(journalModuleSource).toContain("journal.totalCount === 0 && !journal.loading");
    expect(journalModuleSource).toContain("journal.loading ? (");
    expect(journalModuleSource).toContain("<LazyDiaryEmptyCanvas");
    expect(diaryEmptyCanvasSource).toContain('data-testid="diary-empty-canvas"');
    expect(journalModuleSource).toMatch(
      /data-testid="journal-detail-pane"[\s\S]*?journal\.loading \? \([\s\S]*?<JournalDeferredPanelFallback[\s\S]*?\) : \([\s\S]*?<LazyDiaryEmptyCanvas/,
    );

    expect(journalEntryListSource).toContain("showSpaces?: boolean");
    expect(journalEntryListSource).toContain("if (!showSpaces) return");
    expect(journalEntryListSource).toContain('data-testid="journal-compact-empty-list"');
    expect(journalEntryListSource).toContain('data-testid="journal-empty-list"');
  });

  it("measures public-user routes instead of diagnostics-only dev routes", () => {
    expect(chromePerformanceBudgetSource).toContain('"path": "orb?nav=v2&navLayout=phone"');
    expect(chromePerformanceBudgetSource).toContain('"path": "diary?nav=v2"');
    expect(chromePerformanceBudgetSource).toContain(
      '"readySelector": "[data-testid=\\"diary-page\\"]"',
    );
    expect(chromePerformanceBudgetSource).not.toContain("dev=true");
    expect(chromePerformanceSmokeSource).toContain("for (const route of routeGroup.routes)");
    expect(chromePerformanceSmokeSource).toContain("fresh-browser-per-route");
    expect(chromePerformanceSmokeSource).toContain(
      "results.push(await measureWithBrowser(browser, routeGroup, route))",
    );
    expect(chromePerformanceSmokeSource).toContain("rawMaxLongTaskMs");
    expect(chromePerformanceSmokeSource).toContain("frameVisibleLongTasks");
    expect(chromePerformanceSmokeSource).toContain("async function waitForRouteReady(page, route)");
    expect(chromePerformanceSmokeSource).toContain("routeReadyBeforeSteady");
  });

  it("keeps the diary settings sheet polished while lazy settings load", () => {
    expect(journalModuleSource).toContain("function JournalSettingsDeferredFallback");
    expect(journalModuleSource).toContain('data-testid="journal-settings-fallback"');
    expect(journalModuleSource).toContain("<JournalSettingsDeferredFallback");
    expect(journalModuleSource).toContain("journal-settings-fallback-card");
    expect(journalModuleSource).toContain("journal-settings-fallback-row");
    expect(journalModuleSource).not.toMatch(
      /LazyJournalSettingsContent[\s\S]{0,220}<JournalDeferredPanelFallback/,
    );
  });

});
