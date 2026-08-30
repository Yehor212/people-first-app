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
      "forest",
      "rain",
      "ocean",
      "fireplace",
      "river",
      "wind",
    ]);
    expect(HYPERFOCUS_AUDIO_FAMILIES.map((family) => family.labelKey)).toEqual([
      "hyperfocusSoundForest",
      "hyperfocusSoundRain",
      "hyperfocusSoundOcean",
      "hyperfocusSoundFireplace",
      "hyperfocusSoundRiver",
      "hyperfocusSoundWind",
    ]);
    expect(HYPERFOCUS_AUDIO_LEVEL_IDS).toEqual(["soft", "deep", "intense"]);

    for (const family of HYPERFOCUS_AUDIO_FAMILIES) {
      expect(
        family.levels.map((level) => level.id),
        family.id
      ).toEqual(HYPERFOCUS_AUDIO_LEVEL_IDS);
      expect(family.legacyId, family.id).toBe(family.id);
      expect(family.legacyAssetId, family.id).toMatch(/^focus-/);
    }
  });

  it("uses truthful generic intensity labels instead of obsolete scene claims", () => {
    for (const family of HYPERFOCUS_AUDIO_FAMILIES) {
      expect(family.levels.map((level) => level.label), family.id).toEqual([
        "Soft",
        "Deep",
        "Intense",
      ]);
      expect(family.levels.map((level) => level.labelKey), family.id).toEqual([
        "hyperfocusSoundLevelSoft",
        "hyperfocusSoundLevelDeep",
        "hyperfocusSoundLevelIntense",
      ]);
    }
  });

  it("keeps variant ids stable and parseable while preserving legacy ids", () => {
    expect(getHyperfocusVariantId("fireplace", "soft")).toBe("fireplace:soft");
    expect(parseHyperfocusVariantId("fireplace:soft")).toEqual({
      familyId: "fireplace",
      levelId: "soft",
    });
    expect(parseHyperfocusVariantId("fireplace")).toEqual({
      familyId: "fireplace",
      levelId: "deep",
    });
    expect(parseHyperfocusVariantId("cafe")).toEqual({
      familyId: "forest",
      levelId: "deep",
    });
    expect(parseHyperfocusVariantId("cafe:soft")).toEqual({
      familyId: "forest",
      levelId: "soft",
    });
    expect(parseHyperfocusVariantId("fireplace:unknown")).toBeNull();
    expect(parseHyperfocusVariantId("unknown:soft")).toBeNull();
  });

  it("marks every shipped recovery variant as available from the bundled Hyperfocus pack", () => {
    for (const family of HYPERFOCUS_AUDIO_FAMILIES) {
      for (const level of family.levels) {
        const variant = getHyperfocusAudioVariant(level.variantId);

        expect(variant, level.variantId).toMatchObject({
          familyId: family.id,
          levelId: level.id,
          id: level.variantId,
          generated: true,
          fileName: `hyperfocus-${family.id}-${level.id}.mp3`,
          runtimePublicPath: `sounds/hyperfocus/hyperfocus-${family.id}-${level.id}.mp3`,
        });
      }
    }
  });
});
