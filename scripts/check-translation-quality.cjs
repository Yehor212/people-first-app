#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const LANGUAGE_DIR = "src/i18n/languages";
const FALLBACK_SOURCE_DIRS = ["src/components", "src/pages", "src/features"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIP_SOURCE_FILE_PATTERN = /(?:^|\/)__tests__\/|(?:\.test|\.spec|\.stories|\.mock)\.(?:ts|tsx)$/;

const RULES = [
  {
    id: "internal-sync-jargon",
    message: "Use account/device wording such as 'saved on this device' or 'updates your account' instead of cloud/sync queue jargon.",
    patterns: [
      /\bcloud[-\s]?(?:sync|synchroni[sz](?:e|ation)?|data|backup)\b/i,
      /\bsync(?:ed|ing)?\s+(?:with|to|from)\s+(?:the\s+)?cloud\b/i,
      /\brestore\s+from\s+(?:the\s+)?cloud\b/i,
      /\b(?:sync|offline)\s+queue\b/i,
      /\bqueued\s+(?:change|changes|sync|upload|uploads)\b/i,
    ],
  },
  {
    id: "local-storage-jargon",
    message: "Say what the user can trust: 'on this device', 'on your account', or 'available offline'.",
    patterns: [
      /\blocal\s+storage\b/i,
      /\bsaved\s+locally\b/i,
      /\blocal\s+(?:snapshot|confirmation|copy|data)\b/i,
    ],
  },
  {
    id: "debug-diagnostics-jargon",
    message: "Use support-facing wording only when needed, such as 'support details', and keep it out of normal user copy.",
    patterns: [
      /\bdebug(?:ging)?(?:\s+info|\s+details|\s+mode)?\b/i,
      /\bdiagnostic(?:s|\s+info|\s+details|\s+payload)?\b/i,
      /\bcode\s+quality\s+warnings?\b/i,
    ],
  },
  {
    id: "implementation-storage-jargon",
    message: "Translate storage failures into recovery language; do not expose database, IndexedDB, or cache internals in visible copy.",
    patterns: [
      /\bIndexedDB\b/i,
      /\bdatabase\s+(?:recovery|reset|issue|error|problem)\b/i,
      /\bstorage\s+engine\b/i,
      /\bcache\s+(?:reset|issue|error|problem|clear)\b/i,
    ],
  },
  {
    id: "platform-label-jargon",
    message: "Prefer device/browser/app wording unless the exact platform name is required for support or store instructions.",
    patterns: [
      /\bplatform\b/i,
      /\bPWA\b/,
    ],
  },
  {
    id: "renderer-jargon",
    message: "Keep rendering implementation details out of user copy; describe smoothness, battery, or visual quality instead.",
    patterns: [
      /\bGPU[-\s]?optimized\b/i,
      /\bWebGL\b/i,
      /\brenderer\b/i,
    ],
  },
  {
    id: "diagnosis-label-copy",
    message: "Avoid diagnosis labels in general UX copy; describe the user need, such as focus, time awareness, novelty, or gentle structure.",
    patterns: [/\bADHD\b/i, /\bADHS\b/i, /\bTDAH\b/i, /\bСДУГ\b/i],
  },
  {
    id: "gesture-retry-jargon",
    message: "Error recovery copy should offer a plain retry path instead of naming a gesture like pull again.",
    patterns: [/\bpull\s+again\s+to\s+retry\b/i],
  },
];

function normalizeRelativePath(filePath, rootDir) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

function isSourceFile(filePath) {
  const extension = path.extname(filePath);
  return SOURCE_EXTENSIONS.has(extension) && !SKIP_SOURCE_FILE_PATTERN.test(filePath.replace(/\\/g, "/"));
}

function collectFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir)) {
    const filePath = path.join(dir, entry);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      collectFiles(filePath, files);
      continue;
    }
    if (stat.isFile()) files.push(filePath);
  }

  return files;
}

function isStringNode(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function propertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return undefined;
}

function lineNumberAt(sourceFile, position) {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function scanTextForTranslationQualityIssues({ text, file, line, source, key }) {
  const issues = [];

  for (const rule of RULES) {
    if (!rule.patterns.some((pattern) => pattern.test(text))) continue;
    issues.push({
      ruleId: rule.id,
      file,
      line,
      key,
      source,
      text,
      message: rule.message,
    });
  }

  return issues;
}

function parseLanguageValues(filePath, rootDir) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const values = [];
  const relativeFile = normalizeRelativePath(filePath, rootDir);

  function visitObjectLiteral(node, keyPath) {
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const key = propertyNameText(property.name);
      if (!key) continue;

      const nextPath = [...keyPath, key];
      const initializer = property.initializer;
      if (isStringNode(initializer)) {
        values.push({
          file: relativeFile,
          line: lineNumberAt(sourceFile, initializer.getStart(sourceFile)),
          key: nextPath.join("."),
          source: "i18n",
          text: initializer.text,
        });
        continue;
      }
      if (ts.isObjectLiteralExpression(initializer)) visitObjectLiteral(initializer, nextPath);
    }
  }

  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) visitObjectLiteral(node, []);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return values;
}

function parseFallbackStrings(filePath, rootDir) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relativeFile = normalizeRelativePath(filePath, rootDir);
  const values = [];

  function isLikelyVisibleFallback(node) {
    const leftText = node.left.getText(sourceFile);
    return /\b(?:t|tx|copy|props)\b|this\.props|\bt\?\.|\btx\?\./.test(leftText);
  }

  function visit(node) {
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.BarBarToken || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) &&
      isStringNode(node.right) &&
      isLikelyVisibleFallback(node)
    ) {
      values.push({
        file: relativeFile,
        line: lineNumberAt(sourceFile, node.right.getStart(sourceFile)),
        key: undefined,
        source: "fallback",
        text: node.right.text,
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return values;
}

function findTranslationQualityIssues({ rootDir = process.cwd() } = {}) {
  const languageDir = path.join(rootDir, LANGUAGE_DIR);
  const values = [];

  for (const filePath of collectFiles(languageDir)) {
    if (path.extname(filePath) !== ".ts") continue;
    values.push(...parseLanguageValues(filePath, rootDir));
  }

  for (const dir of FALLBACK_SOURCE_DIRS) {
    for (const filePath of collectFiles(path.join(rootDir, dir))) {
      if (!isSourceFile(filePath)) continue;
      values.push(...parseFallbackStrings(filePath, rootDir));
    }
  }

  return values.flatMap((value) => scanTextForTranslationQualityIssues(value));
}

function main() {
  const issues = findTranslationQualityIssues();

  if (issues.length === 0) {
    console.log("Translation quality guard passed: no internal jargon found in translations or visible fallback copy.");
    return;
  }

  console.error("Translation quality guard failed:");
  for (const issue of issues) {
    const key = issue.key ? ` ${issue.key}` : "";
    console.error(`- ${issue.file}:${issue.line}${key} [${issue.ruleId}] ${issue.message}`);
    console.error(`  ${issue.text}`);
  }
  process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
  RULES,
  findTranslationQualityIssues,
  scanTextForTranslationQualityIssues,
};
