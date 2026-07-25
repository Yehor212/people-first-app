import { describe, expect, it } from "vitest";
import {
  isJournalPhotoPlaced,
  normalizeJournalPhotoLayout,
  placeJournalPhotoOnPage,
  returnJournalPhotoToGallery,
} from "../photoLayout";

describe("normalizeJournalPhotoLayout", () => {
  it("preserves a bounded optional photo description through import and replay", () => {
    const normalized = normalizeJournalPhotoLayout(
      {
        "photo-1": {
          x: 50,
          y: 60,
          width: 180,
          description: `  ${"a".repeat(520)}  `,
        },
      },
      ["photo-1"],
    );

    expect(normalized?.["photo-1"].description).toBe("a".repeat(500));
  });

  it("omits empty descriptions instead of persisting placeholder text", () => {
    const normalized = normalizeJournalPhotoLayout(
      {
        "photo-1": { x: 50, y: 60, width: 180, description: "   " },
      },
      ["photo-1"],
    );

    expect(normalized?.["photo-1"]).toEqual({ x: 50, y: 60, width: 180 });
  });

  it("preserves placement and description while a photo is in the gallery, then restores them", () => {
    const placed = {
      "photo-1": {
        x: 34,
        y: 67,
        width: 240,
        description: "Sunset over the lake",
      },
    };

    const inGallery = returnJournalPhotoToGallery(placed, "photo-1");
    expect(inGallery["photo-1"]).toEqual({ ...placed["photo-1"], inGallery: true });
    expect(isJournalPhotoPlaced(inGallery["photo-1"])).toBe(false);

    const restored = placeJournalPhotoOnPage(inGallery, "photo-1");
    expect(restored["photo-1"]).toEqual(placed["photo-1"]);
    expect(isJournalPhotoPlaced(restored["photo-1"])).toBe(true);

    expect(normalizeJournalPhotoLayout(inGallery, ["photo-1"])?.["photo-1"]).toEqual({
      ...placed["photo-1"],
      inGallery: true,
    });
  });
});
