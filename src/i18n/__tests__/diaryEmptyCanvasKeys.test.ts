import { describe, expect, it } from "vitest";
import { loadLanguage } from "../translations";
import type { Language } from "../types";

const LANGUAGES: readonly Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const DIARY_PROMPT_KEYS = [
  "diaryPrompt1",
  "diaryPrompt2",
  "diaryPrompt3",
  "diaryPrompt4",
  "diaryPrompt5",
  "diaryPrompt6",
  "diaryPrompt7",
  "diaryPrompt8",
  "diaryPrompt9",
  "diaryPrompt10",
] as const;

describe("diary empty canvas i18n", () => {
  it("defines first-entry helper copy in every supported language", async () => {
    for (const language of LANGUAGES) {
      const translations = await loadLanguage(language);
      expect(translations.diaryStartFirstEntry, `${language}.diaryStartFirstEntry`).toBeTruthy();
    }
  });

  it("defines wide-screen typewriter prompts in every supported language", async () => {
    for (const language of LANGUAGES) {
      const translations = await loadLanguage(language);
      for (const key of DIARY_PROMPT_KEYS) {
        expect(translations[key], `${language}.${key}`).toBeTruthy();
      }
    }
  });
});
