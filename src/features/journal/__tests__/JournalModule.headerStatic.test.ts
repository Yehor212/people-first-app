import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/features/journal/JournalModule.tsx", "utf8");
const sidebarSource = readFileSync("src/features/journal/SidebarCompact.tsx", "utf8");

describe("JournalModule V2 header", () => {
  it("keeps app navigation and the diary-only drawer as separate phone controls", () => {
    expect(source).toContain('import { V2_SHELL_ICONS } from "@/lib/v2IconSystem"');
    expect(source).toContain("const JournalMenuIcon = V2_SHELL_ICONS.menu");
    expect(source).toContain("PanelLeftOpen");

    const menuClass = /const mobileHeaderMenuClass =\s*"([^"]+)";/.exec(source)?.[1] ?? "";
    expect(menuClass).toContain("h-[48px] w-[48px]");
    expect(menuClass).toContain("rounded-full");
    expect(menuClass).toContain("bg-card/70");
    expect(menuClass).not.toContain("press-stable");

    expect(source).not.toContain('data-testid="journal-mobile-nav-menu"');

    const appMenuButtonBlock =
      /<button\s+type="button"\s+onClick={onOpenNavMenu}[\s\S]*?data-testid="journal-mobile-app-nav-menu"[\s\S]*?<\/button>/.exec(
        source,
      )?.[0] ?? "";
    expect(appMenuButtonBlock).toContain("<JournalMenuIcon");
    expect(appMenuButtonBlock).toContain('aria-controls="nav-v2-drawer"');
    expect(appMenuButtonBlock).toContain("aria-expanded={navMenuOpen}");

    const diaryPanelButtonBlock =
      /<button\s+type="button"\s+ref={mobileDiarySidebarTriggerRef}\s+onClick={handleOpenMobileDiarySidebar}[\s\S]*?data-testid="journal-mobile-diary-sidebar-trigger"[\s\S]*?<\/button>/.exec(
        source,
      )?.[0] ?? "";
    expect(diaryPanelButtonBlock).toContain("<PanelLeftOpen");
    expect(diaryPanelButtonBlock).toContain("ref={mobileDiarySidebarTriggerRef}");
    expect(diaryPanelButtonBlock).toContain('aria-controls="journal-mobile-diary-sidebar"');
    expect(diaryPanelButtonBlock).toContain("aria-expanded={showMobileDiarySidebar}");
    expect(diaryPanelButtonBlock).not.toContain('aria-controls="nav-v2-drawer"');

    const diaryPanelCloseButtonBlock =
      /<button[\s\S]*?ref={mobileDiarySidebarCloseRef}[\s\S]*?data-testid="journal-mobile-diary-sidebar-close"[\s\S]*?<\/button>/.exec(
        source,
      )?.[0] ?? "";
    expect(diaryPanelCloseButtonBlock).toContain("onClick={() => closeMobileDiarySidebar()}");
    expect(source).not.toContain("onClick={closeMobileDiarySidebar}");
    expect(source).toContain("mobileDiarySidebarCloseRef.current?.focus({ preventScroll: true })");
    expect(source).toContain("mobileDiarySidebarTriggerRef.current?.focus({ preventScroll: true })");
    expect(source).toContain("requestAnimationFrame(() => mobileDiarySidebarCloseRef.current?.focus({ preventScroll: true }))");
    expect(source).toContain("requestAnimationFrame(() => mobileDiarySidebarTriggerRef.current?.focus({ preventScroll: true }))");
    expect(source).toContain("returnFocusElement?: HTMLElement | null");
    expect(source).toContain("openSettings(\"overview\", mobileDiarySidebarTriggerRef.current)");
  });

  it("keeps drawer access on locked diary and mobile diary settings surfaces", () => {
    const lockedButtonBlock = /<button[\s\S]*?data-testid="journal-lock-nav-menu"[\s\S]*?<\/button>/.exec(source)?.[0] ?? "";
    expect(lockedButtonBlock).toContain("<JournalMenuIcon");
    expect(lockedButtonBlock).toContain('aria-controls="nav-v2-drawer"');
    expect(lockedButtonBlock).toContain("aria-expanded={navMenuOpen}");

    const settingsButtonBlock = /<button[\s\S]*?data-testid="journal-settings-nav-menu"[\s\S]*?<\/button>/.exec(source)?.[0] ?? "";
    expect(settingsButtonBlock).toContain("<JournalMenuIcon");
    expect(settingsButtonBlock).toContain("closeSettings(false)");
    expect(settingsButtonBlock).toContain("onOpenNavMenu()");
    expect(settingsButtonBlock).toContain('aria-controls="nav-v2-drawer"');
  });

  it("exposes the phone diary section controls as an accessible toolbar", () => {
    const toolbarBlock = /<div\s+className="grid grid-cols-4 gap-1 px-4 pb-3"[\s\S]*?<\/div>\s*<\/div>/.exec(source)?.[0] ?? "";
    expect(toolbarBlock).toContain('role="toolbar"');
    expect(toolbarBlock).toContain('aria-label={ts.journalTitle || "Diary"}');
    expect(toolbarBlock).toContain('data-testid="journal-mobile-section-toolbar"');

    for (const testId of [
      "journal-mobile-entry",
      "journal-mobile-stats",
      "journal-mobile-favorites",
      "journal-mobile-settings",
    ]) {
      const buttonBlock = new RegExp(`<button[\\s\\S]*?data-testid="${testId}"[\\s\\S]*?<\\/button>`).exec(source)?.[0] ?? "";
      expect(buttonBlock, `${testId} block`).toContain("aria-pressed=");
    }
  });

  it("makes the mobile diary settings sheet bounded, scrollable, and focus-owned", () => {
    expect(source).toContain("max-h-[calc(var(--app-viewport-height)-var(--safe-top)-0.75rem)]");
    expect(source).toContain("flex-col overflow-hidden");
    expect(source).toContain("journal-diary-glass-panel rounded-t-[28px]");
    expect(source).toContain("min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,var(--safe-bottom))]");
    expect(source).toContain('showJournalSidebarAtmosphere ? "bg-transparent" : "bg-card"');
    expect(source).toContain("const mobileSettingsPanelRef = useRef<HTMLDivElement | null>(null)");
    expect(source).toContain("const mobileSettingsCloseRef = useRef<HTMLButtonElement>(null)");
    expect(source).toContain("ref={mobileSettingsPanelRef}");
    expect(source).toContain("ref={mobileSettingsCloseRef}");
    expect(source).toContain("mobileSettingsCloseRef.current?.focus({ preventScroll: true })");
    expect(source).toContain("const panel = mobileSettingsPanelRef.current");
    expect(source).toContain("getFocusableElements(panel)");
    expect(source).toContain('panel.addEventListener("keydown", handleKeyDown)');
    expect(source).toContain('document.addEventListener("focusin", handleFocusIn)');
    expect(source).toContain('document.removeEventListener("focusin", handleFocusIn)');
    expect(source).toContain("panel.contains(event.target)");
    expect(source).toContain('panel.removeEventListener("keydown", handleKeyDown)');
  });

  it("keeps orb handoff as a user-confirmed suggestion on phone and desktop", () => {
    expect(source).toContain("handleNewEntryWithPrefill(suggestion.prefill)");
    expect(source).toContain("? portalEntryPrefill");
    expect(source).not.toContain("portalEntryPrefill ?? initialSuggestionRef.current?.prefill");
    expect(source).toMatch(
      /const hasInitialEntrySuggestion =\s*!!initialEntrySuggestion &&\s*!!initialSuggestionRef\.current &&\s*!initialSuggestionConsumedRef\.current &&\s*journal\.view === "list";/,
    );
    expect(source).toMatch(/const visibleExtraSuggestions = useMemo\([\s\S]*?showEntrySuggestionCards/);
  });

  it("retires extra suggestion cards as soon as the user starts them", () => {
    expect(source).toContain("function getSuggestionDismissKey(");
    expect(source).toMatch(
      /const handleUseExtraSuggestion = useCallback\([\s\S]*?\(suggestion: JournalEntrySuggestion, index: number\)[\s\S]*?setDismissedSuggestionIds\(\(prev\) => \[\.\.\.prev, getSuggestionDismissKey\(suggestion, index\)\]\);[\s\S]*?handleNewEntryWithPrefill\(suggestion\.prefill\);/,
    );
    expect(source).toContain("visibleExtraSuggestions.map((suggestion, index)");
    expect(source).toContain("key={getSuggestionDismissKey(suggestion, index)}");
    expect(source).toContain("onStart={() => handleUseExtraSuggestion(suggestion, index)}");
    expect(source).toContain("onDismiss={() => handleDismissExtraSuggestion(suggestion, index)}");
  });

  it("opens blank new entries with the selected calendar date", () => {
    expect(source).toContain("const getActiveDraftDate = useCallback");
    expect(source).toContain("journal.selectedDate ?? getToday()");
    expect(source).toContain("setPortalEntryPrefill({ date: getActiveDraftDate() });");
  });

  it("closes an open viewer or editor when private mode is enabled", () => {
    expect(source).toContain('if (privateMode && (journal.view === "viewing" || journal.view === "editing"))');
    expect(source).toContain("handleGoBack();");
  });

  it("keeps favorite private placeholders inert", () => {
    const favoritesPanelBlock = /function JournalFavoritesPanel[\s\S]*?type ModuleState/.exec(source)?.[0] ?? "";
    expect(favoritesPanelBlock).toContain("aria-disabled={privateMode || undefined}");
    expect(favoritesPanelBlock).toContain("if (privateMode) return;");
    expect(favoritesPanelBlock).toContain('privateMode && "cursor-default"');
    expect(favoritesPanelBlock.indexOf("if (privateMode) return;")).toBeLessThan(
      favoritesPanelBlock.indexOf("onOpenEntry(entry.id)"),
    );
  });

  it("does not expose the exact number of hidden favorite entries in private mode", () => {
    const favoritesPanelBlock = /function JournalFavoritesPanel[\s\S]*?type ModuleState/.exec(source)?.[0] ?? "";

    expect(favoritesPanelBlock).toContain(
      "const visibleFavorites = privateMode ? favorites.slice(0, 1) : favorites;",
    );
    expect(favoritesPanelBlock).toContain("{visibleFavorites.map((entry) => (");
    expect(favoritesPanelBlock).not.toContain("{favorites.map((entry) => (");
  });


  it("keeps the diary-only desktop sidebar rail and wide panel", () => {
    expect(sidebarSource).toContain('data-testid="journal-sidebar-rail"');
    expect(sidebarSource).toContain('data-testid="journal-sidebar-disclosure"');
    expect(sidebarSource).not.toContain("<MoodDotStrip");
    expect(source).toContain('data-testid="journal-sidebar-wide"');
    expect(source).toContain('const isDiaryDesktopLayout = useMediaQuery("(min-width: 1280px)")');
    expect(source).toContain('const JOURNAL_SIDEBAR_PANEL_ID = "journal-sidebar-panel"');
    expect(source).toContain('id={JOURNAL_SIDEBAR_PANEL_ID}');
    expect(source).toContain("compact");
    expect(source).toContain("showFab={false}");
    expect(source).toContain("showSpaces={false}");
  });

  it("keeps exactly four section actions above one disclosure action in the desktop rail", () => {
    const expectedOrder = [
      'data-testid="journal-sidebar-nav-entry"',
      'data-testid="journal-sidebar-nav-stats"',
      'data-testid="journal-sidebar-nav-favorites"',
      'data-testid="journal-sidebar-nav-settings"',
      'data-testid="journal-sidebar-disclosure"',
    ];
    const buttonCount = sidebarSource.match(/<button/g)?.length ?? 0;

    expect(buttonCount).toBe(5);
    expect(sidebarSource).not.toContain('data-testid="journal-sidebar-new-entry"');
    for (let index = 1; index < expectedOrder.length; index += 1) {
      expect(sidebarSource.indexOf(expectedOrder[index - 1])).toBeLessThan(
        sidebarSource.indexOf(expectedOrder[index]),
      );
    }
  });

  it("keeps desktop-only journal security affordances honest", () => {
    expect(source).toContain('import { IS_DESKTOP_RUNTIME } from "@/lib/env"');
    expect(source).toContain("const isEmailLockRemovalAvailable = !IS_DESKTOP_RUNTIME");
    expect(source).toContain("onForgotPassword={handleForgotPassword}");
    expect(source).toContain("emailLockRemovalAvailable={isEmailLockRemovalAvailable}");
    expect(source).toContain("pt-[max(0.75rem,var(--safe-top))]");
    expect(source).toContain("pt-[max(1rem,var(--safe-top))]");
    expect(source).toContain("pb-[max(1rem,var(--safe-bottom))]");
    expect(source).toContain("max-h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom)_-_2rem)]");
    expect(source).not.toContain("env(safe-area-inset-");
    expect(source).toContain("hasEncryptedJournalContent()");
    expect(source).toContain("hasEncryptedJournalMedia()");
    expect(source).toMatch(
      /logger\.warn\(\s*"\[Journal\] Password reset session check failed"\s*,\s*getJournalAuthErrorDebugInfo\(error\)/,
    );

    const desktopSettingsBlock = /data-testid="journal-settings-panel"[\s\S]*?<LazyJournalSettingsContent[\s\S]*?onRequestRemovePassword=\{\(\) => setShowRemovePasswordConfirm\(true\)\}/.exec(
      source,
    )?.[0] ?? "";
    expect(desktopSettingsBlock).toContain("if (!isDiaryDesktopLayout)");
    expect(desktopSettingsBlock).toContain("closeSettings(false)");
    expect(desktopSettingsBlock).toContain("setShowExportPicker(true)");
  });

  it("keeps a diary-only sidebar drawer on phone layouts", () => {
    expect(source).toContain('data-testid="journal-mobile-diary-sidebar"');
    expect(source).toContain('data-testid="journal-mobile-diary-sidebar-calendar"');
    expect(source).toContain('data-testid="journal-mobile-diary-sidebar-new-entry"');
    expect(source).toContain("const mobileDiarySidebarRef = useRef<HTMLElement | null>(null)");
    expect(source).toContain("ref={mobileDiarySidebarRef}");
    expect(source).toContain("getFocusableElements(drawer)");
    expect(source).toContain('drawer.addEventListener("keydown", handleKeyDown)');
    expect(source).toContain('drawer.removeEventListener("keydown", handleKeyDown)');
    expect(source).toContain("showMobileDiarySidebar");
    expect(source).toContain("closeMobileDiarySidebar");
  });

  it("prioritizes the topmost remove-password confirmation before closing settings on Android back", () => {
    const escapeHandlerBlock =
      /const activeDialog =[\s\S]*?const handler = \(e: KeyboardEvent\) => \{[\s\S]*?\};\n {4}document\.addEventListener\("keydown", handler, true\);/.exec(
        source,
      )?.[0] ?? "";
    expect(escapeHandlerBlock).toContain("e.preventDefault();");
    expect(escapeHandlerBlock).toContain("e.stopPropagation();");
    expect(source).toContain('document.removeEventListener("keydown", handler, true)');
    expect(escapeHandlerBlock.indexOf("showRemovePasswordConfirm")).toBeGreaterThanOrEqual(0);
    expect(escapeHandlerBlock.indexOf("showPasswordSettings")).toBeGreaterThanOrEqual(0);
    expect(escapeHandlerBlock.indexOf("showRemovePasswordConfirm")).toBeLessThan(
      escapeHandlerBlock.indexOf("showPasswordSettings"),
    );

    const androidBackBlock =
      /\/\/ Android back button handling[\s\S]*?useEffect\(\(\) => \{[\s\S]*?\}, \[[\s\S]*?\]\);/.exec(
        source,
      )?.[0] ?? "";
    expect(androidBackBlock.indexOf("showRemovePasswordConfirm")).toBeGreaterThanOrEqual(0);
    expect(androidBackBlock.indexOf("showPasswordSettings")).toBeGreaterThanOrEqual(0);
    expect(androidBackBlock.indexOf("showRemovePasswordConfirm")).toBeLessThan(
      androidBackBlock.indexOf("showPasswordSettings"),
    );
  });

  it("routes Android hardware back from statistics through the stats-aware back handler", () => {
    const androidBackBlock =
      /\/\/ Android back button handling[\s\S]*?useEffect\(\(\) => \{[\s\S]*?\}, \[[\s\S]*?\]\);/.exec(
        source,
      )?.[0] ?? "";

    expect(androidBackBlock).toContain('journal.view === "stats"');
    expect(androidBackBlock).toContain("handleStatsBack();");
    expect(androidBackBlock.indexOf('journal.view === "stats"')).toBeLessThan(
      androidBackBlock.indexOf('journal.view !== "list"'),
    );
    expect(androidBackBlock.indexOf("handleStatsBack")).toBeLessThan(androidBackBlock.indexOf("handleGoBack"));
    expect(androidBackBlock).toContain("handleStatsBack,");
  });
});
