#!/usr/bin/env node
/**
 * DIFFICULTY-WEIGHTED CHECKLIST (Anti-Satisficing Hook)
 * Event: Stop + PreToolUse(Bash git commit)
 * Purpose: Prevents gaming by completing only trivial items.
 *
 * Classification:
 *   TRIVIAL (0.1): add comment, rename, fix typo, update import, add log
 *   EASY    (0.3): add aria-label, fix lint, add translation key, fix warning
 *   MEDIUM  (0.6): refactor hook, fix race condition, add error handling, write test, fix type
 *   HARD    (1.0): architecture change, new feature, security fix, cross-platform fix, new module
 *
 * Block condition: weighted average of completed items < 0.4
 * Also blocks if >60% of completed items are TRIVIAL.
 *
 * FAIL-CLOSED: any parse error exits 2.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// --- Event detection ---
let isCommit = false;
try {
  const stdin = fs.readFileSync('/dev/stdin', 'utf8').toString();
  if (stdin) {
    const input = JSON.parse(stdin);
    if (input.tool !== 'Bash') process.exit(0);
    const cmd = (input.input?.command || '').toLowerCase();
    if (!cmd.includes('git commit')) process.exit(0);
    isCommit = true;
  }
} catch (_) {
  // No stdin = Stop event, continue
}

const root = process.cwd();
const CHECKLIST = path.join(root, '.audit-checklist.json');
const AUDIT_FLAG = path.join(root, '.audit-active');

// Only run during audit sessions
if (!fs.existsSync(AUDIT_FLAG) || !fs.existsSync(CHECKLIST)) {
  process.exit(0);
}

// --- Difficulty classification patterns ---
const TRIVIAL_PATTERNS = [
  /\b(add|fix|update)\s+(comment|log|import|typo|whitespace|spacing|indent)/i,
  /\brename\s+(var|variable|const|let|function|param)/i,
  /\bfix\s+typo/i,
  /\bupdate\s+import/i,
  /\bremove\s+(unused|dead)\s+(import|variable|code)/i,
  /\badd\s+missing\s+semicolon/i,
  /\bformat(ting)?\b/i,
  /\bsort\s+import/i,
];

const EASY_PATTERNS = [
  /\badd\s+aria[_-]?label/i,
  /\bfix\s+(lint|eslint|oxlint)\s+(warning|error)/i,
  /\badd\s+translation\s+key/i,
  /\bi18n\s+key/i,
  /\bfix\s+warning/i,
  /\badd\s+type\s+(annotation|hint)/i,
  /\bupdate\s+(version|dependency|dep)\b/i,
  /\bfix\s+css\s+(class|style)/i,
];

const HARD_PATTERNS = [
  /\b(architect|architecture|redesign|restructure)\b/i,
  /\bnew\s+(feature|module|component|hook|store|page)\b/i,
  /\bsecurity\s+(fix|patch|vuln|audit)/i,
  /\bcross[_-]?platform\b/i,
  /\bmigrat(e|ion)\b/i,
  /\brefactor\s+(system|module|architecture|store|sync)/i,
  /\brace\s+condition/i,
  /\boffline[_-]?(first|sync|queue)/i,
  /\bstate\s+(machine|integrity|migration)/i,
  /\bperformance\s+(optim|fix|critical)/i,
  /\bcritical\s+(bug|fix|path)/i,
];

const MEDIUM_PATTERNS = [
  /\brefactor\s+(hook|component|function|handler|util)/i,
  /\bfix\s+(race|async|cleanup|leak|error)/i,
  /\badd\s+error\s+handling/i,
  /\bwrite\s+test/i,
  /\badd\s+test/i,
  /\bfix\s+type\s+(error|mismatch|safety)/i,
  /\bhandle\s+(error|edge|offline)/i,
  /\badd\s+(validation|guard|check)\b/i,
  /\bback\s+handler/i,
  /\bsafe[_-]?area/i,
  /\bwebkit[_-]?prefix/i,
];

function classifyItem(description) {
  const desc = description || '';
  if (HARD_PATTERNS.some(p => p.test(desc))) return { level: 'HARD', weight: 1.0 };
  if (MEDIUM_PATTERNS.some(p => p.test(desc))) return { level: 'MEDIUM', weight: 0.6 };
  if (EASY_PATTERNS.some(p => p.test(desc))) return { level: 'EASY', weight: 0.3 };
  if (TRIVIAL_PATTERNS.some(p => p.test(desc))) return { level: 'TRIVIAL', weight: 0.1 };
  // Default: MEDIUM (benefit of the doubt for unclassified items)
  return { level: 'MEDIUM', weight: 0.6 };
}

// --- Main logic ---
try {
  const checklist = JSON.parse(fs.readFileSync(CHECKLIST, 'utf8'));
  const items = checklist.items || [];
  const doneItems = items.filter(i => i.done);

  if (doneItems.length < 3) {
    // Too few items to classify meaningfully
    process.exit(0);
  }

  // Classify all completed items
  const classified = doneItems.map(item => ({
    id: item.id,
    description: item.description,
    ...classifyItem(item.description),
  }));

  const totalWeight = classified.reduce((sum, c) => sum + c.weight, 0);
  const avgWeight = totalWeight / classified.length;
  const trivialCount = classified.filter(c => c.level === 'TRIVIAL').length;
  const trivialPct = Math.round((trivialCount / classified.length) * 100);

  // Distribution summary
  const dist = {};
  classified.forEach(c => { dist[c.level] = (dist[c.level] || 0) + 1; });
  const distStr = Object.entries(dist)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');

  // Check 1: Weighted average too low
  if (avgWeight < 0.4) {
    process.stderr.write(
      `\n❌ DIFFICULTY-WEIGHTED CHECKLIST BLOCKED!\n` +
      `Weighted average: ${avgWeight.toFixed(2)} (need >= 0.40)\n` +
      `Distribution: ${distStr}\n` +
      `Completed items are too easy — add substantive fixes.\n\n` +
      `Classification of completed items:\n`
    );
    classified.forEach(c => {
      process.stderr.write(`  [${c.level} w=${c.weight}] ${c.id}: ${(c.description || '').slice(0, 60)}\n`);
    });
    process.stderr.write('\n');
    process.exit(2);
  }

  // Check 2: Too many trivial items
  if (trivialPct > 60) {
    process.stderr.write(
      `\n❌ DIFFICULTY-WEIGHTED CHECKLIST BLOCKED!\n` +
      `${trivialPct}% of completed items are TRIVIAL (max 60%)\n` +
      `Distribution: ${distStr}\n` +
      `Add medium/hard items to demonstrate real work.\n\n`
    );
    process.exit(2);
  }

  // Pass
  process.stderr.write(
    `✅ Difficulty check: avg=${avgWeight.toFixed(2)} | ${distStr} | ${doneItems.length}/${items.length} done\n`
  );

} catch (e) {
  // FAIL-CLOSED
  process.stderr.write(`❌ DIFFICULTY-WEIGHTED CHECKLIST: Parse error — ${e.message}\n`);
  process.exit(2);
}
