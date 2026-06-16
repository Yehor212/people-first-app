import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/features/journal/JournalPhotoGallery.tsx"), "utf8");

describe("JournalPhotoGallery iOS touch targets", () => {
  it("keeps editable float photo action visible and tap-safe on touch devices", () => {
    const ariaIndex = source.indexOf("ariaFloatPhoto");
    expect(ariaIndex).toBeGreaterThanOrEqual(0);
    const buttonStart = source.lastIndexOf("<button", ariaIndex);
    const buttonEnd = source.indexOf("</button>", ariaIndex);
    const floatButton = source.slice(buttonStart, buttonEnd);

    expect(floatButton).toContain("min-w-[44px]");
    expect(floatButton).toContain("min-h-[44px]");
    expect(floatButton).not.toContain("opacity-0");
    expect(floatButton).not.toContain("group-hover:opacity-100");
    expect(source).toContain("MoveDiagonal2");
  });
});
