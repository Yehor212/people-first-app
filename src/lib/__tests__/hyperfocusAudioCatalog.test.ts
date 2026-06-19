import { describe, expect, it } from "vitest";
import {
  HYPERFOCUS_AUDIO_FAMILIES,
  HYPERFOCUS_AUDIO_LEVEL_IDS,
  getHyperfocusAudioVariant,
  getHyperfocusVariantId,
  parseHyperfocusVariantId,
} from "../hyperfocusAudioCatalog";

describe("hyperfocus three-level audio catalog", () => {
  it("defines six families with three levels each", () => {
    expect(HYPERFOCUS_AUDIO_FAMILIES.map((family) => family.id)).toEqual([
      "underwater",
      "thunderstorm",
      "ocean",
      "river",
      "cafe",
      "fireplace",
    ]);
    expect(HYPERFOCUS_AUDIO_LEVEL_IDS).toEqual(["soft", "deep", "intense"]);

    for (const family of HYPERFOCUS_AUDIO_FAMILIES) {
      expect(family.levels.map((level) => level.id), family.id).toEqual(HYPERFOCUS_AUDIO_LEVEL_IDS);
      expect(family.legacyId, family.id).toBe(family.id);
      expect(family.legacyAssetId, family.id).toMatch(/^focus-/);
    }
  });

  it("keeps variant ids stable and parseable while preserving legacy ids", () => {
    expect(getHyperfocusVariantId("fireplace", "soft")).toBe("fireplace:soft");
    expect(parseHyperfocusVariantId("fireplace:soft")).toEqual({ familyId: "fireplace", levelId: "soft" });
    expect(parseHyperfocusVariantId("fireplace")).toEqual({ familyId: "fireplace", levelId: "deep" });
    expect(parseHyperfocusVariantId("fireplace:unknown")).toBeNull();
    expect(parseHyperfocusVariantId("unknown:soft")).toBeNull();
  });

  it("does not mark generated variants as available until Gemini QC accepts assets", () => {
    const softFireplace = getHyperfocusAudioVariant("fireplace:soft");

    expect(softFireplace).toMatchObject({
      familyId: "fireplace",
      levelId: "soft",
      id: "fireplace:soft",
      generated: false,
      fileName: "hyperfocus-fireplace-soft.mp3",
    });
    expect(softFireplace?.runtimePublicPath).toBeNull();
  });
});
