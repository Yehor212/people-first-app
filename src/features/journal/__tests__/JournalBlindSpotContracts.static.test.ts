import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

function hasLocalizedPhotoLimitCall(source: string): boolean {
  const sourceFile = ts.createSourceFile(
    "JournalEntryEditor.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let found = false;

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "formatLocalizedCount"
    ) {
      const [count, language, translations, keyPrefix] = node.arguments;
      found =
        ts.isNumericLiteral(count) &&
        count.text === "0" &&
        ts.isIdentifier(language) &&
        language.text === "language" &&
        ts.isIdentifier(translations) &&
        translations.text === "ts" &&
        ts.isStringLiteral(keyPrefix) &&
        keyPrefix.text === "journalPhotoRemainingCount";
    }
    if (!found) ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
}

describe("journal blind-spot contracts", () => {
  it("does not use elapsed 24-hour arithmetic for journal civil dates", () => {
    for (const path of [
      "src/features/journal/JournalCalendar.tsx",
      "src/features/journal/JournalCalendarFull.tsx",
      "src/features/journal/computeStreaks.ts",
      "src/features/journal/useJournal.ts",
      "src/features/journal/JournalEntryList.tsx",
      "src/features/journal/JournalModule.tsx",
      "src/features/journal/JournalStats.tsx",
      "src/features/journal/TypewriterText.tsx",
      "src/features/journal/useJournalReminder.ts",
      "src/features/journal/journalQuotes.ts",
    ]) {
      expect(read(path), path).not.toMatch(/(?:86_?400_?000|86400000)/);
    }
  });

  it("resolves the photo-limit placeholder and avoids a duplicate entry count", () => {
    const editor = read("src/features/journal/JournalEntryEditor.tsx");
    const module = read("src/features/journal/JournalModule.tsx");
    expect(hasLocalizedPhotoLimitCall(editor)).toBe(true);
    expect(module).not.toContain(
      '<span className="font-semibold text-foreground">{entryCount}</span>'
    );
  });

  it("does not pressure returning users with an automatic inactivity banner", () => {
    const list = read("src/features/journal/JournalEntryList.tsx");
    expect(list).not.toContain('"journalInactiveBannerCount"');
    expect(list).not.toContain("daysSinceLastEntry >= 2");
  });

  it("keeps favorite metadata out of every user-facing tag surface", () => {
    for (const path of [
      "src/features/journal/journalExport.ts",
      "src/features/journal/JournalEntryList.tsx",
      "src/features/journal/MemoryPortalCanvas.tsx",
    ]) {
      expect(read(path), path).toContain("getVisibleJournalTags");
    }

    const stats = read("src/features/journal/JournalStats.tsx");
    expect(stats).not.toMatch(/(?:entry|entries)\.tags/);
  });

  it("mirrors directional controls in RTL", () => {
    const sidebar = read("src/features/journal/SidebarCompact.tsx");
    const module = read("src/features/journal/JournalModule.tsx");
    expect(sidebar).toMatch(/PanelLeftOpen[^>]*rtl:scale-x-\[-1\]/);
    expect(sidebar).toMatch(/PanelLeftClose[^>]*rtl:scale-x-\[-1\]/);
    expect(module).toMatch(/ChevronRight[^>]*rtl:rotate-0/);
    expect(module).toMatch(/PanelLeftOpen[^>]*rtl:scale-x-\[-1\]/);
  });
});
