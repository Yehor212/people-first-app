/**
 * PLAN COMPLETION GATE v2 (Anti-Skip Hook)
 * Event: Stop
 * Hook input: not required; validates .postflight-done against git diff and audit trail.
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
  // v2.1: Exact basename match with word boundary (not loose substring)
  const uncheckedFiles = changes.filter(f => {
    const base = path.basename(f).toLowerCase();
    const baseNoExt = base.replace(/\.[^.]+$/, '');
    return !checked.some(s => {
      const sName = (s.name || '').toLowerCase();
      // Match: exact basename, or basename without extension as whole word
      return sName.includes(base) || new RegExp('\\b' + baseNoExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(sName);
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

  // Rule 3: Audit trail cross-reference — verify claimed READs actually happened
  // This prevents fabricating "READ: src/file.tsx" in evidence without actually reading it
  try {
    const trailPath = path.join(root, '.tool-audit-trail');
    if (fs.existsSync(trailPath)) {
      const trail = fs.readFileSync(trailPath, 'utf8').split('\n').filter(Boolean);
      const trailEntries = trail.map(line => { try { return JSON.parse(line); } catch (_) { return null; } }).filter(Boolean);

      // Files that were actually Read
      const actualReads = trailEntries
        .filter(e => e.tool === 'Read')
        .map(e => path.basename(e.file || '').toLowerCase());

      // Files that were actually Edited/Written
      const actualEdits = trailEntries
        .filter(e => e.tool === 'Edit' || e.tool === 'Write')
        .map(e => path.basename(e.file || '').toLowerCase());

      // Rule 3a: Every edited file should have been Read first (temporal consistency)
      const editWithoutRead = actualEdits.filter(f => f && !actualReads.includes(f));
      if (editWithoutRead.length > 2) {
        console.error(`⚠️ PLAN COMPLETION GATE: ${editWithoutRead.length} files edited WITHOUT being Read first.`);
        console.error(`   Temporal consistency: Read BEFORE Edit is required.`);
        // Warning only, not blocking — some new files don't need prior Read
      }

      // Rule 3b: sources_checked evidence claiming "READ:" must match actual trail
      const claimedReads = checked
        .map(s => (s.evidence || '').match(/READ:\s*([\w/.-]+\.\w+)/gi) || [])
        .flat()
        .map(r => path.basename(r.replace(/^READ:\s*/i, '')).toLowerCase());

      if (claimedReads.length > 0 && actualReads.length > 0) {
        const fabricated = claimedReads.filter(cr => !actualReads.some(ar => ar.includes(cr) || cr.includes(ar)));
        if (fabricated.length > 0) {
          console.error(`❌ PLAN COMPLETION GATE: ${fabricated.length} claimed READ(s) NOT found in audit trail!`);
          console.error(`   Evidence fabrication detected: ${fabricated.join(', ')}`);
          console.error(`   Audit trail has ${actualReads.length} actual reads.`);
          process.exit(2);
        }
      }
    }
  } catch (_) { /* audit trail check is best-effort */ }

} catch (e) {
  // FAIL-CLOSED: parse errors = block (v2 fix)
  console.error(`❌ PLAN COMPLETION GATE: Failed to parse postflight — ${e.message}`);
  process.exit(2);
}
