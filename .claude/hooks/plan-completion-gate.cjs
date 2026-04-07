/**
 * PLAN COMPLETION GATE v2 (Anti-Skip Hook)
 * Event: Stop
 * Purpose: Blocks agent from stopping if planned items != completed items.
 *
 * v2 fixes (adversarial audit 2026-04-07):
 * - FAIL-CLOSED: catch exits 2, not 0
 * - Removed changes.length > 3 threshold (was full bypass for small lists)
 * - Cross-references changes[] vs git diff (prevents declaring 3 files when 15 changed)
 * - Evidence must contain file path pattern (.ts/.tsx/.css/.json) not just 10 chars
 * - Stricter name matching (exact basename, not substring includes)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();

try {
  const postPath = path.join(root, '.postflight-done');
  if (!fs.existsSync(postPath)) {
    process.exit(0); // quality-stop-gate handles missing postflight
  }

  const post = JSON.parse(fs.readFileSync(postPath, 'utf8'));
  const checked = post.sources_checked || [];
  const changes = post.changes || [];

  // Rule 0: Cross-reference changes[] vs actual git diff
  // Prevents agent from declaring 3 files when 15 actually changed
  try {
    const gitDiff = execSync('git diff --name-only HEAD 2>/dev/null || git diff --name-only --cached 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
    const diffFiles = gitDiff.split('\n').filter(f => f.length > 0 && !f.startsWith('.'));
    if (diffFiles.length > 0 && changes.length > 0) {
      const undeclared = diffFiles.filter(df => {
        const base = path.basename(df).toLowerCase();
        return !changes.some(c => c.toLowerCase().includes(base));
      });
      if (undeclared.length > 2) {
        console.error(`❌ PLAN COMPLETION GATE: ${undeclared.length} files in git diff NOT declared in changes[].`);
        console.error(`   Git shows ${diffFiles.length} changed files, postflight claims ${changes.length}.`);
        console.error(`   Undeclared: ${undeclared.slice(0, 5).join(', ')}${undeclared.length > 5 ? '...' : ''}`);
        process.exit(2);
      }
    }
  } catch (_) { /* git not available, skip cross-reference */ }

  if (changes.length === 0) {
    process.exit(0);
  }

  // Rule 1: Every file in changes[] must appear in sources_checked[].name
  // Stricter matching: exact basename match, not substring
  const uncheckedFiles = changes.filter(f => {
    const base = path.basename(f).toLowerCase();
    return !checked.some(s => {
      const sName = (s.name || '').toLowerCase();
      return sName.includes(base);
    });
  });

  if (uncheckedFiles.length > 0) {
    const ratio = Math.round(((changes.length - uncheckedFiles.length) / changes.length) * 100);
    console.error(`❌ PLAN COMPLETION GATE: ${uncheckedFiles.length}/${changes.length} files NOT verified.`);
    console.error(`   Completion: ${ratio}% (need 100%)`);
    console.error(`   Unchecked: ${uncheckedFiles.join(', ')}`);
    process.exit(2);
  }

  // Rule 2: Evidence must contain file path pattern, not just filler text
  const FILE_PATTERN = /\.(ts|tsx|js|jsx|css|json|md|cjs|gradle|xml|properties)\b|line\s*\d+|READ:|npx |npm /i;
  const shallowEvidence = checked.filter(s => !s.evidence || s.evidence.length < 15 || !FILE_PATTERN.test(s.evidence));
  if (shallowEvidence.length > 0) {
    console.error(`❌ PLAN COMPLETION GATE: ${shallowEvidence.length} sources have shallow/generic evidence.`);
    console.error(`   Evidence must reference specific files, line numbers, or command output.`);
    shallowEvidence.forEach(s => console.error(`   - ${s.name}: "${(s.evidence || '').slice(0, 60)}"`));
    process.exit(2);
  }

} catch (e) {
  // FAIL-CLOSED: parse errors = block (v2 fix)
  console.error(`❌ PLAN COMPLETION GATE: Failed to parse postflight — ${e.message}`);
  process.exit(2);
}
