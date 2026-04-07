/**
 * MIDDLE-ITEM AUDIT (Anti-Skip Hook)
 * Event: PreToolUse(Bash) — git commit
 * Purpose: For large changesets (>5 files), verifies middle items have evidence.
 *
 * Research basis: "Middle-Item Problem" — AI agents reliably handle first/last
 * items but skip middle ones (40%+ skip rate on positions 3-7 in long lists).
 *
 * Checks:
 * 1. Reads postflight changes[] array
 * 2. If >5 items, extracts middle third (positions ceil(N/3) to ceil(2N/3))
 * 3. Each middle item must appear in sources_checked[] with non-empty evidence
 * 4. If any middle item has no evidence → EXIT 2 (BLOCK)
 */
const fs = require('fs');
const path = require('path');

// Only run on git commit
const input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8').toString() || '{}');
if (input.tool !== 'Bash') process.exit(0);
const cmd = (input.input?.command || '').toLowerCase();
if (!cmd.includes('git commit') && !cmd.includes('git commit')) process.exit(0);

const root = process.cwd();

try {
  const postPath = path.join(root, '.postflight-done');
  if (!fs.existsSync(postPath)) process.exit(0);

  const post = JSON.parse(fs.readFileSync(postPath, 'utf8'));
  const changes = post.changes || [];
  const checked = post.sources_checked || [];

  // Only audit lists with >5 items
  if (changes.length <= 5) process.exit(0);

  const N = changes.length;
  const start = Math.ceil(N / 3);
  const end = Math.ceil((2 * N) / 3);
  const middleItems = changes.slice(start, end);

  const checkedNames = checked.map(s => (s.name || '').toLowerCase());
  const checkedEvidence = checked.reduce((acc, s) => {
    acc[(s.name || '').toLowerCase()] = s.evidence || '';
    return acc;
  }, {});

  const uncheckedMiddle = middleItems.filter(item => {
    const lower = item.toLowerCase();
    const base = path.basename(lower);
    return !checkedNames.some(name => name.includes(lower) || name.includes(base));
  });

  if (uncheckedMiddle.length > 0) {
    console.error(`❌ MIDDLE-ITEM AUDIT: ${uncheckedMiddle.length} middle items (positions ${start + 1}-${end}) have NO evidence.`);
    console.error(`   Research: AI agents skip middle items 40%+ of the time.`);
    uncheckedMiddle.forEach(item => {
      console.error(`   ⚠️ [${changes.indexOf(item) + 1}/${N}] ${item} — missing from sources_checked`);
    });
    console.error(`   Fix: Add sources_checked entry for each middle item with specific evidence.`);
    process.exit(2);
  }

  // Check middle items have non-shallow evidence
  const shallowMiddle = middleItems.filter(item => {
    const lower = item.toLowerCase();
    const base = path.basename(lower);
    const match = checked.find(s => {
      const name = (s.name || '').toLowerCase();
      return name.includes(lower) || name.includes(base);
    });
    return match && (!match.evidence || match.evidence.length < 15);
  });

  if (shallowMiddle.length > 0) {
    console.error(`❌ MIDDLE-ITEM AUDIT: ${shallowMiddle.length} middle items have SHALLOW evidence (<15 chars).`);
    shallowMiddle.forEach(item => console.error(`   ⚠️ ${item}`));
    process.exit(2);
  }

} catch (e) {
  process.exit(0);
}
