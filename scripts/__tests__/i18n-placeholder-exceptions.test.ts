import { describe, expect, it } from "vitest";

import { isAllowedPlaceholderDifference } from "../i18n-placeholder-exceptions";

describe("deep i18n placeholder exceptions", () => {
  it("allows only lexicalized cardinality in the five reviewed Arabic and Hebrew branches", () => {
    for (const [language, key] of [
      ["ar", "offlineBannerPending_zero"],
      ["ar", "offlineBannerPending_one"],
      ["ar", "offlineBannerPending_two"],
      ["he", "offlineBannerPending_one"],
      ["he", "offlineBannerPending_two"],
    ] as const) {
      expect(isAllowedPlaceholderDifference(language, key, ["{count}"], [])).toBe(true);
      expect(isAllowedPlaceholderDifference(language, key, ["{count}"], ["{wrong}"])).toBe(false);
      expect(isAllowedPlaceholderDifference(language, key, ["{hours}"], [])).toBe(false);
    }

    expect(
      isAllowedPlaceholderDifference("ar", "offlineBannerPending_many", ["{count}"], []),
    ).toBe(false);
    expect(
      isAllowedPlaceholderDifference("uk", "offlineBannerPending_one", ["{count}"], []),
    ).toBe(false);
  });
});
