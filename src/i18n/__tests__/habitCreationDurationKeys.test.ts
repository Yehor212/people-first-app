import { describe, expect, it } from "vitest";
import { loadLanguage } from "../translations";
import type { Language } from "../types";

const LANGUAGES: readonly Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const REQUIRED_KEYS = [
  "habitDurationOngoing",
  "habitDurationSetDays",
  "habitDurationHint",
] as const;

describe("habit creation duration i18n", () => {
  it("defines duration setup copy in every supported language", async () => {
    for (const language of LANGUAGES) {
      const translations = await loadLanguage(language);
      for (const key of REQUIRED_KEYS) {
        expect(translations[key], `${language}.${key}`).toBeTruthy();
      }
    }
  });
});
