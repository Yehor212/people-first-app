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

    // Only record SUCCESSFUL CI runs — failing commands should NOT create evidence
    // PostToolUse provides tool_result with stdout/stderr. Check for failure indicators.
    const stdout = data.tool_result?.stdout || data.stdout || '';
    const stderr = data.tool_result?.stderr || data.stderr || '';
    const exitCode = data.tool_result?.exit_code ?? data.exit_code ?? null;

    // Skip recording if command clearly failed
    if (exitCode !== null && exitCode !== 0) {
      // Command failed — do NOT record as evidence
      process.exit(0);
    }
    // Also check stderr for common failure patterns
    if (/error|FAIL|failed|ERR!/i.test(stderr) && !/warning/i.test(stderr)) {
      process.exit(0);
    }

    for (const cp of CI_PATTERNS) {
      if (cp.pattern.test(cmd)) {
        const entry = JSON.stringify({
          ts: Date.now(),
          command: cmd.slice(0, 120),
          pattern: cp.label,
          success: true,
        });
        fs.appendFileSync(CI_EVIDENCE, entry + '\n', 'utf8');
        break;
      }
    }
  } catch { /* ignore parse errors */ }

  // Advisory — always allow
  process.exit(0);
});
