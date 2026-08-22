import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ar } from "../../src/i18n/languages/ar";
import { de } from "../../src/i18n/languages/de";
import { en } from "../../src/i18n/languages/en";
import { es } from "../../src/i18n/languages/es";
import { fr } from "../../src/i18n/languages/fr";
import { he } from "../../src/i18n/languages/he";
import { ja } from "../../src/i18n/languages/ja";
import { uk } from "../../src/i18n/languages/uk";
import {
  createLocaleAssetPlugin,
  parseStaticLocaleDictionary,
} from "../../vite-plugin-locale-assets";

const ROOT = path.resolve(import.meta.dirname, "../..");
const LANGUAGE_DIR = path.join(ROOT, "src/i18n/languages");
const expected = { uk, es, de, fr, ja, ar, he } as const;

function transformHook(plugin: ReturnType<typeof createLocaleAssetPlugin>) {
  if (typeof plugin.transform !== "function") {
    throw new Error("Locale asset plugin must expose a transform hook");
  }
  return plugin.transform;
}

describe("production locale asset plugin", () => {
  it("emits every non-English dictionary as exact deterministic JSON", async () => {
    const plugin = createLocaleAssetPlugin({ rootDirectory: ROOT });
    const transform = transformHook(plugin);

    for (const [language, dictionary] of Object.entries(expected)) {
      const emitted: Array<{ type: string; name?: string; source?: string | Uint8Array }> = [];
      const file = path.join(LANGUAGE_DIR, `${language}.ts`);
      const result = await transform.call(
        {
          emitFile(asset: { type: string; name?: string; source?: string | Uint8Array }) {
            emitted.push(asset);
            return `asset-${language}`;
          },
        } as never,
        readFileSync(file, "utf8"),
        file,
      );

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toMatchObject({ type: "asset", name: `locale-${language}.json` });
      expect(JSON.parse(String(emitted[0].source))).toEqual(dictionary);
      expect(result).toMatchObject({
        code: expect.stringContaining(`import.meta.ROLLUP_FILE_URL_asset-${language}`),
      });
      expect(result).toMatchObject({ code: expect.stringContaining("if (!response.ok)") });
      expect(result).toMatchObject({ code: expect.stringContaining(`export const ${language}`) });
    }
  });

  it("leaves synchronous English source inside the application bundle", async () => {
    const plugin = createLocaleAssetPlugin({ rootDirectory: ROOT });
    const transform = transformHook(plugin);
    let emitCount = 0;
    const file = path.join(LANGUAGE_DIR, "en.ts");
    const result = await transform.call(
      {
        emitFile() {
          emitCount += 1;
          return "unexpected";
        },
      } as never,
      readFileSync(file, "utf8"),
      file,
    );

    expect(result).toBeNull();
    expect(emitCount).toBe(0);
    expect(en.appName).toBe("ZenFlow");
  });

  it("fails the build instead of evaluating dynamic locale expressions", () => {
    expect(() => parseStaticLocaleDictionary(
      'export const uk = { appName: makeTranslation("ZenFlow") };',
      "uk.ts",
    )).toThrow(/Unsupported locale value/);
  });
});
