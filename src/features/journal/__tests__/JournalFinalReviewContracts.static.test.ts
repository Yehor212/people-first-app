import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const moduleSource = read("src/features/journal/JournalModule.tsx");
const emptyCanvasSource = read("src/features/journal/DiaryEmptyCanvas.tsx");
const formatHintSource = read("src/features/journal/DiaryFormatHint.tsx");
const settingsSource = read("src/features/journal/JournalSettingsContent.tsx");
const burnSource = read("src/features/journal/BurnThoughtWidget.tsx");
const streakSource = read("src/features/journal/StreakCelebration.tsx");
const exportSource = read("src/features/journal/journalExport.ts");
const statsSource = read("src/features/journal/JournalStats.tsx");
const portalSource = read("src/features/journal/MemoryPortalCanvas.tsx");
const calendarSource = read("src/features/journal/JournalCalendarFull.tsx");
const suggestionSource = read("src/features/journal/DiaryEntrySuggestionCard.tsx");
const templatePickerSource = read("src/features/journal/JournalTemplatePicker.tsx");
const stickerManagerSource = read("src/features/journal/JournalStickerPackManager.tsx");
const stickerPickerSource = read("src/features/journal/JournalStickerPicker.tsx");
const photoPickerSource = read("src/features/journal/JournalPhotoPicker.tsx");
const modalKeyboardSource = read("src/hooks/useModalKeyboard.ts");
const entryListSource = read("src/features/journal/JournalEntryList.tsx");
const entryCardSource = read("src/features/journal/JournalEntryCard.tsx");
const entryViewerSource = read("src/features/journal/JournalEntryViewer.tsx");
const entryEditorSource = read("src/features/journal/JournalEntryEditor.tsx");
const diaryMiniOrbSource = read("src/features/journal/DiaryMiniOrb.tsx");
const aiConsentSource = read("src/features/journal/JournalAiConsentDialog.tsx");
const audioPlayerSource = read("src/features/journal/JournalAudioPlayer.tsx");
const exportDialogSource = read("src/features/journal/ExportPickerDialog.tsx");
const importConfirmSource = read("src/features/journal/JournalImportConfirmDialog.tsx");
const removePasswordSource = read("src/features/journal/RemovePasswordConfirmDialog.tsx");
const journalTypesSource = read("src/features/journal/types.ts");
const indexCssSource = read("src/index.css");

