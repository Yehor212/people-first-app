#!/usr/bin/env npx tsx
/**
 * Check for hardcoded user-facing strings in the codebase
 *
 * Scans .tsx files in src/components/ and src/pages/ for hardcoded English or Russian
 * strings that should use the i18n system (useLanguage / t.someKey).
 *
 * Usage: npx tsx scripts/check-hardcoded-strings.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories to scan
const SCAN_DIRS = [
  path.join(__dirname, '../src/components'),
  path.join(__dirname, '../src/pages'),
];

// ---------- Exclusion configuration ----------

// Known CSS / technical single values to ignore
const TECHNICAL_STRINGS = new Set([
  'px', 'rem', 'em', 'vh', 'vw', '%', 'auto', 'none', 'inherit', 'initial',
  'unset', 'block', 'inline', 'flex', 'grid', 'absolute', 'relative', 'fixed',
  'sticky', 'hidden', 'visible', 'scroll', 'wrap', 'nowrap', 'center', 'left',
  'right', 'top', 'bottom', 'start', 'end', 'stretch', 'cover', 'contain',
  'bold', 'normal', 'italic', 'underline', 'pointer', 'default', 'transparent',
  'solid', 'dashed', 'dotted', 'ease', 'linear', 'ease-in', 'ease-out',
  'ease-in-out', 'row', 'column', 'space-between', 'space-around',
  'div', 'span', 'button', 'input', 'form', 'img', 'svg', 'path',
  'true', 'false', 'null', 'undefined',
  'GET', 'POST', 'PUT', 'DELETE', 'PATCH',
  'utf-8', 'utf8', 'base64', 'json', 'text', 'blob',
  'click', 'change', 'submit', 'keydown', 'keyup', 'focus', 'blur',
  'ltr', 'rtl',
]);

// File-name patterns to skip entirely
const SKIP_FILE_PATTERNS = [
  /\.test\.tsx$/,
  /\.spec\.tsx$/,
  /\.stories\.tsx$/,
  /__tests__/,
  /__mocks__/,
  /src[\\/]+pages[\\/]+__dev[\\/]+/,
];

interface Finding {
  file: string;
  line: number;
  text: string;
}

// ---------- Helpers ----------

function getAllTsxFiles(dirs: string[]): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }

  for (const dir of dirs) {
    walk(dir);
  }
  return files;
}

function shouldSkipFile(filePath: string): boolean {
  return SKIP_FILE_PATTERNS.some(p => p.test(filePath));
}

/**
 * Returns true if the string looks like it is only emojis / symbols (no letters).
 */
function isEmojiOnly(str: string): boolean {
  // Remove common emoji/symbol code points and whitespace; if nothing left, it's emoji-only
  const stripped = str.replace(/[\s\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{25A0}-\u{25FF}]/gu, '');
  return stripped.length === 0;
}

/**
 * Returns true if the string is likely a technical identifier rather than user-facing text.
 */
