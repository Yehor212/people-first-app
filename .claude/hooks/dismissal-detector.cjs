/**
 * DISMISSAL DETECTOR v2 (Anti-Skip Hook)
 * Event: Stop
 * Hook input: not required; validates .postflight-done and session evidence files.
 * Purpose: Detects and blocks "skip language" without evidence.
 *
 * v2 fixes (adversarial audit 2026-04-07):
 * - FAIL-CLOSED: catch exits 2
 * - Checks ALL occurrences, not just first
 * - Expanded pattern list (35 patterns including synonyms)
 * - Evidence must contain actual file path, not just any .ts mention
 */
const fs = require('fs');
const path = require('path');

const DISMISSAL_PATTERNS = [
  // Original 15
  'enhancement', 'can wait', 'next session', 'out of scope',
  'pre-existing', 'pre existing', 'nice to have', 'nice-to-have',
  'not a bug', 'not needed', 'separate pr', 'separate commit',
  'low priority', 'skip for now', 'defer',
  // v2: 20 additional synonyms (adversarial audit)
  "won't fix", 'wontfix', 'later', 'future work', 'beyond scope',
  'outside scope', 'not in scope', 'non-critical', 'cosmetic',
  'minor issue', 'trivial', 'known issue', 'acceptable',
  'by design', 'intended behavior', 'not relevant', 'n/a',
  'out-of-scope', 'not blocking', 'deprioritize',
];

const root = process.cwd();

try {
  const postPath = path.join(root, '.postflight-done');
  if (!fs.existsSync(postPath)) {
    process.exit(0);
  }

  const raw = fs.readFileSync(postPath, 'utf8');
  const post = JSON.parse(raw);
  const fullText = JSON.stringify(post).toLowerCase();

  const found = DISMISSAL_PATTERNS.filter(p => fullText.includes(p));
  if (found.length === 0) {
    process.exit(0);
  }

  // v2: Check ALL occurrences of each pattern, not just first
  const hasFileEvidence = (context) => {
    // Must contain an actual file path with extension AND a meaningful reference
    return /\b[\w/.-]+\.(ts|tsx|js|jsx|css|json|md|cjs|gradle)\b/.test(context) &&
           (context.length > 50 || /line\s*\d+|:\d+|READ:/.test(context));
  };

  const unjustified = [];
  for (const pattern of found) {
    let idx = 0;
    while ((idx = fullText.indexOf(pattern, idx)) !== -1) {
      const context = fullText.substring(Math.max(0, idx - 150), Math.min(fullText.length, idx + 250));
      if (!hasFileEvidence(context)) {
        unjustified.push({ pattern, position: idx, context: context.slice(0, 80) });
      }
      idx += pattern.length;
    }
  }

  if (unjustified.length > 0) {
    // Deduplicate by pattern
    const unique = [...new Set(unjustified.map(u => u.pattern))];
    console.error(`❌ DISMISSAL DETECTOR: ${unique.length} unjustified dismissal(s):`);
    unique.forEach(p => {
      console.error(`   ⚠️ "${p}" — needs file:line evidence or technical justification with file refs`);
    });
    console.error(`   Fix: Either fix the dismissed item OR add "because src/file.tsx:42 shows..." evidence.`);
    process.exit(2);
  }

  if (found.length > 0) {
    console.error(`⚠️ DISMISSAL DETECTOR: ${found.length} dismissal(s) found but all justified. Allowed.`);
  }

} catch (e) {
  // FAIL-CLOSED (v2 fix)
  console.error(`❌ DISMISSAL DETECTOR: Parse error — ${e.message}`);
  process.exit(2);
}
