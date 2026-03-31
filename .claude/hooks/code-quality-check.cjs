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
 *   A4: Control flow mutation
 *   A5: New code Snyk scan reminder
 *   A6: Modal/overlay without back handler (.tsx)
 *   A7: Fixed/absolute without safe-area (.tsx)
 *   A8: backdropFilter without -webkit- (.tsx)
 *   A9: Button without aria-label (.tsx)
 *   A10: addEventListener without cleanup (.tsx)
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

    // Skip non-source files (but NOT test files — test corruption detection)
    const relPath = filePath.replace(ROOT.replace(/\\/g, '/'), '').replace(/^\//, '');
    if (relPath.includes('.claude/') || relPath.includes('docs/') || relPath.includes('scripts/')) {
      process.exit(0);
    }

    // A0: TEST CORRUPTION WARNING (production incident: agent modifies tests to pass bad code)
    if (relPath.includes('__tests__') || relPath.includes('.test.') || relPath.includes('.spec.')) {
      const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');
      const entry = JSON.stringify({ ts: Date.now(), hook: 'code-quality-check', event: 'test-file-modified', file: relPath }) + '\n';
      try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
      process.stderr.write(
        `⚠️ TEST FILE MODIFIED: ${relPath}\n` +
        `   Verify: assertions test BEHAVIOR not implementation details.\n` +
        `   Verify: no expect() values changed to match broken code.\n`
      );
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

    // A4: Control flow mutation — fix verification (Anti-Pattern #15: Fix Without Trace)
    // UPGRADED: if EXISTING control flow is MODIFIED (old_string has CF, new_string has DIFFERENT CF)
    // → create .control-flow-pending token. search-gate blocks next Edit until acknowledged.
    // New code (no old_string CF) → advisory only (writing new if/return is normal).
    const CONTROL_FLOW = /\b(if\s*\(|else\s*\{|break\b|continue\b|return\b|throw\b|process\.exit)/;
    const oldString = data.tool_input?.old_string || '';
    const oldHasCF = CONTROL_FLOW.test(oldString);
    const newHasCF = CONTROL_FLOW.test(newString);

    if (oldHasCF && newHasCF && oldString !== newString) {
      // MODIFICATION of existing control flow — high regression risk
      // Create .control-flow-pending token (consumed by path trace acknowledgment)
      const CF_PENDING = path.join(ROOT, '.control-flow-pending');
      try {
        fs.writeFileSync(CF_PENDING, JSON.stringify({
          file: filePath, timestamp: Date.now(),
          pattern: 'EXISTING control flow MODIFIED — trace all paths before continuing'
        }));
      } catch { /* best-effort */ }
      warnings.push('CONTROL FLOW FIX DETECTED (Anti-Pattern #15): You modified EXISTING if/break/return logic. ' +
        '.control-flow-pending token created. TRACE ALL PATHS before next edit: (1) TRUE (2) FALSE (3) EDGE CASE. ' +
        'Incident: bandaid-gate regression from untested path.');
    } else if (newHasCF) {
      // New control flow (writing new code) — advisory only
      warnings.push('CONTROL FLOW CHANGE: Edit contains if/break/continue/return/exit. ' +
        'TRACE ALL PATHS: (1) TRUE? (2) FALSE? (3) Edge cases?');
    }

    // A5: New code → Snyk scan reminder (Anti-Pattern #18 + CLAUDE.md global rule)
    const SNYK_PENDING = path.join(ROOT, '.snyk-pending');
    if (filePath && /\.(ts|tsx)$/.test(filePath)) {
      const oldStr = (data.tool_input && data.tool_input.old_string) || '';
      // New file = empty old_string (Write tool) or old_string not provided
      if (!oldStr && data.tool_name === 'Write') {
        try {
          fs.writeFileSync(SNYK_PENDING, JSON.stringify({ file: filePath, timestamp: new Date().toISOString() }), 'utf8');
          warnings.push('NEW CODE DETECTED in ' + path.basename(filePath) + '. Per CLAUDE.md global rule: run snyk_code_scan before commit. (.snyk-pending created)');
        } catch { /* best-effort */ }
      }
    }

    // A6-A10: Cross-platform & accessibility advisories (only for .tsx components)
    if (filePath.endsWith('.tsx')) {
      // A6: Modal/drawer/overlay without back handler
      if (/\b(modal|Modal|drawer|Drawer|overlay|Overlay|Sheet|BottomSheet|Dialog)\b/.test(newString) &&
          !/useBackHandler/.test(newString)) {
        warnings.push('BACK HANDLER: New modal/drawer/overlay detected but no useBackHandler import. Android back button requires it (Law 10).');
      }

      // A7: position:fixed/absolute without safe-area
      if (/position:\s*(fixed|absolute|sticky)/.test(newString) &&
          !/safe-area|env\(safe-area/.test(newString)) {
        warnings.push('SAFE AREA: Fixed/absolute/sticky positioning without safe-area inset. Add env(safe-area-inset-*) for iOS notch (Law 10).');
      }

      // A8: backdrop-filter without -webkit- in inline styles
      if (/backdropFilter/.test(newString) && !/-webkit-backdrop-filter|webkitBackdropFilter/.test(newString)) {
        warnings.push('WEBKIT PREFIX: backdropFilter in inline style without -webkit- variant. Add WebkitBackdropFilter for Safari (Law 10).');
      }

      // A9: Interactive element without aria-label
      if (/<button\b/.test(newString) && !/aria-label/.test(newString)) {
        warnings.push('ARIA LABEL: <button> without aria-label detected. Add aria-label for screen readers (Law 9).');
      }

      // A10: addEventListener in useEffect without cleanup
      if (/addEventListener/.test(newString) && /useEffect/.test(newString) &&
          !/removeEventListener/.test(newString)) {
        warnings.push('EFFECT CLEANUP: addEventListener inside useEffect without matching removeEventListener in cleanup (Law 25).');
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
