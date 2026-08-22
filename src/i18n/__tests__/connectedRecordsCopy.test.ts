import { describe, expect, it } from "vitest";

import { ar } from "../languages/ar";
import { de } from "../languages/de";
import { en } from "../languages/en";
import { es } from "../languages/es";
import { fr } from "../languages/fr";
import { he } from "../languages/he";
import { ja } from "../languages/ja";
import { uk } from "../languages/uk";

const locales = { en, uk, es, de, fr, ja, ar, he } as const;

type StringTranslationKey = NonNullable<{
  [Key in keyof typeof en]: (typeof en)[Key] extends string ? Key : never;
}[keyof typeof en]>;

const connectedRecordKeys = Object.keys(en).filter(
  (key) => key.startsWith("connectedRecords") || key.startsWith("automationHistory"),
) as StringTranslationKey[];

const placeholders = (value: string) =>
  Array.from(value.matchAll(/\{([^}]+)\}/gu), (match) => match[1]).sort();

describe("connected-record localization contract", () => {
  it("keeps every connected-record message present with source placeholder parity", () => {
    expect(connectedRecordKeys.length).toBeGreaterThan(0);

    for (const [language, translations] of Object.entries(locales)) {
      for (const key of connectedRecordKeys) {
        const value = translations[key];
        expect(value.trim(), `${language}.${key}`).not.toBe("");
        expect(placeholders(value), `${language}.${key}`).toEqual(placeholders(en[key]));
      }
    }
  });

  it("isolates the Latin brand in RTL consent copy without directional overrides", () => {
    for (const [language, translations] of Object.entries({ ar, he })) {
      for (const value of [
        translations.connectedRecordsDescription,
        translations.connectedRecordsEnableDescription,
      ]) {
        expect(value, language).toContain("\u2066ZenFlow\u2069");
        expect(value, language).not.toMatch(/[\u202A-\u202E]/u);
      }
    }
  });
});
