import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ar } from "@/i18n/languages/ar";
import { de } from "@/i18n/languages/de";
import { en } from "@/i18n/languages/en";
import { es } from "@/i18n/languages/es";
import { fr } from "@/i18n/languages/fr";
import { he } from "@/i18n/languages/he";
import { ja } from "@/i18n/languages/ja";
import { uk } from "@/i18n/languages/uk";

describe("private journal search consent disclosure", () => {
  it("names the ZenFlow account boundary and excludes an external AI payload", () => {
    for (const translations of [en, uk, es, de, fr, ja, ar, he]) {
      expect(translations.journalAiPrivacyConfirm).toContain("Supabase");
      expect(translations.journalAiPrivacyConfirm).not.toContain("10,000");
      expect(translations.journalAiPrivacyConfirm).not.toContain("Google Gemini");
    }
  });

  it("keeps the docs privacy policy aligned with the account-backed lexical runtime", () => {
    const policy = readFileSync("docs/privacy-policy.html", "utf8");
    expect(policy).toContain("sends your search query to a Supabase Edge Function");
    expect(policy).toContain("does not send journal text or search queries");
    expect(policy).toContain("does not create a separate search index");
  });
});
