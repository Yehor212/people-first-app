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

  it("decodes thumbnails in the grid and hydrates full data only for the lightbox", () => {
    expect(source).toContain("getPhotoPreviewById");
    expect(source).toContain("src={photo.thumbnail || photo.data}");
    expect(source).toContain("getPhotoById(photo.id)");
    expect(source).toContain("requestId !== lightboxRequestIdRef.current");
    expect(source).toContain("src={fullData || lightboxPhoto.thumbnail}");
  });

  it("keeps the lightbox counter above the bottom safe area", () => {
    expect(source).toContain("bottom-[max(1rem,env(safe-area-inset-bottom))]");
  });
});
