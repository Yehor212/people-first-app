import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editorSource = readFileSync("src/features/journal/JournalEntryEditor.tsx", "utf8");

describe("JournalEntryEditor iOS touch targets", () => {
  it("keeps mobile editor chrome controls at least 44px", () => {
    expect(editorSource).toContain(
      "flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5",
    );
    expect(editorSource).toContain(
      "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full",
    );
  });

  it("keeps the native date input hidden from touch hit testing", () => {
    expect(editorSource).toContain(
      'className="pointer-events-none absolute h-px w-px opacity-0"',
    );
    expect(editorSource).toContain('aria-hidden="true"');
    expect(editorSource).toContain("tabIndex={-1}");
  });
});
