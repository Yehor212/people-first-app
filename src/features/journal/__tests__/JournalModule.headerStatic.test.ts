import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/features/journal/JournalModule.tsx", "utf8");

describe("JournalModule V2 header", () => {
  it("uses the shared V2 menu glyph and calm 48px button for the diary drawer trigger", () => {
    expect(source).toContain('import { V2_SHELL_ICONS } from "@/lib/v2IconSystem"');
    expect(source).toContain("const JournalMenuIcon = V2_SHELL_ICONS.menu");
    expect(source).not.toContain("PanelLeftOpen");

    const menuClass = /const mobileHeaderMenuClass =\s*"([^"]+)";/.exec(source)?.[1] ?? "";
    expect(menuClass).toContain("h-12 w-12");
    expect(menuClass).toContain("rounded-full");
    expect(menuClass).toContain("bg-card/70");
    expect(menuClass).not.toContain("press-stable");

    const menuButtonBlock = /<button[\s\S]*?data-testid="journal-mobile-nav-menu"[\s\S]*?<\/button>/.exec(source)?.[0] ?? "";
    expect(menuButtonBlock).toContain("<JournalMenuIcon");
    expect(menuButtonBlock).toContain('aria-controls="nav-v2-drawer"');
  });
});
