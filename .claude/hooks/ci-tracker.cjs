#!/usr/bin/env node
/**
 * PostToolUse Bash hook — CI execution tracker.
 *
 * Records when CI-related commands execute to .ci-evidence file.
 * Used by evidence-veracity.cjs V4 to verify ci_passed:true claims.
 *
 * Advisory only — exit(0). Never blocks Bash execution.
 * Proof-of-Execution (PoE): evidence generated DURING execution, not reconstructed.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CI_EVIDENCE = path.join(ROOT, '.ci-evidence');

const CI_PATTERNS = [
  { pattern: /npm\s+run\s+ci:preflight/i, label: 'ci:preflight' },
  { pattern: /npm\s+run\s+ratchet:check/i, label: 'ratchet:check' },
  { pattern: /npx\s+eslint/i, label: 'eslint' },
  { pattern: /tsc\s+--noEmit/i, label: 'tsc' },
  { pattern: /npx\s+tsc/i, label: 'tsc' },
  { pattern: /vitest\s+run/i, label: 'vitest' },
];

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cmd = data.tool_input?.command || data.toolInput?.command || '';

    for (const cp of CI_PATTERNS) {
      if (cp.pattern.test(cmd)) {
        const entry = JSON.stringify({
          ts: Date.now(),
          command: cmd.slice(0, 120), // truncate for safety
          pattern: cp.label,
        });
        fs.appendFileSync(CI_EVIDENCE, entry + '\n', 'utf8');
        break; // one match per command
      }
    }
  } catch { /* ignore parse errors */ }

  // Advisory — always allow
  process.exit(0);
});
