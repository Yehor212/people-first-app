#!/usr/bin/env npx tsx
/**
 * Check for hardcoded colors in the codebase
 *
 * Scans .tsx and .ts files for hardcoded color values that should use CSS variables.
 * Outputs a report of violations and exits with error if threshold exceeded.
 *
 * Usage: npx tsx scripts/check-hardcoded-colors.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SRC_DIR = path.join(__dirname, '../src');
const FILE_EXTENSIONS = ['.tsx', '.ts'];

// Files allowed to have hardcoded colors (design system, constants, etc.)
const ALLOWED_FILES = [
  'index.css',
  'emotionConstants.ts',
  'tailwind.config.ts',
  'App.css',
  // SVG animation components - colors are essential for animation gradients
  'AnimatedEmotionEmoji.tsx',
  'AnimatedMoodEmoji.tsx',
  'BreathingExercise.tsx',
  // Score-based dynamic colors (SVG limitations)
  'WeekCrystal.tsx',
  // Share card/story slides - designed for image export with fixed branding colors
  'shareCards.ts',
  'ShareModal.tsx',
  'ShareProgress.tsx',
  'stories/',  // All story slide components
];

// Patterns to detect hardcoded colors
const COLOR_PATTERNS = [
  { pattern: /#[a-fA-F0-9]{6}\b/g, name: 'hex6' },
  { pattern: /#[a-fA-F0-9]{3}\b/g, name: 'hex3' },
  { pattern: /rgba?\s*\([^)]+\)/g, name: 'rgb/rgba' },
  { pattern: /hsla?\s*\([^)]+\)/g, name: 'hsl/hsla' },
];

// Patterns to exclude (CSS variable usage, comments, etc.)
const EXCLUDE_PATTERNS = [
  /var\s*\(\s*--[^)]+\)/g,           // CSS variables: var(--color)
  /hsla?\s*\(\s*var\s*\([^)]+\)[^)]*\)/g, // hsl(var(--color)) or hsl(var(--color) / 0.5)
  /hsl\s*\(\s*var\s*\(\s*--[^)]+\s*\)\s*(?:\/\s*[\d.]+\s*)?\)/g, // hsl(var(--name) / opacity)
  /hsla?\s*\(\s*0\s+0%\s+(?:100|0)%[^)]*\)/g, // Pure white/black: hsl(0 0% 100%) or hsl(0 0% 0%)
  /\/\/.*$/gm,                        // Single-line comments
  /\/\*[\s\S]*?\*\//g,               // Multi-line comments
  /['"`]#[a-fA-F0-9]{6}['"`]/g,      // Strings like "#ffffff" (might be intentional)
  /currentColor/gi,                   // CSS currentColor keyword
];

interface Violation {
  file: string;
  line: number;
  column: number;
  match: string;
  type: string;
}

interface FileReport {
  file: string;
  violations: Violation[];
}

function getAllFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, dist, etc.
        if (!['node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function isAllowedFile(filePath: string): boolean {
  const fileName = path.basename(filePath);
  // Normalize path separators for cross-platform compatibility
  const normalizedPath = filePath.replace(/\\/g, '/');
  return ALLOWED_FILES.some(allowed =>
    fileName === allowed ||
    normalizedPath.includes(allowed) ||
    // Match directory patterns like 'stories/'
    (allowed.endsWith('/') && normalizedPath.includes(allowed.slice(0, -1)))
  );
}

function checkFile(filePath: string): Violation[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: Violation[] = [];

  // Remove excluded patterns from content for matching
  let cleanedContent = content;
  for (const excludePattern of EXCLUDE_PATTERNS) {
    cleanedContent = cleanedContent.replace(excludePattern, match => ' '.repeat(match.length));
  }

  for (const { pattern, name } of COLOR_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);

    while ((match = regex.exec(cleanedContent)) !== null) {
      const index = match.index;

      // Find line and column
      let line = 1;
      let lastNewline = -1;
      for (let i = 0; i < index; i++) {
        if (content[i] === '\n') {
          line++;
          lastNewline = i;
        }
      }
      const column = index - lastNewline;

      // Skip if inside a className string with Tailwind classes
      const lineContent = lines[line - 1] || '';
      if (lineContent.includes('className') && !lineContent.includes('style=')) {
        // Check if it's a Tailwind arbitrary value like bg-[#fff]
        const beforeMatch = cleanedContent.substring(Math.max(0, index - 10), index);
        if (beforeMatch.includes('[')) {
          // This is likely a Tailwind arbitrary value - still flag it but note it
          violations.push({
            file: filePath,
            line,
            column,
            match: match[0],
            type: `${name} (Tailwind arbitrary)`,
          });
          continue;
        }
      }

      violations.push({
        file: filePath,
        line,
        column,
        match: match[0],
        type: name,
      });
    }
  }

  return violations;
}

function main() {
  console.log('🎨 Checking for hardcoded colors...\n');

  const files = getAllFiles(SRC_DIR, FILE_EXTENSIONS);
  const reports: FileReport[] = [];
  let totalViolations = 0;

  for (const file of files) {
    if (isAllowedFile(file)) {
      continue;
    }

    const violations = checkFile(file);
    if (violations.length > 0) {
      const relativePath = path.relative(process.cwd(), file);
      reports.push({ file: relativePath, violations });
      totalViolations += violations.length;
    }
  }

  // Sort by violation count descending
  reports.sort((a, b) => b.violations.length - a.violations.length);

  // Output report
  if (reports.length === 0) {
    console.log('✅ No hardcoded colors found!\n');
    process.exit(0);
  }

  console.log(`Found ${totalViolations} hardcoded color(s) in ${reports.length} file(s):\n`);

  // Summary by file
  console.log('📊 Summary by file:');
  console.log('─'.repeat(60));
  for (const report of reports.slice(0, 20)) {
    console.log(`  ${report.violations.length.toString().padStart(4)} │ ${report.file}`);
  }
  if (reports.length > 20) {
    console.log(`  ... and ${reports.length - 20} more files`);
  }
  console.log('─'.repeat(60));
  console.log(`Total: ${totalViolations} violations\n`);

  // Detailed violations for top 5 files
  console.log('\n📝 Details (top 5 files):');
  for (const report of reports.slice(0, 5)) {
    console.log(`\n${report.file}:`);
    for (const v of report.violations.slice(0, 10)) {
      console.log(`  Line ${v.line}: ${v.match} (${v.type})`);
    }
    if (report.violations.length > 10) {
      console.log(`  ... and ${report.violations.length - 10} more`);
    }
  }

  // Exit with error if too many violations (threshold can be adjusted)
  // Note: Some hardcoded colors are acceptable (SVG animations, share cards, branded content)
  const THRESHOLD = 900; // Reduced from 1000 after Phase 3.5 cleanup
  if (totalViolations > THRESHOLD) {
    console.log(`\n❌ Too many hardcoded colors (${totalViolations} > ${THRESHOLD})`);
    process.exit(1);
  }

  console.log(`\n⚠️  ${totalViolations} hardcoded colors found (threshold: ${THRESHOLD})`);
  console.log('Consider replacing with CSS variables for better theme support.\n');
  process.exit(0);
}

main();
