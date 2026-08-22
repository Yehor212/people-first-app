import { describe, expect, it } from "vitest";

import { ar } from "@/i18n/languages/ar";
import { de } from "@/i18n/languages/de";
import { en } from "@/i18n/languages/en";
import { es } from "@/i18n/languages/es";
import { fr } from "@/i18n/languages/fr";
import { he } from "@/i18n/languages/he";
import { ja } from "@/i18n/languages/ja";
import { uk } from "@/i18n/languages/uk";

describe("ChallengeDetailsView progress copy", () => {
  it.each([
    ["en", en, "{percent}% complete"],
    ["uk", uk, "Виконано на {percent}%"],
    ["es", es, "{percent}% completado"],
    ["de", de, "Zu {percent}% abgeschlossen"],
    ["fr", fr, "Terminé à {percent} %"],
    ["ja", ja, "達成率 {percent}%"],
    ["ar", ar, "مكتمل بنسبة {percent}٪"],
    ["he", he, "הושלם ב־{percent}%"],
  ])("uses a status phrase rather than an action label in %s", (_locale, values, expected) => {
    const translations = values as unknown as Record<string, string>;

    expect(translations.challengeProgressComplete).toBe(expected);
    expect(translations.challengeProgressComplete).toContain("{percent}");
    expect(translations.challengeProgressComplete).not.toBe(translations.complete);
  });
});
