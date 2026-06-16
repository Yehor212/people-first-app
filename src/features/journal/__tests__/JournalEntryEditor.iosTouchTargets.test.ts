import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editorSource = readFileSync("src/features/journal/JournalEntryEditor.tsx", "utf8");
const editorButtonSource = Array.from(
  editorSource.matchAll(/<(?:motion\.)?button[\s\S]*?<\/(?:motion\.)?button>/g),
  (match) => match[0],
).join("\n");
const touchTargetSources = {
  photoGrid: readFileSync("src/features/journal/PhotoGridLayout.tsx", "utf8"),
  habitSection: readFileSync("src/features/journal/JournalHabitSection.tsx", "utf8"),
  journalModule: readFileSync("src/features/journal/JournalModule.tsx", "utf8"),
  stickerPicker: readFileSync("src/features/journal/JournalStickerPicker.tsx", "utf8"),
};
const relatedInteractiveSource = Object.values(touchTargetSources)
  .flatMap((fileSource) =>
    Array.from(fileSource.matchAll(/<(?:motion\.)?(?:button|input)[\s\S]*?(?:<\/(?:motion\.)?button>|\/>)/g), (match) => match[0]),
  )
  .join("\n");

describe("JournalEntryEditor iOS touch targets", () => {
  it("keeps mobile editor chrome controls at least 44px", () => {
    expect(editorSource).toContain(
      "flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5",
    );
    expect(editorSource).toContain(
      "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full",
    );
  });


  it("keeps the mobile editor above iPad sidebar stacking contexts", () => {
    expect(editorSource).toContain('import { createPortal } from "react-dom";');
    expect(editorSource).toContain('const editorShell = (');
    expect(editorSource).toContain('desktop || typeof document === "undefined"');
    expect(editorSource).toContain('createPortal(editorShell, document.body)');
  });

  it("keeps iPad and dense editor controls at least 44px", () => {
    expect(editorSource).toContain("h-11 w-11 rounded-full");
    expect(editorSource).toContain("h-11 w-11 rounded-lg");
    expect(editorSource).toContain("min-h-[44px] rounded-xl border px-3");
    expect(editorSource).toContain("block min-h-[44px] w-full rounded-xl");
    expect(editorButtonSource).not.toContain("w-9 h-9");
    expect(editorButtonSource).not.toContain("h-9 w-9");
    expect(editorButtonSource).not.toContain("w-8 h-8");
    expect(editorButtonSource).not.toContain("h-8 w-8");
    expect(editorButtonSource).not.toContain("w-7 h-7");
    expect(editorButtonSource).not.toContain("h-7 w-7");
    expect(editorButtonSource).not.toContain("min-h-[36px]");
    expect(editorButtonSource).not.toContain("min-h-[40px]");
  });

  it("keeps the desktop style toolbar tap-safe on iPad WebKit", () => {
    const styleToolbarSource =
      /ROW 2: Collapsible style panel[\s\S]*?Visual capsule/.exec(editorSource)?.[0] ?? "";

    expect(styleToolbarSource).toContain("min-h-[44px] min-w-[44px]");
    expect(styleToolbarSource).not.toContain('"px-3 py-1.5 rounded-lg text-xs font-medium border motion-safe:transition-all"');
    expect(styleToolbarSource).not.toContain('"px-4 py-2 rounded-lg text-sm font-medium border motion-safe:transition-all flex items-center gap-1.5"');
    expect(styleToolbarSource).not.toContain('"px-3 py-2 rounded-lg text-sm font-medium border border-transparent');
    expect(styleToolbarSource).not.toContain('"px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground');
  });

  it("keeps related diary media, sticker, habit, and settings controls tap-safe on iOS", () => {
    expect(touchTargetSources.photoGrid).toContain("relative min-h-[44px] min-w-[44px] overflow-visible");
    expect(touchTargetSources.photoGrid).toContain("min-h-[44px] min-w-[44px]");
    expect(touchTargetSources.photoGrid).not.toContain("relative rounded-xl overflow-hidden cursor-pointer group");
    expect(touchTargetSources.photoGrid).not.toContain("absolute -top-3 -end-3");
    expect(touchTargetSources.photoGrid).not.toContain("opacity-0 group-hover:opacity-100");
    expect(touchTargetSources.habitSection).toContain("min-h-[44px]");
    expect(touchTargetSources.journalModule).toContain("min-h-[44px]");
    expect(touchTargetSources.stickerPicker).toContain("min-h-[44px] flex flex-col");
    expect(relatedInteractiveSource).not.toContain("min-h-[36px]");
    expect(relatedInteractiveSource).not.toContain("min-h-[40px]");
    expect(relatedInteractiveSource).not.toContain("w-7 h-7 flex items-center justify-center opacity-0");
  });

  it("keeps the native date input hidden from touch hit testing", () => {
    expect(editorSource).toContain(
      'className="pointer-events-none absolute h-px w-px opacity-0"',
    );
    expect(editorSource).toContain('aria-hidden="true"');
    expect(editorSource).toContain("tabIndex={-1}");
  });
});
