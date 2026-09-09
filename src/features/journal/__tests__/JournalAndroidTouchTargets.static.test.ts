import { readFileSync } from "node:fs";
import postcss, { type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("journal Android touch targets", () => {
  it("raises every interactive control to 48px only in the Android runtime", () => {
    const css = read("src/index.css");
    const rules: Rule[] = [];
    postcss.parse(css).walkRules(rule => {
      if (rule.selector.replace(/\s+/g, " ").startsWith(':root[data-platform="android"] :where(')) {
        rules.push(rule);
      }
    });
    expect(rules).toHaveLength(1);
    const androidRule = rules[0].toString();

    expect(androidRule).toContain("button");
    expect(androidRule).toContain('[role="button"]');
    expect(androidRule).toContain("a[href]");
    expect(androidRule).toContain('input:not([type="hidden"])');
    expect(androidRule).toContain("select");
    expect(androidRule).toContain("textarea");
    expect(androidRule).toContain("min-width: 48px");
    expect(androidRule).toContain("min-height: 48px");
  });

  it("lets translated mobile editor tool labels wrap instead of clipping", () => {
    const editorSource = read("src/features/journal/JournalEntryEditor.tsx");
    const mobileTools = editorSource.slice(
      editorSource.indexOf('data-testid="journal-mobile-tools"'),
      editorSource.indexOf("{/* Sub-pickers */}"),
    );

    expect(mobileTools).not.toContain("truncate");
    expect(mobileTools).toContain("whitespace-normal");
    expect(mobileTools).toContain("break-words");
    expect(mobileTools).toContain(
      "zf-auto-fit-grid-9",
    );
    expect(mobileTools).not.toContain("minmax(min(100%,9rem)");
    expect(mobileTools).not.toContain("min-[360px]:grid-cols-4");
    expect(mobileTools).not.toContain("text-[10px]");
    expect(mobileTools).toContain("text-xs");
    expect(mobileTools).toContain("[hyphens:manual]");
    expect(mobileTools).toContain("[overflow-wrap:break-word]");
    expect(mobileTools).not.toContain("[overflow-wrap:anywhere]");
  });

  it("keeps the expanded mobile tools vertically reachable on short viewports", () => {
    const editorSource = read("src/features/journal/JournalEntryEditor.tsx");
    const mobileToolsPanel = editorSource.slice(
      editorSource.indexOf('data-testid="journal-mobile-tools-panel"'),
      editorSource.indexOf('data-testid="journal-mobile-tools"'),
    );

    expect(mobileToolsPanel).toContain(
      "max-h-[calc(var(--app-viewport-height)*0.72)]",
    );
    expect(mobileToolsPanel).toContain("overflow-y-auto");
    expect(mobileToolsPanel).toContain("overscroll-contain");
    expect(mobileToolsPanel).toContain("touch-pan-y");
  });
});
