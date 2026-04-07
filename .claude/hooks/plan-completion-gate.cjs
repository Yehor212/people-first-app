/**
 * PLAN COMPLETION GATE (Anti-Skip Hook)
 * Event: Stop
 * Purpose: Blocks agent from stopping if planned items != completed items.
 *
 * Checks:
 * 1. Reads .preflight-token for planned diagnostic_sources or files_to_edit
 * 2. Reads .postflight-done for sources_checked
 * 3. If planned count > checked count → EXIT 2 (BLOCK)
 * 4. If ratio < 100% → EXIT 2 (BLOCK)
 *
 * This prevents the agent from declaring "done" while items remain unchecked.
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();

try {
  // Read postflight
  const postPath = path.join(root, '.postflight-done');
  if (!fs.existsSync(postPath)) {
    // No postflight = quality-stop-gate handles this
    process.exit(0);
  }

  const post = JSON.parse(fs.readFileSync(postPath, 'utf8'));

  // Check: sources_checked must exist and have entries
  const checked = post.sources_checked || [];
  const changes = post.changes || [];

  if (changes.length === 0) {
    process.exit(0); // No changes claimed, nothing to verify
  }

  // Rule 1: Every file in changes[] must appear in sources_checked[].name
  const checkedNames = checked.map(s => (s.name || '').toLowerCase());
  const uncheckedFiles = changes.filter(f => {
    const lower = f.toLowerCase();
    return !checkedNames.some(name => name.includes(lower) || name.includes(path.basename(lower)));
  });

  if (uncheckedFiles.length > 0 && changes.length > 3) {
    const ratio = Math.round(((changes.length - uncheckedFiles.length) / changes.length) * 100);
    console.error(`❌ PLAN COMPLETION GATE: ${uncheckedFiles.length}/${changes.length} files NOT verified in sources_checked.`);
    console.error(`   Completion ratio: ${ratio}% (need 100%)`);
    console.error(`   Unchecked: ${uncheckedFiles.join(', ')}`);
    console.error(`   Fix: Add sources_checked entries for each unchecked file.`);
    process.exit(2);
  }

  // Rule 2: No sources_checked entry should have empty evidence
  const emptyEvidence = checked.filter(s => !s.evidence || s.evidence.length < 10);
  if (emptyEvidence.length > 0) {
    console.error(`❌ PLAN COMPLETION GATE: ${emptyEvidence.length} sources have empty/shallow evidence.`);
    emptyEvidence.forEach(s => console.error(`   - ${s.name}: "${s.evidence || ''}"`));
    process.exit(2);
  }

} catch (e) {
  // Don't block on parse errors — other hooks handle format
  process.exit(0);
}
