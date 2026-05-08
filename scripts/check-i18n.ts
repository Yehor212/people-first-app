/**
 * i18n Validation Script
 *
 * Checks for:
 * 1. Missing keys between languages
 * 2. Empty values
 * 3. Key count consistency
 *
 * This script parses locale source files directly instead of going through the
 * runtime lazy-loader, so validation stays stable even when dynamic import
 * behavior is environment-sensitive.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { Language } from "../src/i18n/types";

const MAIN_LANGUAGES: Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const REFERENCE_LANG: Language = "en";
const LANGUAGE_DIR = path.resolve("src/i18n/languages");

interface TranslationValue {
  key: string;
  value: string;
}

interface ParsedLanguage {
  values: Map<string, TranslationValue>;
  extendsReference: boolean;
}

interface ValidationResult {
  errors: string[];
  warnings: string[];
}

function getKeyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function getStringValue(node: ts.Expression): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isParenthesizedExpression(node)) {
    return getStringValue(node.expression);
  }
  return undefined;
}

function parseObjectLiteral(
  sourceFile: ts.SourceFile,
  objectLiteral: ts.ObjectLiteralExpression,
  prefix = "",
): Map<string, TranslationValue> {
  const translations = new Map<string, TranslationValue>();

  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) continue;

    const key = getKeyName(property.name);
    if (!key) continue;

    const fullKey = `${prefix}${key}`;
    const value = getStringValue(property.initializer);
    if (value !== undefined) {
      translations.set(fullKey, { key: fullKey, value });
      continue;
    }

    if (ts.isObjectLiteralExpression(property.initializer)) {
      const nested = parseObjectLiteral(sourceFile, property.initializer, `${fullKey}.`);
      for (const [nestedKey, nestedValue] of nested.entries()) {
        translations.set(nestedKey, nestedValue);
      }
    }
  }

  return translations;
}

function parseLanguageFile(language: Language): ParsedLanguage {
  const filePath = path.join(LANGUAGE_DIR, `${language}.ts`);
  const source = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaredObjects = new Map<string, Map<string, TranslationValue>>();
  let languageInitializer: ts.ObjectLiteralExpression | undefined;

  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (ts.isObjectLiteralExpression(node.initializer)) {
        declaredObjects.set(node.name.text, parseObjectLiteral(sourceFile, node.initializer));
        if (node.name.text === language) {
          languageInitializer = node.initializer;
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const directValues = declaredObjects.get(language);
  if (directValues && directValues.size > 0) {
    return { values: directValues, extendsReference: false };
  }

  const values = new Map<string, TranslationValue>();
  let extendsReference = false;

  if (languageInitializer) {
    for (const property of languageInitializer.properties) {
      if (!ts.isSpreadAssignment(property) || !ts.isIdentifier(property.expression)) continue;

      const spreadName = property.expression.text;
      if (spreadName === REFERENCE_LANG) {
        extendsReference = true;
        continue;
      }

      const spreadValues = declaredObjects.get(spreadName);
      if (!spreadValues) continue;

      for (const [key, value] of spreadValues.entries()) {
        values.set(key, value);
      }
    }
  }

  return { values, extendsReference };
}

function validateTranslations(): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] };

  const parsedLanguages = Object.fromEntries(
    MAIN_LANGUAGES.map((language) => [language, parseLanguageFile(language)]),
  ) as Record<Language, ParsedLanguage>;

  const referenceTranslations = parsedLanguages[REFERENCE_LANG].values;
  if (referenceTranslations.size === 0) {
    result.errors.push(`Reference language ${REFERENCE_LANG} not found!`);
    return result;
  }

  const effectiveTranslations = Object.fromEntries(
    MAIN_LANGUAGES.map((language) => {
      const parsed = parsedLanguages[language];
      if (language === REFERENCE_LANG || !parsed.extendsReference) {
        return [language, parsed.values];
      }

      const merged = new Map(referenceTranslations);
      for (const [key, value] of parsed.values.entries()) {
        merged.set(key, value);
      }
      return [language, merged];
    }),
  ) as Record<Language, Map<string, TranslationValue>>;

  const referenceKeys = Array.from(referenceTranslations.keys()).sort();
  console.log(`\n📊 Reference language: ${REFERENCE_LANG} (${referenceKeys.length} keys)\n`);

  for (const language of MAIN_LANGUAGES) {
    const langTranslations = effectiveTranslations[language];
    if (!langTranslations || langTranslations.size === 0) {
      result.errors.push(`❌ Language ${language}: translations not found`);
      continue;
    }

    const langKeys = Array.from(langTranslations.keys()).sort();
    const missingKeys = referenceKeys.filter((key) => !langTranslations.has(key));
    const extraKeys = langKeys.filter((key) => !referenceTranslations.has(key));
    const emptyKeys = Array.from(langTranslations.values())
      .filter((entry) => entry.value.trim() === "")
      .map((entry) => entry.key);

    if (missingKeys.length === 0 && emptyKeys.length === 0) {
      console.log(`✅ ${language}: ${langKeys.length} keys, all valid`);
    } else {
      console.log(`\n❌ ${language}: ${langKeys.length} keys`);

      if (missingKeys.length > 0) {
        result.errors.push(`${language}: ${missingKeys.length} missing keys`);
        console.log(`   Missing (${missingKeys.length}):`, missingKeys.slice(0, 5).join(", "));
        if (missingKeys.length > 5) console.log(`   ... and ${missingKeys.length - 5} more`);
      }

      if (emptyKeys.length > 0) {
        result.errors.push(`${language}: ${emptyKeys.length} empty values`);
        console.log(`   Empty (${emptyKeys.length}):`, emptyKeys.slice(0, 5).join(", "));
      }
    }

    if (extraKeys.length > 0) {
      result.warnings.push(`${language}: ${extraKeys.length} extra keys not in ${REFERENCE_LANG}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log("📋 SUMMARY");
  console.log("=".repeat(50));

  if (result.errors.length === 0) {
    console.log("\n✅ All translations are valid!\n");
  } else {
    console.log(`\n❌ Found ${result.errors.length} error(s):\n`);
    result.errors.forEach((error) => console.log(`   - ${error}`));
    console.log("");
  }

  if (result.warnings.length > 0) {
    console.log(`⚠️  ${result.warnings.length} warning(s):\n`);
    result.warnings.forEach((warning) => console.log(`   - ${warning}`));
    console.log("");
  }

  return result;
}

const result = validateTranslations();

if (result.errors.length > 0) {
  process.exit(1);
}
