/**
 * MIDDLE-ITEM AUDIT v2 (Anti-Skip Hook)
 * Event: Stop + PreToolUse(Bash git commit)
 * Purpose: Verifies ALL items in changes[] have evidence, with extra scrutiny on middle items.
 *
 * v2 fixes (adversarial audit 2026-04-07):
 * - FAIL-CLOSED: catch exits 2
 * - Removed >5 threshold (was full bypass for small lists)
 * - Checks ALL items, not just middle third
 * - Middle items (positions N/3 to 2N/3) require EXTRA evidence depth (25+ chars with file ref)
 * - Works on BOTH Stop and git commit events
 * - Evidence must contain file path pattern
 */
const fs = require('fs');
const path = require('path');

// Detect event type: Stop (no stdin) or PreToolUse (stdin with tool info)
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

try {
  const postPath = path.join(root, '.postflight-done');
  if (!fs.existsSync(postPath)) process.exit(0);

  const post = JSON.parse(fs.readFileSync(postPath, 'utf8'));
  const changes = post.changes || [];
  const checked = post.sources_checked || [];

  if (changes.length <= 1) process.exit(0);

  const FILE_PATTERN = /\.(ts|tsx|js|jsx|css|json|md|cjs|gradle|xml)\b/i;

  // Rule 1: ALL items must have evidence (not just middle)
  // v2.1: Exact basename match with word boundary
  const matchesName = (sName, base) => {
    const lower = sName.toLowerCase();
    const baseNoExt = base.replace(/\.[^.]+$/, '');
    return lower.includes(base) || new RegExp('\\b' + baseNoExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(lower);
  };

  const unchecked = changes.filter(item => {
    const base = path.basename(item).toLowerCase();
    return !checked.some(s => matchesName(s.name || '', base));
  });

  if (unchecked.length > 0) {
    console.error(`❌ MIDDLE-ITEM AUDIT: ${unchecked.length}/${changes.length} items have NO evidence at all.`);
    unchecked.forEach((item, i) => {
      console.error(`   ⚠️ [${changes.indexOf(item) + 1}/${changes.length}] ${item}`);
    });
    process.exit(2);
  }

  // Rule 2: Middle items need DEEPER evidence (25+ chars with file reference)
  if (changes.length >= 4) {
    const N = changes.length;
    const start = Math.ceil(N / 3);
    const end = Math.ceil((2 * N) / 3);
    const middleItems = changes.slice(start, end);

    const shallowMiddle = middleItems.filter(item => {
      const base = path.basename(item).toLowerCase();
      const match = checked.find(s => matchesName(s.name || '', base));
      if (!match) return true;
      const ev = match.evidence || '';
      return ev.length < 25 || !FILE_PATTERN.test(ev);
    });

    if (shallowMiddle.length > 0) {
      console.error(`❌ MIDDLE-ITEM AUDIT: ${shallowMiddle.length} MIDDLE items have shallow evidence.`);
      console.error(`   Research: AI agents skip middle items 40%+ of the time.`);
      shallowMiddle.forEach(item => {
        const pos = changes.indexOf(item) + 1;
        console.error(`   ⚠️ [${pos}/${N}] ${item} — needs 25+ chars with file reference`);
      });
      process.exit(2);
    }
  }

} catch (e) {
  // FAIL-CLOSED (v2 fix)
  console.error(`❌ MIDDLE-ITEM AUDIT: Parse error — ${e.message}`);
  process.exit(2);
}
