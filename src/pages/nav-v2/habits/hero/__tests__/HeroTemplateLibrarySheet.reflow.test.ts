import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/pages/nav-v2/habits/hero/HeroTemplateLibrarySheet.tsx",
  "utf8",
);

describe("HeroTemplateLibrarySheet reflow contract", () => {
  it("uses the shared viewport, safe areas, and Android back handling", () => {
    expect(source).toContain("useBackHandler(open, onClose)");
    expect(source).toContain(
      "max-h-[calc(var(--app-viewport-height)-var(--safe-top)-0.75rem)]",
    );
    expect(source).not.toContain("max-h-[87vh]");
    expect(source).toContain("var(--safe-inline-start)");
    expect(source).toContain("var(--safe-inline-end)");
    expect(source).toContain("var(--safe-bottom)");
  });

  it("lets localized templates reflow without hiding their labels", () => {
    expect(source).toContain(
      "grid-cols-[repeat(auto-fit,minmax(min(100%,calc(9rem*var(--font-scale,1))),1fr))]",
    );
    expect(source).not.toContain("grid-cols-2");
    expect(source).not.toContain("line-clamp-2");
    expect(source).not.toContain("text-[10px]");
    expect(source).toContain("whitespace-normal break-words");
    expect(source).toContain("[hyphens:manual] [overflow-wrap:break-word]");
  });
});
