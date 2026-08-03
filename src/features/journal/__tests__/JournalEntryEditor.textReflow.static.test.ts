import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editorSource = readFileSync("src/features/journal/JournalEntryEditor.tsx", "utf8");

describe("JournalEntryEditor text reflow", () => {
  it("uses ZenFlow scalable type tokens for every visible editor label", () => {
    for (const fixedSize of ["text-[9px]", "text-[10px]", "text-[11px]"]) {
      expect(editorSource).not.toContain(fixedSize);
    }
  });

  it("keeps entry identity, dates, speech previews, and actionable tags fully readable", () => {
    expect(editorSource).not.toContain("truncate");
    expect(editorSource).not.toContain("whitespace-nowrap");
    expect(editorSource).toContain(
      "grid grid-cols-1 items-start gap-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto]"
    );
    expect(editorSource).toContain(
      "font-bold tracking-tight whitespace-normal break-words [overflow-wrap:anywhere] font-display"
    );
    expect(editorSource).toContain(
      "max-w-full flex-wrap whitespace-normal break-words [overflow-wrap:anywhere]"
    );
    expect(editorSource).toContain(
      "basis-full whitespace-normal break-words [overflow-wrap:anywhere]"
    );
    expect(editorSource).toContain(
      "max-w-full min-w-0 whitespace-normal break-words text-start [overflow-wrap:anywhere]"
    );
  });

  it("stacks dense style controls before labels can collide and wraps supporting metrics", () => {
    expect(editorSource).toContain("grid grid-cols-1 gap-2 min-[420px]:grid-cols-2");
    expect(editorSource).not.toContain('className="grid gap-2 grid-cols-2 pb-1"');
    expect(editorSource).toContain("col-span-full");
    expect(editorSource).toContain("flex flex-wrap items-center gap-x-3 gap-y-1 pt-2");
    expect(editorSource).toContain(
      "flex flex-col items-stretch gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"
    );

    const horizontalToolScrolls = editorSource.match(/overflow-x-auto/g) ?? [];
    expect(horizontalToolScrolls).toHaveLength(1);
    expect(editorSource).toContain(
      'desktop\n                  ? "flex items-center gap-2 overflow-x-auto'
    );
  });
});