function isTechnicalString(str: string): boolean {
  const trimmed = str.trim();
  const lower = trimmed.toLowerCase();

  // Empty or very short
  if (trimmed.length === 0) return true;

  // Known technical values
  if (TECHNICAL_STRINGS.has(lower)) return true;

  // Single word (likely component name, icon name, etc.)
  if (!/\s/.test(trimmed)) return true;

  // URL or path
  if (/^(https?:\/\/|\/[a-zA-Z]|\.\/|#)/.test(trimmed)) return true;

  // CSS value patterns: e.g. "0 4px 6px", "100%", "1px solid", numeric-heavy
  if (/^\d[\d\s.]*(%|px|rem|em|vh|vw|s|ms)?$/.test(trimmed)) return true;
  if (/^\d+\s*(px|rem|em)\s/.test(trimmed)) return true;

  // Template / interpolation placeholders
  if (/^\$\{/.test(trimmed)) return true;

  // Only digits, dots, and spaces
  if (/^[\d\s.]+$/.test(trimmed)) return true;

  // Emoji-only strings
  if (isEmojiOnly(trimmed)) return true;

  return false;
}

/**
 * Check whether the line context suggests this is NOT user-facing text.
 */
function isExcludedContext(line: string, matchedString: string): boolean {
  const trimmedLine = line.trim();

  // Import statement
  if (/^import\s/.test(trimmedLine)) return true;

  // Comment lines
  if (/^\s*(\/\/|\/\*|\*)/.test(trimmedLine)) return true;

  // Console / logger statements
  if (/console\.(log|warn|error|debug|info)\s*\(/.test(trimmedLine)) return true;
  if (/logger\.(log|warn|error|debug|info)\s*\(/.test(trimmedLine)) return true;

  // className attribute (Tailwind classes)
  if (/className\s*=\s*["'`{]/.test(trimmedLine)) {
    // Only exclude if the matched string looks like it's inside className
    const classNameIdx = trimmedLine.indexOf('className');
    const matchIdx = trimmedLine.indexOf(matchedString);
    if (classNameIdx >= 0 && matchIdx > classNameIdx) {
      // Check if there's a closing quote/brace for className before the match
      // Simple heuristic: if className= appears and match is on same attribute
      return true;
    }
  }

  // cn(), cva(), clsx() utility calls
  if (/\b(cn|cva|clsx|twMerge)\s*\(/.test(trimmedLine)) return true;

  // data- attributes
  if (new RegExp(`data-[a-zA-Z-]+=.*${escapeRegex(matchedString)}`).test(trimmedLine)) return true;

  // aria-label with t. reference (these are fine)
  if (/aria-label\s*=\s*\{.*\bt\./.test(trimmedLine)) return true;

  // Style objects with CSS values
  if (/style\s*=\s*\{\{/.test(trimmedLine)) return true;

  // The string is a fallback after t.someKey || 'fallback'
  // Pattern: t.someKey || 'the matched string' or t.someKey || "the matched string"
  const escapedMatch = escapeRegex(matchedString);
  if (new RegExp(`\\bt\\.\\w+\\s*\\|\\|\\s*['"\`]${escapedMatch}['"\`]`).test(trimmedLine)) return true;

  // String is used inside a t. template expression: {t.key}
  if (new RegExp(`\\{\\s*t\\.\\w+\\s*\\}`).test(trimmedLine) && trimmedLine.indexOf(matchedString) === -1) return true;

  // Type annotations / interfaces
  if (/^(type|interface|export\s+type|export\s+interface)\s/.test(trimmedLine)) return true;

  // Key-value in an object where key and value are the same technical thing
  if (/^\w+:\s*['"]/.test(trimmedLine) && !/return|render/i.test(trimmedLine)) {
    // Could be a config object — check if the string is multi-word user-facing
    // Let it through to be caught by the main detection
  }

  return false;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect hardcoded strings that look like user-facing text (Latin or Cyrillic, more than one word).
 */
function hasMultipleWords(str: string): boolean {
  // Count words (Latin or Cyrillic sequences)
  const words = str.match(/[a-zA-Z\u0400-\u04FF]+/g);
  return !!words && words.length >= 2;
}

/**
 * Returns true if the string looks like a code expression rather than user-facing text.
 * Detects operators, TypeScript syntax, programming constructs, etc.
 */
function isCodeExpression(str: string): boolean {
  const trimmed = str.trim();

  // Contains JS/TS operators: &&, ||, ===, !==, >=, <=, =>, ?., ternary ?:
  if (/&&|\|\||===|!==|>=|<=|=>|\?\.|[?]:/.test(trimmed)) return true;

  // Starts with = (comparison continuation like "= startMinutes && ...")
  if (/^=\s/.test(trimmed)) return true;

  // Contains TypeScript type syntax: React.Component..., Promise<T>, etc.
  if (/(React\.\w|Promise|Array|Record|Partial|Omit|Pick|Exclude)/.test(trimmed)) return true;

  // Contains parentheses that look like function calls/signatures
  if (/\w+\s*\([^)]*\)\s*[:{=>]/.test(trimmed)) return true;

  // Looks like a function parameter list: (param: Type, ...)
  if (/^\(?\s*\w+\s*:\s*\w/.test(trimmed)) return true;

  // Contains type annotations with colon
  if (/:\s*(string|number|boolean|void|any|never|null|undefined)\b/.test(trimmed)) return true;

  // Variable assignment patterns
  if (/^(const|let|var|return)\s/.test(trimmed)) return true;

  // Dot-chain patterns typical of code: someObj.method
  if (/\w+\.\w+\s*[=(]/.test(trimmed) && !/[A-Z][a-z]/.test(trimmed.split('.')[0])) return true;

  return false;
}

// ---------- Detection patterns ----------

function scanFile(filePath: string): Finding[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const findings: Finding[] = [];
  const relativePath = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comment lines
    if (/^\s*(\/\/|\/\*|\*|\*\/)/.test(line)) continue;

    // Skip import lines
    if (/^\s*import\s/.test(line)) continue;

    // Pattern 1: JSX text content between tags: >Some text here<
    // Matches content after > (not >= or =>) and before < that contains Latin or Cyrillic multi-word strings
    // The lookbehind ensures we match a JSX closing >, not >= or => or a generic type parameter
    const jsxTextPattern = /(?<=[a-zA-Z"'}\s])>([^<>{]+)<(?=\/?\w)/g;
    let match: RegExpExecArray | null;
    while ((match = jsxTextPattern.exec(line)) !== null) {
      const text = match[1].trim();
      if (!text) continue;
      if (!hasMultipleWords(text)) continue;
      if (isTechnicalString(text)) continue;
      if (isCodeExpression(text)) continue;
      if (isExcludedContext(line, text)) continue;
      // Check it's not just whitespace and braces
      if (/^[\s{}]+$/.test(text)) continue;
      findings.push({ file: relativePath, line: lineNum, text });
    }

    // Pattern 2: String literals in JSX expressions: {'Some text'} or {"Some text"}
    // But NOT template literals referencing t. and NOT fallbacks like t.key || 'text'
    const jsxStringPattern = /\{\s*['"]([^'"]{4,})['"]\s*\}/g;
    while ((match = jsxStringPattern.exec(line)) !== null) {
      const text = match[1].trim();
      if (!hasMultipleWords(text)) continue;
      if (isTechnicalString(text)) continue;
      if (isCodeExpression(text)) continue;
      if (isExcludedContext(line, text)) continue;
      // Skip if preceded by t. || pattern
      const before = line.substring(0, match.index + 1);
      if (/\bt\.\w+\s*\|\|\s*$/.test(before)) continue;
      findings.push({ file: relativePath, line: lineNum, text });
    }

    // Pattern 3: title, placeholder, alt, label attributes with literal strings
    // e.g. title="Some text" placeholder="Enter name"
    const attrPattern = /\b(title|placeholder|alt|label|aria-label)\s*=\s*["']([^"']{4,})["']/g;
    while ((match = attrPattern.exec(line)) !== null) {
      const attrName = match[1];
      const text = match[2].trim();
      if (!hasMultipleWords(text)) continue;
      if (isTechnicalString(text)) continue;
      if (isExcludedContext(line, text)) continue;
      // aria-label with t. on same line is fine
      if (attrName === 'aria-label' && /\bt\./.test(line)) continue;
      findings.push({ file: relativePath, line: lineNum, text });
    }

    // Pattern 4: title, placeholder, alt, label attributes with JSX expression containing literal string
    // e.g. title={"Some text"} placeholder={'Enter name'}
    const attrExprPattern = /\b(title|placeholder|alt|label|aria-label)\s*=\s*\{\s*["']([^"']{4,})["']\s*\}/g;
    while ((match = attrExprPattern.exec(line)) !== null) {
      const attrName = match[1];
      const text = match[2].trim();
      if (!hasMultipleWords(text)) continue;
      if (isTechnicalString(text)) continue;
      if (isExcludedContext(line, text)) continue;
      if (attrName === 'aria-label' && /\bt\./.test(line)) continue;
      // Skip if preceded by t. || pattern
      const before = line.substring(0, match.index);
      if (/\bt\.\w+\s*\|\|/.test(before)) continue;
      findings.push({ file: relativePath, line: lineNum, text });
    }
  }

  // Deduplicate findings on same line with same text
  const seen = new Set<string>();
  return findings.filter(f => {
    const key = `${f.line}:${f.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------- Main ----------

function main() {
  console.log('Scanning for hardcoded strings...\n');

  const files = getAllTsxFiles(SCAN_DIRS);
  const allFindings: Finding[] = [];
  const filesWithFindings = new Set<string>();

  for (const file of files) {
    if (shouldSkipFile(file)) continue;

    const findings = scanFile(file);
    if (findings.length > 0) {
      allFindings.push(...findings);
      filesWithFindings.add(findings[0].file);
    }
  }

  if (allFindings.length === 0) {
    console.log('No hardcoded strings found.\n');
    process.exit(0);
  }

  // Sort by file path then line number
  allFindings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  // Print findings
  for (const f of allFindings) {
    console.log(`${f.file}:${f.line}  "${f.text}"`);
  }

  console.log(`\nFound ${allFindings.length} potential hardcoded string(s) in ${filesWithFindings.size} file(s).`);
  process.exit(1);
}

main();
