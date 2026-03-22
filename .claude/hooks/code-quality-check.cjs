#!/usr/bin/env node
/**
 * PostToolUse hook for Edit/Write — Code Quality Advisory.
 *
 * ADVISORY ONLY (never blocks) — injects quality warnings as additionalContext.
 * Complements bandaid-gate.cjs (which blocks) with softer quality signals.
 *
 * Checks:
 *   A1: Missing test file for edited source
 *   A2: New `as any` or `: any` type debt
 *   A3: Hardcoded color in .tsx
 *
 * Research basis: SonarQube cognitive complexity, Codacy guardrails.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// Directories where test files are EXPECTED (not all src/ needs tests)
const TEST_EXPECTED_DIRS = ['hooks/', 'lib/', 'storage/', 'stores/'];

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = (data.tool_input?.file_path || '').replace(/\\/g, '/');

    // Only fire for TypeScript source files
    if (!filePath.match(/\.(ts|tsx)$/)) {
      process.exit(0);
    }

    // Skip non-source files
    const relPath = filePath.replace(ROOT.replace(/\\/g, '/'), '').replace(/^\//, '');
    if (relPath.includes('.claude/') || relPath.includes('docs/') || relPath.includes('scripts/') ||
        relPath.includes('__tests__') || relPath.includes('.test.') || relPath.includes('.spec.')) {
      process.exit(0);
    }

    const warnings = [];
    const newString = data.tool_input?.new_string || data.tool_input?.content || '';

    // A1: Missing test file (only for expected directories)
    if (TEST_EXPECTED_DIRS.some(d => relPath.includes(d)) && !relPath.includes('.test.')) {
      const dir = path.dirname(filePath);
      const baseName = path.basename(filePath, path.extname(filePath));
      // Check all 4 possible test file locations:
      // 1. src/X.test.ts  2. src/X.test.tsx  3. src/__tests__/X.test.ts  4. src/__tests__/X.test.tsx
      const testPaths = [
        path.join(dir, baseName + '.test.ts'),
        path.join(dir, baseName + '.test.tsx'),
        path.join(dir, '__tests__', baseName + '.test.ts'),
        path.join(dir, '__tests__', baseName + '.test.tsx'),
      ];
      if (!testPaths.some(p => fs.existsSync(p))) {
        warnings.push('MISSING TEST: No test file found for ' + path.basename(filePath) + '. Consider adding tests (Law 1).');
      }
    }

    // A2: New `as any` or `: any` type debt
    if (/\bas\s+any\b/.test(newString) || /:\s*any\b/.test(newString)) {
      warnings.push('TYPE DEBT: `as any` or `: any` detected in new code. Consider proper typing (Law 14).');
    }

    // A3: Hardcoded color in .tsx
    if (filePath.endsWith('.tsx') && /#[0-9a-fA-F]{3,8}\b/.test(newString)) {
      // Skip if it's a theme token file
      if (!relPath.includes('theme') && !relPath.includes('token') && !relPath.includes('color')) {
        warnings.push('HARDCODED COLOR: Found #hex color in component. Use theme tokens (Visual Aesthetic Part 6).');
      }
    }

    // Always inject self-reflection reminder after TS edits (SR8)
    const selfReflectionReminder = 'SELF-REFLECTION: After this edit, verify: (1) No IDE errors introduced (2) No regression in existing behavior (3) Change aligns with stated goal';

    // Inject warnings + self-reflection as additionalContext
    const parts = [];
    if (warnings.length > 0) {
      parts.push('CODE QUALITY CHECK:\n' + warnings.map(w => '  ⚠️ ' + w).join('\n'));
    }
    parts.push(selfReflectionReminder);

    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: parts.join('\n\n'),
      },
    }));
  } catch (e) {
    process.stderr.write('HOOK ERROR [code-quality-check]: ' + (e.message || e) + '\n');
    // Advisory hook — don't block on error
  }

  process.exit(0);
});
