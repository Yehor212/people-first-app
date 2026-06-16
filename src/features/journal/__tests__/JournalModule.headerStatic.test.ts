import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/features/journal/JournalModule.tsx", "utf8");

describe("JournalModule V2 header", () => {
  it("uses the shared V2 menu glyph and calm 48px button for the diary drawer trigger", () => {
    expect(source).toContain('import { V2_SHELL_ICONS } from "@/lib/v2IconSystem"');
    expect(source).toContain("const JournalMenuIcon = V2_SHELL_ICONS.menu");
    expect(source).not.toContain("PanelLeftOpen");

    const menuClass = /const mobileHeaderMenuClass =\s*"([^"]+)";/.exec(source)?.[1] ?? "";
    expect(menuClass).toContain("h-[48px] w-[48px]");
    expect(menuClass).toContain("rounded-full");
    expect(menuClass).toContain("bg-card/70");
    expect(menuClass).not.toContain("press-stable");

    const menuButtonBlock = /<button[\s\S]*?data-testid="journal-mobile-nav-menu"[\s\S]*?<\/button>/.exec(source)?.[0] ?? "";
    expect(menuButtonBlock).toContain("<JournalMenuIcon");
    expect(menuButtonBlock).toContain('aria-controls="nav-v2-drawer"');
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

  it("makes the mobile diary settings sheet bounded and internally scrollable", () => {
    expect(source).toContain("max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)]");
    expect(source).toContain("flex-col overflow-hidden");
    expect(source).toContain("min-h-0 flex-1 overflow-y-auto overscroll-contain bg-card");
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
});
