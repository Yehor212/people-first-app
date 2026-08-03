import { describe, expect, it } from "vitest";

import { ar } from "@/i18n/languages/ar";
import { de } from "@/i18n/languages/de";
import { en } from "@/i18n/languages/en";
import { es } from "@/i18n/languages/es";
import { fr } from "@/i18n/languages/fr";
import { he } from "@/i18n/languages/he";
import { ja } from "@/i18n/languages/ja";
import { uk } from "@/i18n/languages/uk";

describe("Mood accessibility copy", () => {
  it.each([
    [en, "How you feel"],
    [uk, "Як ти почуваєшся"],
    [es, "Cómo te sientes"],
    [de, "Wie du dich fühlst"],
    [fr, "Comment tu te sens"],
    [ja, "今の気分"],
    [ar, "كيف تشعر"],
    [he, "איך מרגישים עכשיו"],
  ])("uses a familiar slider name instead of a technical valence term", (translations, expected) => {
    expect(translations.somSlider).toBe(expected);
  });
});
