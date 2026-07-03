import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = {
  editor: readFileSync("src/features/journal/JournalEntryEditor.tsx", "utf8"),
  entryList: readFileSync("src/features/journal/JournalEntryList.tsx", "utf8"),
  hubShell: readFileSync("src/features/journal/JournalHubShell.tsx", "utf8"),
  module: readFileSync("src/features/journal/JournalModule.tsx", "utf8"),
  formatToolbar: readFileSync("src/features/journal/DiaryFormatToolbar.tsx", "utf8"),
  slashMenu: readFileSync("src/features/journal/SlashCommandMenu.tsx", "utf8"),
  stickerPicker: readFileSync("src/features/journal/JournalStickerPicker.tsx", "utf8"),
  shortcuts: readFileSync("src/features/journal/KeyboardShortcutsOverlay.tsx", "utf8"),
  saveIndicator: readFileSync("src/features/journal/SaveIndicator.tsx", "utf8"),
  emptyCanvas: readFileSync("src/features/journal/DiaryEmptyCanvas.tsx", "utf8"),
  journalQuotes: readFileSync("src/features/journal/journalQuotes.ts", "utf8"),
  useJournal: readFileSync("src/features/journal/useJournal.ts", "utf8"),
  types: readFileSync("src/i18n/types.ts", "utf8"),
};

const localeFiles = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"].map((language) => ({
  language,
  source: readFileSync("src/i18n/languages/" + language + ".ts", "utf8"),
}));

const requiredJournalKeys = [
  "journalWriteEntry",
  "journalWriteFirstEntry",
  "journalEntryBody",
  "journalNoAiResults",
  "journalNoAiResultsHint",
  "journalEntryDate",
  "journalLoadFailed",
  "journalLoadFailedHint",
  "journalRetryLoad",
  "journalAiSearchUnavailable",
  "journalAiSearchUnavailableHint",
  "journalSaveFailedHint",
  "journalRemoveSticker",
  "journalSlashCommands",
  "journalSlashNoResults",
  "journalFormatBold",
  "journalFormatItalic",
  "journalFormatUnderline",
  "journalFormatStrikethrough",
  "journalFormatQuote",
  "journalFormatCode",
  "journalFormatLink",
  "journalReflectionQuoteLabel",
  "quoteJournal1",
  "quoteJournal2",
  "quoteJournal3",
  "quoteJournal4",
  "quoteJournal5",
  "quoteJournal6",
  "quoteJournal7",
  "quoteJournal8",
  "quoteJournal9",
  "quoteJournal10",
  "quoteJournal11",
  "quoteJournal12",
  "quoteJournal13",
  "quoteJournal14",
  "quoteJournal15",
  "quoteJournal16",
  "quoteJournal17",
  "quoteJournal18",
  "quoteJournal19",
  "quoteJournal20",
  "quoteJournal21",
  "quoteJournal22",
  "quoteJournal23",
  "quoteJournal24",
  "quoteJournal25",
  "quoteJournal26",
  "quoteJournal27",
  "quoteJournal28",
  "quoteJournal29",
  "quoteJournal30",
];