describe("journal final review contracts", () => {
  it("does not render reward pressure when the embedding disables rewards", () => {
    expect(moduleSource).toContain("rewardsEnabled && streak > 0");
    expect(moduleSource).toContain("{rewardsEnabled && (");
    expect(emptyCanvasSource).not.toContain("ParticleBackground");
    expect(emptyCanvasSource).not.toContain("journalStreakCount");
    expect(entryListSource).not.toContain("daysSinceLastEntry >= 2");
  });

  it("keeps journal insights descriptive instead of ranking writing behavior", () => {
    expect(statsSource).not.toContain("journalStatsStreaks");
    expect(statsSource).not.toContain("journalStatsLongestStreak");
    expect(statsSource).not.toContain("journalStatsAvgPerWeek");
    expect(statsSource).not.toContain("journalStatsFrequency");
    expect(statsSource).not.toContain("journalStatsMostActiveDay");
    expect(statsSource).not.toContain("journalStatsTagCloud");
    expect(statsSource).not.toContain("journalStatsMostUsedStickers");
  });

  it("does not infer emotional state from typing speed or correction patterns", () => {
    expect(entryEditorSource).not.toContain("useTypingDynamics");
    expect(entryEditorSource).not.toContain("TypingDynamicsMirror");
    expect(entryEditorSource).toContain("const [mobileToolsCollapsed, setMobileToolsCollapsed] = useState(true)");
  });

  it("keeps mobile style controls grouped, explicit, and legible in dark themes", () => {
    expect(entryEditorSource).toContain('{ts.journalThemeLabel || "Theme"}');
    expect(entryEditorSource).toMatch(
      /aria-label=\{fontSizeToolLabel\}[\s\S]{0,420}\{fontSizeToolLabel\}/,
    );
    expect(entryEditorSource).toContain(
      "border-transparent text-foreground/80 hover:bg-primary/10 hover:text-primary",
    );
    expect(entryEditorSource).toContain("border-border/60 bg-primary/[0.06]");
    expect(entryEditorSource).toContain("brightness-150 saturate-[1.7]");
    expect(diaryMiniOrbSource).toContain('renderer="auto"');
  });

  it("keeps the empty diary focused on one central invitation", () => {
    const compactShell = /function JournalCompactEmptyListShell[\s\S]*?function JournalFavoritesPanel/.exec(moduleSource)?.[0] ?? "";
    expect(compactShell).not.toContain("onNewEntry");
    expect(compactShell).not.toContain("<button");
    expect(compactShell).not.toContain("getJournalQuote");
    expect(compactShell).not.toContain("currentJournalQuote");
    expect(moduleSource).toContain("journal.entries.length === 0 ? (");
    expect(moduleSource).toContain("<LazyDiaryEmptyCanvas");
  });

  it("keeps settings mutations mounted and routes nested close actions back first", () => {
    expect(settingsSource).toContain("onBusyChange?: (busy: boolean) => void;");
    expect(settingsSource).toContain("onBusyChange?.(isBusy)");
    expect(moduleSource).toContain("const settingsDismissBlocked = settingsBusy || importing || removePasswordSubmitting;");
    expect(moduleSource).toContain("if (settingsDismissBlocked) return false;");
    expect(moduleSource).toContain('if (settingsSection !== "overview")');
  });

  it("shares one import path across desktop and phone and exposes blocked dismissal state", () => {
    expect(settingsSource).toContain("onRequestImport?: () => void;");
    expect(settingsSource).toContain("importing?: boolean;");
    expect(moduleSource).toContain("const handleJournalImportFile = useCallback");
    expect(moduleSource.match(/onRequestImport=/g)?.length).toBe(2);
    expect(moduleSource.match(/importing=\{importing\}/g)?.length).toBe(2);
    expect(moduleSource).toContain('accept="application/json,.json"');
    expect(moduleSource).toContain("disabled={settingsDismissBlocked}");
    expect(moduleSource).toContain("aria-busy={settingsDismissBlocked}");
  });

  it("keeps modal tools named, focus-safe, and quiet under reduced motion", () => {
    expect(stickerManagerSource).toContain("aria-labelledby={titleId}");
    expect(stickerManagerSource).toContain("useReducedMotion()");
    expect(templatePickerSource).toContain("useReducedMotion()");
    expect(templatePickerSource).toContain("whileTap={reducedMotion ? undefined");
    expect(modalKeyboardSource).toContain("return () => {");
    expect(photoPickerSource).toContain("text-destructive");
    expect(photoPickerSource).not.toContain("text-red-400");
    expect(moduleSource).toContain('initial={reducedMotion ? false : { scale: 0.98 }}');
    expect(moduleSource).toContain('initial={reducedMotion ? false : { scale: 0 }}');
    expect(stickerPickerSource).toContain("aria-modal={!showPackManager}");
    expect(stickerPickerSource).toContain("aria-hidden={showPackManager || undefined}");
    const resetDialog = /Secure password reset dialog[\s\S]*?\{\/\* Main content/.exec(moduleSource)?.[0] ?? "";
    expect(resetDialog).not.toContain('className="w-6 h-6 animate-spin');
    expect(resetDialog).not.toContain('className="w-4 h-4 animate-spin');
  });

  it("meets target size and truthful pre-action disclosure contracts", () => {
    expect(formatHintSource).toContain("min-h-[44px]");
    expect(formatHintSource).toContain("min-w-[44px]");
    expect(burnSource).toContain("journalReleaseBeforeAction");
    expect(entryEditorSource).toContain("onReleased={onReleaseThought}");
    expect(moduleSource).toContain("onReleaseThought={handleReleaseThought}");
    expect(moduleSource).toContain("{reminder.supported && (");
    expect(entryListSource).toContain("ref={aiToggleButtonRef}");
    expect(entryListSource).toContain("restoreFocusTo={aiToggleButtonRef}");
    expect(aiConsentSource).toContain("restoreFocusTo?: RefObject<HTMLElement | null>");
    expect(audioPlayerSource).toContain('type="range"');
    expect(photoPickerSource).toContain("var(--app-viewport-height)");
    expect(photoPickerSource).toContain("var(--safe-inline-start)");
    expect(photoPickerSource).toContain("var(--safe-inline-end)");
    expect(photoPickerSource).toContain("var(--safe-bottom)");
    expect(photoPickerSource).not.toContain("env(safe-area-inset");
    expect(photoPickerSource).toContain("whitespace-normal break-words");
    expect(exportDialogSource).toContain("var(--safe-inline-start)");
    expect(exportDialogSource).toContain("var(--safe-inline-end)");
  });

  it("uses the shared icon system for the audio slash command", () => {
    const slashSource = read("src/features/journal/SlashCommandMenu.tsx");
    const audioCommand = /id: "audio"[\s\S]*?fallbackDescription: "Record audio"/.exec(
      slashSource,
    )?.[0] ?? "";
    expect(audioCommand).not.toContain('icon: "\\u{1F3A4}"');
    expect(slashSource).toContain("<Mic");
  });

  it("keeps decision-critical journal dialogs safe and fully readable at large text", () => {
    for (const source of [exportDialogSource, templatePickerSource]) {
      expect(source).toContain("var(--app-viewport-height)");
      expect(source).toContain("var(--safe-inline-start)");
      expect(source).toContain("var(--safe-inline-end)");
      expect(source).toContain("var(--safe-bottom)");
      expect(source).not.toContain("100dvh");
      expect(source).not.toContain("env(safe-area-inset");
    }

    for (const source of [importConfirmSource, removePasswordSource, aiConsentSource]) {
      expect(source).toContain("zf-safe-area-dialog");
      expect(source).not.toContain("100dvh");
      expect(source).not.toContain("env(safe-area-inset");
    }

    expect(importConfirmSource).not.toContain("truncate");
    expect(importConfirmSource).toContain("flex-col");
    expect(removePasswordSource).toContain("useBackHandler(true, handleClose)");
    expect(removePasswordSource).toContain("flex-col");
    expect(exportDialogSource).toContain("useBackHandler(true, handleClose)");
    expect(aiConsentSource).toContain("flex-col");
    expect(aiConsentSource).toContain("whitespace-normal break-words");

    for (const source of [exportDialogSource, importConfirmSource, templatePickerSource]) {
      expect(source).toMatch(/zf-auto-fit-grid-(?:9|10)/);
      expect(source).not.toContain("grid-cols-2");
    }
    expect(indexCssSource).toContain(".zf-auto-fit-grid-10");
    expect(indexCssSource).toContain("calc(10rem * var(--font-scale, 1))");
    expect(indexCssSource).toContain(".zf-auto-fit-grid-9");
    expect(indexCssSource).toContain("calc(9rem * var(--font-scale, 1))");

    expect(templatePickerSource).not.toContain("line-clamp-2");
    expect(templatePickerSource).not.toContain("text-[10px]");
    expect(templatePickerSource).toContain(
      "flex max-h-[calc(var(--app-viewport-height)-var(--safe-top)-0.75rem)] flex-col overflow-hidden",
    );
    expect(templatePickerSource).toContain("min-h-0 flex-1 overflow-y-auto");
  });

  it("keeps reachable journal space labels on the shared viewport and scalable type system", () => {
    expect(entryListSource).toContain("var(--app-viewport-height)");
    expect(entryListSource).toContain("var(--safe-inline-start)");
    expect(entryListSource).toContain("var(--safe-inline-end)");
    expect(entryListSource).not.toContain("100dvh");
    expect(entryListSource).not.toContain("env(safe-area-inset");
    expect(entryListSource).not.toContain("truncate");
    expect(entryListSource).not.toContain("line-clamp");
    for (const fixedSize of ["text-[9px]", "text-[10px]", "text-[11px]"]) {
      expect(entryListSource).not.toContain(fixedSize);
    }
  });

  it("keeps memory portal labels readable instead of clipping them at large text", () => {
    expect(portalSource).not.toContain("truncate");
    expect(portalSource).not.toContain("text-[10px]");
    expect(portalSource).not.toContain("FAN_POSITIONS");
    expect(portalSource).toContain("whitespace-normal break-words");
    expect(portalSource).toContain("grid max-h-full w-full grid-cols-2");
    expect(portalSource).toContain("overflow-y-auto overscroll-contain");
    expect(portalSource).toContain("grid-cols-1 min-[420px]:grid-cols-3");
    expect(portalSource).toContain("grid-cols-1 min-[420px]:grid-cols-2");
    expect(portalSource).toContain("calc(360px*var(--font-scale))");
    expect(portalSource).toContain("flex flex-col items-stretch gap-3");
    expect(portalSource).toContain("min-[420px]:flex-row");
  });

  it("keeps active diary cards, viewer labels, and mobile navigation on scalable type", () => {
    for (const source of [moduleSource, entryCardSource, entryViewerSource]) {
      for (const fixedSize of ["text-[10px]", "text-[11px]"]) {
        expect(source).not.toContain(fixedSize);
      }
    }

    expect(moduleSource).not.toContain("truncate");
    expect(entryViewerSource).not.toContain("truncate");
    expect(entryCardSource).toContain("whitespace-normal break-words text-sm font-semibold");
    expect(moduleSource).toContain("grid-cols-2 min-[420px]:grid-cols-4");
    expect(moduleSource).toContain("whitespace-normal break-words text-xs font-bold");

    const favoritesPanel =
      /function JournalFavoritesPanel[\s\S]*?type ModuleState/.exec(moduleSource)?.[0] ?? "";
    const privateFavorite = /\{privateMode \? \([\s\S]*?\) : \(/.exec(favoritesPanel)?.[0] ?? "";
    expect(privateFavorite).not.toContain("line-clamp");
    expect(privateFavorite).not.toContain("overflow-hidden");
    expect(privateFavorite).toContain("whitespace-normal break-words");
  });

  it("scales saved diary body sizes and safely wraps unbroken user content", () => {
    expect(journalTypesSource).toContain("export function getScaledJournalFontSize");
    expect(entryEditorSource).toContain("fontSize: getScaledJournalFontSize(fontSize)");
    expect(entryViewerSource).toContain("getScaledJournalFontSize(entry.fontSize)");
    expect(entryEditorSource).toContain("[overflow-wrap:anywhere]");
    expect(entryViewerSource).toContain("[overflow-wrap:anywhere]");
    expect(entryEditorSource).not.toContain("word-break:break-all");
    expect(entryViewerSource).not.toContain("word-break:break-all");
  });

  it("wraps unbroken filenames and masked emails without breaking every character", () => {
    expect(importConfirmSource).not.toContain("break-all");
    expect(importConfirmSource).toContain('dir="auto"');
    expect(importConfirmSource).toContain("[overflow-wrap:anywhere]");

    const resetDialog =
      /Secure password reset dialog[\s\S]*?\{\/\* Main content/.exec(moduleSource)?.[0] ?? "";
    expect(resetDialog).not.toContain("break-all");
    expect(resetDialog.match(/\[overflow-wrap:anywhere\]/g)?.length).toBeGreaterThanOrEqual(2);
    expect(resetDialog.match(/<bdi>/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("gives mobile memory headings a full-width reflow row beside fixed controls", () => {
    const statsHeader = /key="stats"[\s\S]*?<LazyMemoryPortalCanvas/.exec(moduleSource)?.[0] ?? "";
    expect(statsHeader).toContain("grid-cols-[44px_minmax(0,1fr)_44px]");
    expect(statsHeader).toContain("col-span-3");
    expect(statsHeader).toContain("min-[420px]:col-span-1");
    expect(statsHeader).not.toContain("[overflow-wrap:normal]");
  });

  it("uses the selected locale and civil dates for journal insights and exports", () => {
    expect(statsSource).not.toContain("<MoodCorrelations");
    expect(streakSource).toContain("formatLocalizedCount(");
    expect(exportSource).toContain("getTranslations(language)");
    expect(exportSource).toContain("parseLocalDate(entry.date)");
    expect(exportSource).toContain("countWordsHtml(e.content)");
    expect(statsSource).toContain("getJournalWeekStart(language)");
    expect(portalSource).toContain("formatPortalDate(selectedDate, locale)");
    expect(moduleSource).toContain('formatJournalCivilDate(entry.date, language, "short")');
    expect(entryCardSource).toContain('formatJournalCivilDate(entry.date, language, "short")');
    expect(entryViewerSource).toContain('formatJournalCivilDate(entry.date, language, "long")');
    expect(entryViewerSource).toContain('dir="auto"');
  });

  it("mirrors directional motion and affordances in RTL layouts", () => {
    expect(calendarSource).toContain("const motionDirection = isRTL ? -direction : direction;");
    expect(suggestionSource).toContain("rtl:scale-x-[-1]");
    expect(portalSource).toContain("rtl:scale-x-[-1]");
    expect(entryEditorSource).not.toContain("px-4 py-3 text-left text-xs");
    expect(entryEditorSource).toContain("px-4 py-3 text-start text-xs");
    expect(entryEditorSource).toContain("[unicode-bidi:plaintext]");
    expect(entryViewerSource).toContain("[unicode-bidi:plaintext]");
    expect(audioPlayerSource.match(/dir="auto"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("does not reduce readable helper copy below the contrast-safe muted token", () => {
    expect(entryViewerSource).not.toMatch(/<(?:p|span)[^>]*text-muted-foreground\/(?:[0-7][0-9]?)/);
    expect(templatePickerSource).not.toMatch(/<p[^>]*text-muted-foreground\/(?:[0-7][0-9]?)/);
    expect(stickerPickerSource).not.toMatch(/<(?:p|span)[^>]*text-muted-foreground\/(?:[0-7][0-9]?)/);
    expect(stickerManagerSource).not.toMatch(/<(?:p|span)[^>]*text-muted-foreground\/(?:[0-7][0-9]?)/);
  });

  it("uses the effective motion gate for imperative editor scrolling", () => {
    expect(entryEditorSource).toContain('behavior: shouldAnimate() ? "smooth" : "auto"');
  });

  it("keeps diary content closed when persisted security state cannot be read", () => {
    expect(moduleSource).toContain("security.loadError && (");
    expect(moduleSource).toContain("void security.retryLoad();");
    expect(moduleSource).toContain("security.isLocked && !security.loading && !security.loadError");
  });

  it("keeps editor identity and interaction state aligned during entry switches and saves", () => {
    expect(moduleSource).toContain('key={`desktop-editor-${journal.activeEntryId ?? "new"}`}');
    expect(moduleSource).toContain('key={`mobile-editor-${journal.activeEntryId ?? "new"}`}');
    expect(entryEditorSource).toContain("const saveInteractionLocked =");
    expect(entryEditorSource).toContain("contentEditable={draftReady && !saveInteractionLocked}");
    expect(entryEditorSource).toContain("disabled={saveInteractionLocked}");
    expect(entryEditorSource).toContain("aria-disabled={saveInteractionLocked}");
  });
});
