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
const runtimeKeys = [
  "saving",
  "resetDataSuccess",
  "resetDataError",
  "resetting",
  "offlineBannerStorageLimit",
  "invalidNameCharacters",
] as const;

describe("Settings and recovery runtime copy", () => {
  it("provides every reachable state in all eight supported languages", () => {
    const english = en as unknown as Record<string, string>;

    for (const [language, translations] of Object.entries(locales)) {
      const record = translations as unknown as Record<string, string>;
      for (const key of runtimeKeys) {
        expect(record[key], `${language}.${key}`).toBeTruthy();
        if (language !== "en") {
          expect(record[key], `${language}.${key}`).not.toBe(english[key]);
        }
      }
    }
  });
});
