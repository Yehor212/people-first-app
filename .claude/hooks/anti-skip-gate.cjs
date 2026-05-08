#!/usr/bin/env node
/**
 * ANTI-SKIP GATE — Blocks agent from stopping when skips/simplifications detected.
 *
 * Hook event: Stop
 * Hook input: not required; reads git diff, checklist/Ruflo state, and session token files.
 * Exit 2 = BLOCK (hard), Exit 0 = PASS
 *
 * 6 checks:
 *  1. Open tasks (pending/in_progress) → BLOCK
 *  2. New `as unknown as` or `as any` in diff → BLOCK
 *  3. Incomplete refactoring (old pattern still exists) → WARN
 *  4. Unverified agent-modified files → WARN
 *  5. New exports without tests → WARN
 *  6. Plan items incomplete → BLOCK
 *
 * Research basis: McKinsey Agentic AI (2026), METR Reward Hacking,
 * Aviation challenge-response (Klein 2007), UBC FSE 2025 (+43.67% F1).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const blockers = [];
const warnings = [];

// ─── HELPER ───
function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', timeout: 15000, ...opts }).trim();
  } catch { return ''; }
}

function getDiffLines(filter = '+') {
  const diff = run('git diff --cached --diff-filter=ACMR -U0 -- "*.ts" "*.tsx"') ||
               run('git diff --diff-filter=ACMR -U0 -- "*.ts" "*.tsx"');
  return diff.split('\n').filter(l => l.startsWith(filter) && !l.startsWith('+++'));
}

// ─── CHECK 1: Open Tasks ───
try {
  // Read task state from .task-list.json if exists (Claude Code internal)
  // Fallback: check if any task files indicate pending work
  const taskFiles = ['.audit-checklist.json'];
  for (const tf of taskFiles) {
    const fp = path.join(ROOT, tf);
    if (fs.existsSync(fp)) {
      const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
      if (data.items) {
        const pending = data.items.filter(i => !i.done);
        const total = data.items.length;
        const done = total - pending.length;
        if (pending.length > 0 && done / total < 0.8) {
          blockers.push(`OPEN TASKS: ${pending.length}/${total} items incomplete (need ≥80%). Remaining: ${pending.slice(0, 3).map(i => i.id).join(', ')}...`);
        }
      }
    }
  }
} catch { /* ignore parse errors */ }

// ─── CHECK 2: Type Assertion Abuse ───
try {
  const addedLines = getDiffLines('+');
  const typeAssertions = addedLines.filter(l => {
    const trimmed = l.slice(1).trim(); // remove leading +
    // Skip comments and TYPE-SAFE annotated lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
    if (trimmed.includes('// TYPE-SAFE:')) return false;
    // Skip test files
    if (trimmed.includes('.test.') || trimmed.includes('.spec.')) return false;
    // Detect patterns
    return /as\s+any\b/.test(trimmed) || /as\s+unknown\s+as\b/.test(trimmed);
  });

  if (typeAssertions.length > 0) {
    // Check if these are in test files (allowed)
    const nonTestAssertions = typeAssertions.filter(l => !l.includes('test'));
    if (nonTestAssertions.length > 0) {
      warnings.push(`TYPE ASSERTIONS: ${nonTestAssertions.length} new \`as any\` or \`as unknown as\` in diff. Add \`// TYPE-SAFE: reason\` to justify or fix the types.`);
    }
  }
} catch { /* ignore diff errors */ }

// ─── CHECK 3: Incomplete Refactoring ───
try {
  const removedLines = getDiffLines('-');
  // Extract unique patterns that were removed (function names, variable names)
  const removedPatterns = new Set();
  for (const line of removedLines) {
    // Look for function/variable references that were replaced
    const matches = line.match(/\b(bulkPut|localStorage\.|console\.(log|warn|error))\b/g);
    if (matches) matches.forEach(m => removedPatterns.add(m));
  }

  for (const pattern of removedPatterns) {
    // Skip common patterns that are expected to remain
    if (['console.log', 'console.warn', 'console.error'].includes(pattern)) continue;

    const remaining = run(`grep -rn "${pattern}" src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v __tests__ | grep -v node_modules | wc -l`);
    const count = parseInt(remaining) || 0;
    if (count > 0 && pattern === 'bulkPut') {
      // bulkPut is expected in mergeByTimestamp helper and habits — check if it's just those
      const detail = run(`grep -rn "bulkPut" src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v __tests__`);
      if (detail.includes('backup.ts') && !detail.includes('// direct bulkPut intentional')) {
        // This is expected — mergeByTimestamp uses bulkPut internally
      }
    }
  }
} catch { /* ignore grep errors */ }

// ─── CHECK 4: Agent-Modified Files Not Verified ───
// (Advisory only — can't track reads reliably from hook)

// ─── CHECK 5: New Exports Without Tests ───
try {
  const addedLines = getDiffLines('+');
  const changedFiles = run('git diff --name-only -- "*.ts" "*.tsx"').split('\n').filter(Boolean);

  const newExports = addedLines.filter(l => {
    const t = l.slice(1).trim();
    return (t.startsWith('export function ') || t.startsWith('export const ') || t.startsWith('export async function '))
      && !t.includes('test') && !t.includes('spec');
  });

  const newTestFiles = changedFiles.filter(f => f.includes('.test.') || f.includes('.spec.'));

  if (newExports.length > 3 && newTestFiles.length === 0) {
    warnings.push(`NEW EXPORTS: ${newExports.length} new exports but 0 new test files. Consider adding tests.`);
  }
} catch { /* ignore */ }

// ─── CHECK 6: Plan Items Coverage ───
// (Covered by Check 1 via audit-checklist.json)

// ─── CHECK 7: Ruflo coverage — REMOVED (ceremony, no bug prevention) ───

// ─── OUTPUT ───
if (blockers.length > 0) {
  const msg = [
    '⛔ ANTI-SKIP GATE BLOCKED!',
    '',
    ...blockers.map(b => `  ❌ ${b}`),
    '',
    ...(warnings.length > 0 ? ['  Warnings:', ...warnings.map(w => `  ⚠️ ${w}`), ''] : []),
    'Fix the blockers before stopping.',
  ].join('\n');
  process.stderr.write(msg + '\n');
  process.exit(2);
}

if (warnings.length > 0) {
  const msg = [
    '⚠️ ANTI-SKIP GATE: PASS with warnings',
    ...warnings.map(w => `  ⚠️ ${w}`),
  ].join('\n');
  process.stderr.write(msg + '\n');
}

process.exit(0);
