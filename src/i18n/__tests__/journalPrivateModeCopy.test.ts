import { describe, expect, it } from "vitest";

import { ar } from "../languages/ar";
import { he } from "../languages/he";

describe("journal private-mode copy", () => {
  it("isolates the Latin ZenFlow brand in Arabic and Hebrew warnings", () => {
    for (const [language, translations] of Object.entries({ ar, he })) {
      const warnings = [
        translations.journalPrivateModeLoadError,
        translations.journalPrivateModeSaveError,
        translations.journalPrivateModeTemporaryRevealError,
      ];

      for (const warning of warnings) {
        expect(warning, language).toContain("\u2066ZenFlow\u2069");
        expect(warning, language).not.toMatch(/[\u202A-\u202E]/u);
      }
    }
  });
});
