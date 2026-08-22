import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

export const COMPACT_I18N_VIRTUAL_ID = "virtual:zenflow-compact-i18n";
export const COMPACT_I18N_RESOLVED_ID = `\0${COMPACT_I18N_VIRTUAL_ID}`;

const COMPACT_LANGUAGES = new Set(["en", "uk", "es", "de", "fr", "ja"]);
const LOCALE_MODULE_PATTERN = /[\\/]src[\\/]i18n[\\/]languages[\\/]([a-z]{2})\.ts$/;

function propertyNameText(name, fileName) {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return ts.isIdentifier(name) ? name.text : name.text;
  }
  throw new Error(`${fileName}: compact i18n accepts only static translation keys`);
}

function findLocaleObject(sourceFile, exportName, fileName) {
  let localeObject = null;
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === exportName &&
        declaration.initializer &&
        ts.isObjectLiteralExpression(declaration.initializer)
      ) {
        localeObject = declaration.initializer;
      }
    }
  }
  if (!localeObject) {
    throw new Error(`${fileName}: expected exported ${exportName} translation object`);
  }
  return localeObject;
}

export function parseCompactLocaleModule(source, fileName, exportName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const localeObject = findLocaleObject(sourceFile, exportName, fileName);
  const keys = [];
  const parts = [];

  for (const property of localeObject.properties) {
    if (ts.isPropertyAssignment(property)) {
      const key = propertyNameText(property.name, fileName);
      keys.push(key);
      parts.push({
        kind: "value",
        key,
        value: property.initializer.getText(sourceFile),
      });
      continue;
    }
    if (ts.isSpreadAssignment(property)) {
      parts.push({ kind: "spread", value: property.getText(sourceFile) });
      continue;
    }
    throw new Error(`${fileName}: compact i18n does not support ${ts.SyntaxKind[property.kind]}`);
  }

  if (new Set(keys).size !== keys.length) {
    throw new Error(`${fileName}: compact i18n found a duplicate translation key`);
  }

  return {
    keys,
    parts,
    objectStart: localeObject.getStart(sourceFile),
    objectEnd: localeObject.getEnd(),
    importEnd: sourceFile.statements
      .filter(ts.isImportDeclaration)
      .reduce((end, statement) => Math.max(end, statement.getEnd()), 0),
  };
}

function assertCanonicalKeyInventory(parsed, canonicalKeys, fileName) {
  const canonicalKeySet = new Set(canonicalKeys);
  if (
    parsed.keys.length !== canonicalKeys.length ||
    parsed.keys.some((key) => !canonicalKeySet.has(key))
  ) {
    throw new Error(`${fileName}: locale does not match the canonical translation key order`);
  }
  const spreads = parsed.parts.filter((part) => part.kind === "spread");
  if (
    spreads.length !== 1 ||
    !/^\.\.\.defineJournalRecoveryTranslations\s*\(/.test(spreads[0].value)
  ) {
    throw new Error(`${fileName}: compact i18n requires the recovery translation spread`);
  }
}

function compactObjectSource(parts, canonicalKeys) {
  const lines = ["{"];
  const canonicalIndexByKey = new Map(canonicalKeys.map((key, index) => [key, index]));
  let segmentStart = 0;
  let previousCanonicalIndex = -1;
  let values = [];

  const flushValues = () => {
    if (values.length === 0) return;
    const segmentEnd = previousCanonicalIndex + 1;
    lines.push(
      `  ...createCompactTranslations(${segmentStart}, ${segmentEnd}, [\n${values
        .map((value) => `    ${value},`)
        .join("\n")}\n  ]),`
    );
    values = [];
    previousCanonicalIndex = -1;
  };

  for (const part of parts) {
    if (part.kind === "value") {
      const canonicalIndex = canonicalIndexByKey.get(part.key);
      if (canonicalIndex === undefined) {
        throw new Error(`Compact i18n key is missing from the canonical dictionary: ${part.key}`);
      }
      if (values.length > 0 && canonicalIndex !== previousCanonicalIndex + 1) {
        flushValues();
      }
      if (values.length === 0) segmentStart = canonicalIndex;
      values.push(part.value);
      previousCanonicalIndex = canonicalIndex;
      continue;
    }
    flushValues();
    lines.push(`  ${part.value},`);
  }
  flushValues();
  lines.push("}");
  return lines.join("\n");
}

export function transformCompactLocaleModule(source, fileName, exportName, canonicalKeys) {
  const parsed = parseCompactLocaleModule(source, fileName, exportName);
  assertCanonicalKeyInventory(parsed, canonicalKeys, fileName);

  const compactObject = compactObjectSource(parsed.parts, canonicalKeys);
  let transformed =
    source.slice(0, parsed.objectStart) + compactObject + source.slice(parsed.objectEnd);
  const compactImport = `\nimport { createCompactTranslations } from "${COMPACT_I18N_VIRTUAL_ID}";`;
  transformed =
    transformed.slice(0, parsed.importEnd) + compactImport + transformed.slice(parsed.importEnd);
  return transformed;
}

function virtualTranslationModule(canonicalKeys) {
  return (
    `const translationKeys = ${JSON.stringify(canonicalKeys)};\n` +
    `export function createCompactTranslations(start, end, values) {\n` +
    `  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end > translationKeys.length || end - start !== values.length) {\n` +
    `    throw new Error("ZenFlow translation build payload does not match its canonical keys");\n` +
    `  }\n` +
    `  const translations = Object.create(null);\n` +
    `  for (let index = 0; index < values.length; index += 1) {\n` +
    `    translations[translationKeys[start + index]] = values[index];\n` +
    `  }\n` +
    `  return translations;\n` +
    `}\n`
  );
}

export function createCompactI18nBuildPlugin({ root = process.cwd() } = {}) {
  const canonicalPath = path.join(root, "src", "i18n", "languages", "en.ts");
  const canonicalSource = readFileSync(canonicalPath, "utf8");
  const canonicalKeys = parseCompactLocaleModule(canonicalSource, canonicalPath, "en").keys;
  const virtualModule = virtualTranslationModule(canonicalKeys);
  const transformedLanguages = new Set();

  return {
    name: "zenflow-compact-i18n-build",
    apply: "build",
    enforce: "pre",
    buildStart() {
      transformedLanguages.clear();
    },
    resolveId(id) {
      return id === COMPACT_I18N_VIRTUAL_ID ? COMPACT_I18N_RESOLVED_ID : null;
    },
    load(id) {
      return id === COMPACT_I18N_RESOLVED_ID ? virtualModule : null;
    },
    transform(source, id) {
      const cleanId = id.split("?", 1)[0];
      const match = cleanId.match(LOCALE_MODULE_PATTERN);
      const language = match?.[1];
      if (!language || !COMPACT_LANGUAGES.has(language)) return null;
      transformedLanguages.add(language);
      return {
        code: transformCompactLocaleModule(source, cleanId, language, canonicalKeys),
        map: null,
      };
    },
    generateBundle() {
      if (transformedLanguages.size !== COMPACT_LANGUAGES.size) {
        throw new Error(
          `Compact i18n build transformed ${transformedLanguages.size} locale modules; expected exactly 6 full locale modules`
        );
      }
    },
  };
}
