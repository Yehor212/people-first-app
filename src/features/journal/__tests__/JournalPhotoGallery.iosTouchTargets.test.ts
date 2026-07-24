import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/features/journal/JournalPhotoGallery.tsx"), "utf8");

describe("JournalPhotoGallery cross-platform touch targets", () => {
  it("keeps editable float photo action visible with an Android-grade 48px hit area", () => {
    const ariaIndex = source.indexOf("ariaFloatPhoto");
    expect(ariaIndex).toBeGreaterThanOrEqual(0);
    const buttonStart = source.lastIndexOf("<button", ariaIndex);
    const buttonEnd = source.indexOf("</button>", ariaIndex);
    const floatButton = source.slice(buttonStart, buttonEnd);

    expect(floatButton).toContain("min-w-[48px]");
    expect(floatButton).toContain("min-h-[48px]");
    expect(floatButton).not.toContain("opacity-0");
    expect(floatButton).not.toContain("group-hover:opacity-100");
    expect(source).toContain("MoveDiagonal2");
  });

  it("keeps every destructive and lightbox action at the same 48px minimum", () => {
    expect(source).not.toContain("min-w-[44px]");
    expect(source).not.toContain("min-h-[44px]");
    expect(source.match(/min-w-\[48px\]/g)?.length).toBeGreaterThanOrEqual(6);
    expect(source.match(/min-h-\[48px\]/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("keeps removal on the preview and placement as a separate visible command", () => {
    expect(source).toMatch(/editable\s*\?\s*"w-28 h-28"\s*:\s*"w-16 h-16"/);
    expect(source).toContain('data-journal-photo-action="remove"');
    expect(source).toContain('data-journal-photo-action="float"');
    expect(source).toContain("absolute top-1 end-1");
    expect(source).toContain("{t.ariaFloatPhoto}</span>");
    expect(source).not.toContain("absolute bottom-1 end-1");
    expect(source).not.toContain("-top-3 -end-3");
    expect(source).not.toContain("-bottom-3 -end-3");
  });

  it("decodes thumbnails in the grid and hydrates full data only for the lightbox", () => {
    expect(source).toContain("getPhotoPreviewById");
    expect(source).toContain("src={photo.thumbnail || photo.data}");
    expect(source).toContain("getPhotoById(photo.id, entryId)");
    expect(source).toContain("requestId !== lightboxRequestIdRef.current");
    expect(source).toContain("src={fullData || lightboxPhoto.thumbnail}");
  });

  it("keeps every lightbox control and image inside the shared viewport safe area", () => {
    expect(source).toContain("h-[var(--app-viewport-height)]");
    expect(source).toContain("top-[max(1rem,var(--safe-top))]");
    expect(source).toContain("start-[max(1rem,var(--safe-inline-start))]");
    expect(source).toContain("end-[max(1rem,var(--safe-inline-end))]");
    expect(source).toContain("bottom-[max(1rem,var(--safe-bottom))]");
    expect(source).toContain(
      "max-w-[calc(100vw-var(--safe-left)-var(--safe-right)-2rem)]",
    );
    expect(source).toContain(
      "max-h-[calc(var(--app-viewport-height)-var(--safe-top)-var(--safe-bottom)-4rem)]",
    );
    expect(source).not.toContain("env(safe-area-inset");
    expect(source).not.toContain("90dvh");
  });
});
