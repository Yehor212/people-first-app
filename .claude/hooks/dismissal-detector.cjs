/**
 * DISMISSAL DETECTOR (Anti-Skip Hook)
 * Event: Stop
 * Purpose: Detects and blocks "skip language" in postflight without evidence.
 *
 * Catches these dismissal patterns:
 * - "enhancement" (dismissing as not a bug)
 * - "can wait" / "next session" (deferring)
 * - "out of scope" (narrowing without evidence)
 * - "pre-existing" (dismissing errors)
 * - "nice to have" / "nice-to-have" (minimizing)
 * - "not a bug" (dismissing without proof)
 * - "separate PR" / "separate commit" (splitting to avoid)
 *
 * Each dismissal MUST be accompanied by file:line evidence or technical justification (50+ chars).
 * Without evidence → EXIT 2 (BLOCK)
 */
const fs = require('fs');
const path = require('path');

const DISMISSAL_PATTERNS = [
  'enhancement',
  'can wait',
  'next session',
  'out of scope',
  'pre-existing',
  'pre existing',
  'nice to have',
  'nice-to-have',
  'not a bug',
  'not needed',
  'separate pr',
  'separate commit',
  'low priority',
  'skip for now',
  'defer',
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
    process.exit(0); // No dismissals found
  }

  // Check if dismissals have evidence (file references or long justification)
  const hasEvidence = (text) => {
    // Must contain file:line ref OR 50+ char justification after the dismissal word
    return /\.(ts|tsx|js|jsx|css|json|md|cjs)/.test(text) ||
           /line\s+\d+/.test(text) ||
           /READ:/.test(text);
  };

  // Check sources_checked for evidence near dismissals
  const sources = post.sources_checked || [];
  const whatWrong = post.self_reflection?.what_went_wrong || '';
  const evidenceText = JSON.stringify(sources) + whatWrong;

  const unjustified = found.filter(pattern => {
    // Find the context around this pattern
    const idx = fullText.indexOf(pattern);
    const context = fullText.substring(Math.max(0, idx - 100), Math.min(fullText.length, idx + 200));
    return !hasEvidence(context);
  });

  if (unjustified.length > 0) {
    console.error(`❌ DISMISSAL DETECTOR: Found ${unjustified.length} unjustified dismissal(s):`);
    unjustified.forEach(p => {
      console.error(`   ⚠️ "${p}" — needs file:line evidence or 50+ char technical justification`);
    });
    console.error(`   Fix: Either fix the dismissed item OR add evidence why it's genuinely not needed.`);
    console.error(`   Pattern: "enhancement" without evidence = BLOCKED. "enhancement because X.tsx:42 shows..." = ALLOWED.`);
    process.exit(2);
  }

  // Justified dismissals are OK
  if (found.length > 0) {
    console.error(`⚠️ DISMISSAL DETECTOR: ${found.length} dismissal(s) found but justified with evidence. Allowed.`);
  }

} catch (e) {
  process.exit(0);
}
