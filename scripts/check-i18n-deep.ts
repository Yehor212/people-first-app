/**
 * Deep i18n audit.
 *
 * The regular i18n check validates key parity. This script validates the next
 * layer: stale English phrases, placeholder parity, and suspicious values that
 * are still identical to English in non-English locales.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

type Language = "en" | "uk" | "es" | "de" | "fr" | "ja" | "ar" | "he";

interface TranslationValue {
  key: string;
  value: string;
  line: number;
}

interface ParsedLanguage {
  values: Map<string, TranslationValue>;
  extendsReference: boolean;
}

const LANGUAGES: Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const REFERENCE_LANGUAGE: Language = "en";
const LANGUAGE_DIR = path.resolve("src/i18n/languages");

const STALE_ENGLISH_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bCaptured at\b/i, label: "legacy diary capture text" },
  { pattern: /\bStart your day\b/i, label: "untranslated day check-in copy" },
  { pattern: /\bClose your day\b/i, label: "untranslated day check-in copy" },
  { pattern: /\bSave ritual\b/i, label: "removed diary ritual wording" },
  { pattern: /\bPreparing your space\b/i, label: "untranslated loading copy" },
  { pattern: /\bQuick note\b/i, label: "untranslated diary action" },
  { pattern: /\bReset thought\b/i, label: "untranslated diary action" },
  { pattern: /\bDiary hub navigation\b/i, label: "untranslated diary navigation" },
  { pattern: /\bHide navigation\b/i, label: "untranslated navigation action" },
  { pattern: /\bShow navigation\b/i, label: "untranslated navigation action" },
  { pattern: /\bYour notes, spaces\b/i, label: "untranslated diary hub copy" },
];

const GENERALLY_ALLOWED_IDENTICAL_VALUES = [
  /^ZenFlow(?:\s.+)?$/,
  /^AI$/,
  /^URL$/,
  /^ID$/,
  /^CSV$/,
  /^PDF$/,
  /^Markdown$/,
  /^Google Calendar$/,
  /^Post 1:1$/,
  /^Story 9:16$/,
  /^ADHD$/,
  /^COMBO$/,
  /^Auto$/,
  /^auto$/,
  /^\?+$/,
  /^[a-zA-Z]$/,
  /^[a-zA-Z]\.?$/,
  /^[0-9\s:.,%+\-_/{}]+$/,
  /^[0-9]+\ssections$/,
  /^💤 Zzz\.\.\.$/,
  /^L, km, min\.\.\.$/,
];

const AUTH_PROVIDER_BRAND_KEYS = [
  "authProviderGoogle",
  "authProviderFacebook",
  "authProviderTelegram",
  "authProviderApple",
] as const;

const ALLOWED_IDENTICAL_KEYS: Partial<Record<Language, ReadonlySet<string>>> = {
  uk: new Set([
    ...AUTH_PROVIDER_BRAND_KEYS,
    "hiddenAchievement",
    "emailPlaceholder",
    "dopamineADHD",
    "premium",
    "zenScore",
    "companionNight",
    "journalHubEyebrow",
  ]),
  es: new Set([
    ...AUTH_PROVIDER_BRAND_KEYS,
    "min",
    "moodNeutral",
    "color",
    "categorySocial",
    "hiddenAchievement",
    "legendAuto",
    "emailPlaceholder",
    "challengeTypeTotal",
    "sortByColor",
    "statsTotal",
    "auto",
    "unitPlaceholder",
    "dopamineNormal",
    "comboText",
    "premium",
    "zenScore",
    "weatherFocused",
    "companionNight",
    "trendsTotalFocus",
    "diaryThemeSepia",
    "diaryBgSakura",
    "diaryBgMatcha",
    "diaryBgAurora",
    "diaryThemeCosmos",
    "somNeutral",
    "somTagNeutral",
  ]),
  de: new Set([
    ...AUTH_PROVIDER_BRAND_KEYS,
    "okay",
    "scheduleStart",
    "moodOkay",
    "moodNeutral",
    "pause",
    "pauseTimer",
    "themeSystem",
    "whatsNewVersion",
    "whatsNew.version",
    "legendAuto",
    "hyperfocusPause",
    "auto",
    "unitPlaceholder",
    "dopamineMinimal",
    "dopamineNormal",
    "syncStatusOffline",
    "premium",
    "version",
    "april",
    "august",
    "september",
    "november",
    "companionNight",
    "syncOffline",
    "code",
    "optional",
    "shareCardMoodOkay",
    "journalHubEyebrow",
    "diaryThemeSepia",
    "diaryThemeRose",
    "diaryBgSakura",
    "diaryBgMatcha",
    "diaryBgAurora",
    "somNeutral",
    "somTagNeutral",
    "somTagAmbivalent",
    "somTagWarm",
    "somCtxDating",
    "somCtxFitness",
    "somCtxPartner",
    "navV2Orb",
  ]),
  fr: new Set([
    ...AUTH_PROVIDER_BRAND_KEYS,
    "minutes",
    "min",
    "moduleGratitude",
    "habitDurationMinutes",
    "focus",
    "cycles",
    "cycle",
    "effectFocusing",
    "pause",
    "gratitude",
    "scheduleDate",
    "goalFocus",
    "categorySocial",
    "nMinutes",
    "notifications",
    "whatsNewVersion",
    "whatsNew.version",
    "settingsGroupNotifications",
    "settingsGroupModules",
    "legendAuto",
    "badges",
    "challengeTypeFocus",
    "challengeTypeGratitude",
    "challengeTypeTotal",
    "hyperfocusPause",
    "habitScore",
    "sortByScore",
    "statsTotal",
    "habitNotes",
    "identityVerb",
    "auto",
    "unitPlaceholder",
    "dopamineMinimal",
    "dopamineNormal",
    "dopamineAnimations",
    "comboText",
    "premium",
    "stable",
    "version",
    "companionNight",
    "gardenSource_gratitude",
    "urgent",
    "suggestions",
    "syncBadges",
    "trendsFocusTime",
    "trendsTotalFocus",
    "permissions",
    "insightSessions",
    "page",
    "pagination",
    "monthShortJan",
    "monthShortMar",
    "monthShortSep",
    "monthShortOct",
    "monthShortNov",
    "code",
    "participants",
    "journalTemplateDailyReflectionDesc",
    "journalTemplateGratitudeDesc",
    "journalTemplateGoalSettingDesc",
    "journalTemplateFreeWriteDesc",
    "journalTemplateWeeklyReviewDesc",
    "diaryThemeRose",
    "diaryBgSakura",
    "diaryBgMatcha",
    "diaryThemeCosmos",
    "somTagAmbivalent",
    "somTagInvincible",
    "ariaConfirmation",
    "navV2Menu",
    "navV2HabitsCategoryFocus",
  ]),
  ja: new Set([
    ...AUTH_PROVIDER_BRAND_KEYS,
    "hiddenAchievement",
    "emailPlaceholder",
    "dopamineADHD",
    "premium",
    "companionNight",
  ]),
  ar: new Set([...AUTH_PROVIDER_BRAND_KEYS]),
  he: new Set([...AUTH_PROVIDER_BRAND_KEYS]),
};

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
    const { line } = sourceFile.getLineAndCharacterOfPosition(property.getStart(sourceFile));
    const value = getStringValue(property.initializer);
    if (value !== undefined) {
      translations.set(fullKey, { key: fullKey, value, line: line + 1 });
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

  const directLanguageValues = declaredObjects.get(language);
  if (directLanguageValues && directLanguageValues.size > 0) {
    return { values: directLanguageValues, extendsReference: false };
  }

  const values = new Map<string, TranslationValue>();
  let extendsReference = false;
  if (languageInitializer) {
    for (const property of languageInitializer.properties) {
      if (!ts.isSpreadAssignment(property) || !ts.isIdentifier(property.expression)) continue;
      const spreadName = property.expression.text;
      if (spreadName === REFERENCE_LANGUAGE) {
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

function extractPlaceholders(value: string): string[] {
  return Array.from(value.matchAll(/\{[a-zA-Z0-9_]+\}/g))
    .map((match) => match[0])
    .sort();
}

function sameList(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isAllowedIdenticalValue(language: Language, key: string, value: string): boolean {
  if (ALLOWED_IDENTICAL_KEYS[language]?.has(key)) return true;
  return GENERALLY_ALLOWED_IDENTICAL_VALUES.some((pattern) => pattern.test(value));
}

const parsedLanguages = Object.fromEntries(LANGUAGES.map((language) => [language, parseLanguageFile(language)])) as Record<
  Language,
  ParsedLanguage
>;
const reference = parsedLanguages[REFERENCE_LANGUAGE].values;
const translations = Object.fromEntries(
  LANGUAGES.map((language) => {
    const parsed = parsedLanguages[language];
    if (language === REFERENCE_LANGUAGE || !parsed.extendsReference) {
      return [language, parsed.values];
    }
    const effectiveValues = new Map(reference);
    for (const [key, value] of parsed.values.entries()) {
      effectiveValues.set(key, value);
    }
    return [language, effectiveValues];
  }),
) as Record<Language, Map<string, TranslationValue>>;
const errors: string[] = [];

for (const language of LANGUAGES) {
  const current = translations[language];
  if (current.size !== reference.size) {
    errors.push(`${language}: expected ${reference.size} string values, found ${current.size}`);
  }
}

for (const language of LANGUAGES.filter((item) => item !== REFERENCE_LANGUAGE)) {
  const current = translations[language];

  for (const [key, englishValue] of reference.entries()) {
    const localized = current.get(key);
    if (!localized) continue;

    const englishPlaceholders = extractPlaceholders(englishValue.value);
    const localizedPlaceholders = extractPlaceholders(localized.value);
    if (!sameList(englishPlaceholders, localizedPlaceholders)) {
      errors.push(
        `${language}:${localized.line} ${key}: placeholder mismatch ${JSON.stringify(
          localizedPlaceholders,
        )}, expected ${JSON.stringify(englishPlaceholders)}`,
      );
    }

    for (const { pattern, label } of STALE_ENGLISH_PATTERNS) {
      if (pattern.test(localized.value)) {
        errors.push(`${language}:${localized.line} ${key}: ${label} -> "${localized.value}"`);
      }
    }

    const english = englishValue.value.trim();
    const value = localized.value.trim();
    if (value === english && value.length > 2 && !isAllowedIdenticalValue(language, key, value)) {
      errors.push(`${language}:${localized.line} ${key}: suspicious English fallback -> "${value}"`);
    }
  }
}

if (errors.length > 0) {
  console.error("\nDeep i18n audit failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error("\nFix the translation or add a narrow allowlist entry with context.\n");
  process.exit(1);
}

console.log(
  `Deep i18n audit passed: ${LANGUAGES.length} languages, ${reference.size} string values, stale English and placeholder checks clean.`,
);
