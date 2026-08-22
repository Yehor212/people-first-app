import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { Plugin } from "vite";

const ASSET_LANGUAGES = ["uk", "es", "de", "fr", "ja", "ar", "he"] as const;
type AssetLanguage = (typeof ASSET_LANGUAGES)[number];
interface StaticLocaleObject {
  [key: string]: string | StaticLocaleObject;
}
type StaticLocaleValue = string | StaticLocaleObject;

const LOCALE_OBJECT_NAMES: Record<AssetLanguage | "en", string> = {
  en: "en",
  uk: "uk",
  es: "es",
  de: "de",
  fr: "fr",
  ja: "ja",
  ar: "arabicOverrides",
  he: "hebrewOverrides",
};

function propertyName(source: ts.SourceFile, name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  throw new Error(`Unsupported locale property name in ${source.fileName}: ${name.getText(source)}`);
}

function parseStaticValue(source: ts.SourceFile, expression: ts.Expression): StaticLocaleValue {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  if (ts.isObjectLiteralExpression(expression)) {
    return parseStaticObject(source, expression);
  }
  throw new Error(`Unsupported locale value in ${source.fileName}: ${expression.getText(source)}`);
}

function parseStaticObject(
  source: ts.SourceFile,
  object: ts.ObjectLiteralExpression,
): StaticLocaleObject {
  const result: StaticLocaleObject = {};
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) {
      throw new Error(`Unsupported locale member in ${source.fileName}: ${property.getText(source)}`);
    }
    const key = propertyName(source, property.name);
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      throw new Error(`Duplicate locale key in ${source.fileName}: ${key}`);
    }
    result[key] = parseStaticValue(source, property.initializer);
  }
  return result;
}

export function parseStaticLocaleDictionary(
  sourceText: string,
  fileName: string,
  objectName = path.basename(fileName, path.extname(fileName)),
): Record<string, StaticLocaleValue> {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let initializer: ts.ObjectLiteralExpression | undefined;

  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === objectName &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      initializer = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  if (!initializer) {
    throw new Error(`Static locale object ${objectName} was not found in ${fileName}`);
  }
  return parseStaticObject(source, initializer);
}

function isAssetLanguage(value: string): value is AssetLanguage {
  return (ASSET_LANGUAGES as readonly string[]).includes(value);
}

export function createLocaleAssetPlugin(
  options: { rootDirectory?: string } = {},
): Plugin {
  const rootDirectory = path.resolve(options.rootDirectory ?? process.cwd());
  const languageDirectory = path.join(rootDirectory, "src/i18n/languages");
  let english: StaticLocaleObject | undefined;

  const readEnglish = (): StaticLocaleObject => {
    if (english) return english;
    const file = path.join(languageDirectory, "en.ts");
    english = parseStaticLocaleDictionary(readFileSync(file, "utf8"), file, LOCALE_OBJECT_NAMES.en);
    return english;
  };

  return {
    name: "zenflow-production-locale-assets",
    apply: "build",
    enforce: "pre",
    transform(sourceText, rawId) {
      const file = path.resolve(rawId.split("?", 1)[0]);
      if (path.dirname(file) !== languageDirectory || path.extname(file) !== ".ts") return null;

      const language = path.basename(file, ".ts");
      if (language === "en") return null;
      if (!isAssetLanguage(language)) return null;

      const localized = parseStaticLocaleDictionary(
        sourceText,
        file,
        LOCALE_OBJECT_NAMES[language],
      );
      const dictionary = language === "ar" || language === "he"
        ? { ...readEnglish(), ...localized }
        : localized;
      const referenceId = this.emitFile({
        type: "asset",
        name: `locale-${language}.json`,
        source: JSON.stringify(dictionary),
      });

      return {
        code: [
          `const assetUrl = import.meta.ROLLUP_FILE_URL_${referenceId};`,
          `export const ${language} = fetch(assetUrl, { credentials: "same-origin" }).then(async (response) => {`,
          `  if (!response.ok) throw new Error("Language dictionary request failed: ${language} (" + response.status + ")");`,
          "  return response.json();",
          "});",
        ].join("\n"),
        map: null,
      };
    },
  };
}
