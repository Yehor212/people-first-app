import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import ts from "typescript";

import { en } from "../../src/i18n/languages/en";
import { uk } from "../../src/i18n/languages/uk";
import { es } from "../../src/i18n/languages/es";
import { de } from "../../src/i18n/languages/de";
import { fr } from "../../src/i18n/languages/fr";
import { ja } from "../../src/i18n/languages/ja";
import { JOURNAL_RECOVERY_TRANSLATION_KEYS } from "../../src/i18n/journalRecoveryTranslations";

import {
  COMPACT_I18N_RESOLVED_ID,
  COMPACT_I18N_VIRTUAL_ID,
  createCompactI18nBuildPlugin,
  parseCompactLocaleModule,
  transformCompactLocaleModule,
} from "../compact-i18n-build-plugin.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const compactLanguages = ["en", "uk", "es", "de", "fr", "ja"];
const sourceLocales = { en, uk, es, de, fr, ja };

function localeSource(language) {
  return readFileSync(path.join(repoRoot, "src", "i18n", "languages", `${language}.ts`), "utf8");
}

describe("compact i18n production build plugin", () => {
  it("requires every full locale to retain the exact English property inventory", () => {
    const english = parseCompactLocaleModule(localeSource("en"), "en.ts", "en");

    expect(english.keys.length).toBeGreaterThan(3_500);
    for (const language of compactLanguages.slice(1)) {
      const locale = parseCompactLocaleModule(localeSource(language), `${language}.ts`, language);
      expect(locale.keys).toHaveLength(english.keys.length);
      expect(new Set(locale.keys)).toEqual(new Set(english.keys));
    }
  });

  it("keeps source authoring intact while replacing repeated property names in build output", () => {
    const source = localeSource("uk");
    const canonicalKeys = parseCompactLocaleModule(localeSource("en"), "en.ts", "en").keys;
    const transformed = transformCompactLocaleModule(
      source,
      "src/i18n/languages/uk.ts",
      "uk",
      canonicalKeys
    );

    expect(transformed).toContain(
      `import { createCompactTranslations } from "${COMPACT_I18N_VIRTUAL_ID}";`
    );
    expect(transformed).toContain("...defineJournalRecoveryTranslations([");
    expect(transformed).toContain("...createCompactTranslations(0, 1, [");
    expect(transformed).not.toContain('goodMorning: "Доброго ранку"');
    expect(transformed).toContain('"Доброго ранку"');
  });

  it("fails closed when a locale drops or inserts a canonical key", () => {
    const source = `export const uk = { first: "один", third: "три" };`;

    expect(() => transformCompactLocaleModule(source, "uk.ts", "uk", ["first", "second"])).toThrow(
      /canonical translation key order/i
    );
  });

  it("publishes one shared key table and transforms only production full locales", () => {
    const plugin = createCompactI18nBuildPlugin({ root: repoRoot });
    const ukPath = path.join(repoRoot, "src", "i18n", "languages", "uk.ts");
    const arPath = path.join(repoRoot, "src", "i18n", "languages", "ar.ts");

    expect(plugin.resolveId(COMPACT_I18N_VIRTUAL_ID)).toBe(COMPACT_I18N_RESOLVED_ID);
    const virtualModule = plugin.load(COMPACT_I18N_RESOLVED_ID);
    expect(virtualModule).toContain("const translationKeys =");
    expect(virtualModule).toContain("Object.create(null)");
    expect(virtualModule).toContain("end - start !== values.length");

    expect(plugin.transform(localeSource("uk"), ukPath)?.code).toContain(
      "createCompactTranslations"
    );
    expect(plugin.transform(localeSource("ar"), arPath)).toBeNull();
  });

  it("fails closed for an unrecognized spread inside a full locale", () => {
    const source = `export const en = { first: "one", ...unexpected, second: "two" };`;

    expect(() => transformCompactLocaleModule(source, "en.ts", "en", ["first", "second"])).toThrow(
      /recovery translation spread/i
    );
  });

  it("requires all six full locale modules to pass through each build", () => {
    const completePlugin = createCompactI18nBuildPlugin({ root: repoRoot });
    completePlugin.buildStart();
    for (const language of compactLanguages) {
      const sourcePath = path.join(repoRoot, "src", "i18n", "languages", `${language}.ts`);
      completePlugin.transform(localeSource(language), sourcePath);
    }
    expect(() => completePlugin.generateBundle()).not.toThrow();

    const incompletePlugin = createCompactI18nBuildPlugin({ root: repoRoot });
    incompletePlugin.buildStart();
    incompletePlugin.transform(
      localeSource("en"),
      path.join(repoRoot, "src", "i18n", "languages", "en.ts")
    );
    expect(() => incompletePlugin.generateBundle()).toThrow(/exactly 6 full locale modules/i);
  });

  it("keeps every transformed production dictionary value-for-value equivalent", async () => {
    const plugin = createCompactI18nBuildPlugin({ root: repoRoot });
    const virtualModule = plugin
      .load(COMPACT_I18N_RESOLVED_ID)
      .replace("export function createCompactTranslations", "function createCompactTranslations");
    const recoveryRuntime =
      `const JOURNAL_RECOVERY_TRANSLATION_KEYS = ${JSON.stringify(JOURNAL_RECOVERY_TRANSLATION_KEYS)};\n` +
      `function defineJournalRecoveryTranslations(values) {\n` +
      `  return Object.fromEntries(JOURNAL_RECOVERY_TRANSLATION_KEYS.map((key, index) => [key, values[index]]));\n` +
      `}`;

    for (const language of compactLanguages) {
      const sourcePath = path.join(repoRoot, "src", "i18n", "languages", `${language}.ts`);
      const transformed = plugin.transform(localeSource(language), sourcePath)?.code;
      expect(transformed).toBeTypeOf("string");
      let executable = ts.transpileModule(transformed, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText;
      executable = executable
        .replace(
          /import\s*\{\s*defineJournalRecoveryTranslations\s*\}\s*from\s*["']\.\.\/journalRecoveryTranslations["'];?/,
          recoveryRuntime
        )
        .replace(
          /import\s*\{\s*createCompactTranslations\s*\}\s*from\s*["']virtual:zenflow-compact-i18n["'];?/,
          virtualModule
        );
      expect(executable).not.toMatch(/^import\s/m);

      const moduleUrl = `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}#${language}`;
      const builtModule = await import(moduleUrl);
      expect(builtModule[language]).toEqual(sourceLocales[language]);
    }
  });
});