describe("Journal accessibility, copy, and wallpaper static contracts", () => {
  it("registers every journal key used by new diary a11y/copy surfaces", () => {
    for (const key of requiredJournalKeys) {
      expect(source.types, key + " missing from Translations").toContain(key + ": string;");
      for (const locale of localeFiles) {
        expect(locale.source, key + " missing from " + locale.language).toContain(key + ":");
      }
    }
  });

  it("exposes the rich diary body as a named multiline textbox with mixed-language direction", () => {
    const editorBlock = /contentEditable[\s\S]*?onInput=\{handleEditorInput\}/.exec(source.editor)?.[0] ?? "";

    expect(editorBlock).toContain('role="textbox"');
    expect(editorBlock).toContain('aria-multiline="true"');
    expect(editorBlock).toContain("aria-label={ts.journalEntryBody");
    expect(editorBlock).toContain('dir="auto"');
    expect(editorBlock).toContain("focus-visible:ring");
  });

  it("wires the save lifecycle indicator and retry action into the editor chrome", () => {
    expect(source.editor).toContain("handleRetry,");
    expect(source.editor).toContain("<SaveIndicator");
    expect(source.editor).toContain("state={saveState}");
    expect(source.editor).toContain("onRetry={handleRetry}");
    expect(source.editor).toContain('aria-busy={saveState === "saving"}');
  });

  it("adds modal semantics and keyboard/back/focus handling to editor confirmation overlays", () => {
    expect(source.editor).toContain('role="alertdialog"');
    expect(source.editor).toContain('aria-modal="true"');
    expect(source.editor).toContain("aria-labelledby=");
    expect(source.editor).toContain("aria-describedby=");
    expect(source.editor).toContain('import { useModalA11y }');
    expect(source.editor).toContain("useModalA11y(showDeleteConfirm");
    expect(source.editor).toContain("useModalA11y(showUnsavedDialog");
    expect(source.editor).toContain("useModalA11y(showSettingsConfirm");
    expect(source.editor).toContain("deleteDialogA11y.modalRef");
    expect(source.editor).toContain("unsavedDialogA11y.modalRef");
    expect(source.editor).toContain("settingsDialogA11y.modalRef");
    expect(source.editor).toContain("deleteDialogA11y.handleKeyDown");
    expect(source.editor).toContain("unsavedDialogA11y.handleKeyDown");
    expect(source.editor).toContain("settingsDialogA11y.handleKeyDown");
  });

  it("keeps mobile shared wallpaper from nesting a memory backdrop", () => {
    const emptyListBlock =
      /totalCount === 0[\s\S]*?data-testid="journal-empty-list"[\s\S]*?renderDailyReflectionPrompt/.exec(
        source.entryList,
      )?.[0] ?? "";

    expect(emptyListBlock).toContain("{!useSharedDiaryWallpaper && <JournalMemoryBackdrop />}");
    expect(source.module).toContain("useSharedDiaryWallpaper={showJournalSidebarAtmosphere}");
    expect(source.module).toContain("journal-mobile-diary-sidebar");
  });

  it("keeps every V2 page-mode diary list and settings sheet on the shared wallpaper material", () => {
    const listCalls = source.module.match(/<LazyJournalEntryList[\s\S]*?\/>/g) ?? [];
    const mobileSelectedDayList = listCalls.find((call) => call.includes("selectedDateOnly"));
    const hubListBlock = /<JournalEntryList[\s\S]*?showFab=\{false\}/.exec(source.hubShell)?.[0] ?? "";
    const mobileSettingsPanelBlock =
      /data-testid="journal-mobile-settings-panel"[\s\S]*?journal-mobile-settings-close/.exec(
        source.module,
      )?.[0] ?? "";

    expect(listCalls.length).toBeGreaterThanOrEqual(3);
    for (const listCall of listCalls) {
      expect(listCall).toContain("useSharedDiaryWallpaper={showJournalSidebarAtmosphere}");
    }
    expect(mobileSelectedDayList).toBeTruthy();
    expect(source.hubShell).toContain("useSharedDiaryWallpaper?: boolean;");
    expect(source.hubShell).toContain("useSharedDiaryWallpaper = false");
    expect(hubListBlock).toContain("useSharedDiaryWallpaper={useSharedDiaryWallpaper}");
    expect(mobileSettingsPanelBlock).toContain("journal-diary-glass-panel");
    expect(mobileSettingsPanelBlock).not.toContain("bg-card rounded-t-2xl");
    expect(mobileSettingsPanelBlock).not.toContain("overflow-y-auto overscroll-contain bg-card p-5");
  });

  it("uses localized, semantic labels for selection and slash command toolbars", () => {
    expect(source.formatToolbar).toContain("labelKey");
    expect(source.formatToolbar).not.toContain("aria-label={action.icon}");
    expect(source.slashMenu).toContain("journalSlashCommands");
    expect(source.slashMenu).toContain("journalSlashNoResults");
    expect(source.slashMenu).not.toContain("% filtered.length");
  });

  it("labels sticker picker and editor sticker removal semantically", () => {
    expect(source.stickerPicker).toContain("aria-labelledby");
    expect(source.stickerPicker).toContain("aria-pressed");
    expect(source.stickerPicker).toContain("aria-label={");
    expect(source.editor).toContain("journalRemoveSticker");
    expect(source.editor).toContain("aria-label={");
    expect(source.editor).toContain("ts.journalRemoveSticker ||");
  });

  it("keeps the restored quote ritual unaffiliated, localized, and pressure-free", () => {
    expect(source.journalQuotes).toContain("JOURNAL_EMPTY_QUOTES");
    expect(source.journalQuotes).toContain("quoteJournal1");
    expect(source.journalQuotes).toContain("quoteJournal30");
    expect(source.emptyCanvas).toContain("getJournalQuote(ts)");
    expect(source.entryList).toContain("getJournalQuote(ts)");
    expect(source.module).toContain("getJournalQuote(ts)");
    expect(source.entryList).not.toContain("ts.journalEmptyQuote");
    expect(source.emptyCanvas).toContain('data-testid="diary-reflection-quote"');
    expect(source.emptyCanvas).toContain("journalReflectionQuoteLabel");
    expect(source.emptyCanvas).toContain("focus-visible:ring-2");
    expect(source.emptyCanvas).toContain('en: "Quiet night"');
    expect(source.emptyCanvas).toContain('uk: "Тиха ніч"');
    expect(source.emptyCanvas).not.toContain("Still up?");
    expect(source.emptyCanvas).not.toContain("Ще не спиш?");
    expect(source.emptyCanvas).not.toContain("author:");
    expect(source.entryList).not.toContain("author:");
    expect(source.entryList).not.toContain("You haven't written in {days} days");
    expect(source.entryList).not.toContain("Write what disturbs you");
    expect(source.entryList).not.toContain("The unexamined life is not worth living");
    expect(source.journalQuotes).toContain("JOURNAL_FIRST_USE_QUOTES");
  });
  it("separates diary load and AI search failures from empty states", () => {
    expect(source.useJournal).toContain("loadError");
    expect(source.useJournal).toContain("setInitialLoadError");
    expect(source.useJournal).toContain("setHistoryLoadError");
    expect(source.useJournal).toContain("setDateLoadError");
    expect(source.module).toContain("journal.loadError");
    expect(source.module).toContain("journalLoadFailed");
    expect(source.module).toContain("journalRetryLoad");
    expect(source.entryList).toContain("aiSearchError");
    expect(source.entryList).toContain("journalAiSearchUnavailable");
    expect(source.entryList).not.toContain("AI semantic search failure shows empty results");
  });

  it("keeps shortcut help and interactive state semantics aligned", () => {
    expect(source.shortcuts).toContain("+Enter");
    expect(source.shortcuts).not.toContain("keys: [`${mod}+S`]");
    expect(source.editor).toContain("aria-pressed={showBurnWidget}");
    expect(source.editor).toContain("aria-pressed={showGratitudeWidget}");
    expect(source.editor).toContain("aria-pressed={showBreathe}");
    expect(source.editor).toContain("aria-pressed={zenFocusActive}");
    expect(source.editor).toContain("aria-pressed={showHabits}");
    expect(source.editor).toContain("aria-pressed={paperColor === pc}");
    expect(source.editor).toContain("aria-pressed={inkColor === c.hex}");
    expect(source.editor).toContain("aria-pressed={showTags}");
    expect(source.saveIndicator).toContain("min-h-[44px]");
    expect(source.saveIndicator).toContain("journalSaveFailedHint");
    expect(source.saveIndicator).toContain('role={state === "error" ? "alert" : "status"}');
    expect(source.saveIndicator).toContain('aria-live={state === "error" ? "assertive" : "polite"}');
  });

  it("keeps copy neutral while restoring the full legacy quoteJournal contract", () => {
    expect(source.entryList).not.toContain("Your thoughts are worth preserving");
    expect(source.module).toContain("journalWriteFirstEntry");
    expect(source.types).toContain("quoteJournal1: string;");
    expect(source.types).toContain("quoteJournal30: string;");
    for (const locale of localeFiles) {
      expect(locale.source, "quoteJournal1 missing from " + locale.language).toContain("quoteJournal1:");
      expect(locale.source, "quoteJournal30 missing from " + locale.language).toContain("quoteJournal30:");
    }
  });

});
