#!/usr/bin/env node
/**
 * A-Evolve Enforcement Gate (PostToolUse: Stop)
 *
 * Based on arXiv:2602.00359 "Agentic Evolution" framework.
 * Blocks session end (Stop) if EVOLVE phase was not completed.
 *
 * EVOLVE phase requires writing .evolve-done token with:
 *   { timestamp, diagnose, update, verify }
 *
 * This ensures every session produces:
 * 1. Diagnosis of what was learned (cross-episode)
 * 2. Updated artifacts (memory_store / neural_train)
 * 3. Verification of changes (blind reviewer / consensus)
 *
 * Advisory (exit 0 with warning), not blocking (exit 2),
 * because EVOLVE is a learning step not a safety gate.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const EVOLVE_TOKEN = path.join(ROOT, '.evolve-done');
const HOOK_NAME = 'evolve-gate';

function audit(event, detail) {
  try {
    const entry = JSON.stringify({ ts: Date.now(), hook: HOOK_NAME, event, detail });
    fs.appendFileSync(path.join(ROOT, '.claude-audit.log'), entry + '\n');
  } catch {}
}

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const tool = data.tool_name || '';

    // Only fire on Stop
    if (tool !== 'Stop') {
      process.exit(0);
    }

    // Check for .evolve-done token
    if (!fs.existsSync(EVOLVE_TOKEN)) {
      audit('warn', 'No .evolve-done token — EVOLVE phase skipped');
      process.stderr.write(
        'A-EVOLVE WARNING: No .evolve-done token found.\n\n' +
        'The A-Evolve framework (arXiv:2602.00359) requires EVOLVE phase after every session:\n' +
        '  1. DIAGNOSE: What patterns emerged? (memory_search + neural_patterns)\n' +
        '  2. UPDATE: Save reusable artifacts (memory_store + neural_train)\n' +
        '  3. VERIFY: Were changes validated? (hive-mind_consensus)\n\n' +
        'Write .evolve-done as JSON:\n' +
        '  { "timestamp": "ISO", "diagnose": "what I learned",\n' +
        '    "update": "what artifacts created/evolved",\n' +
        '    "verify": "how changes were validated" }\n\n' +
        'This is ADVISORY — session will continue. But skipping EVOLVE means\n' +
        'no cross-session learning persists.\n'
      );
      // Advisory only — exit 0 (don't block)
      process.exit(0);
    }

    // Validate token structure
    try {
      const token = JSON.parse(fs.readFileSync(EVOLVE_TOKEN, 'utf8').replace(/^\uFEFF/, ''));

      const required = ['timestamp', 'diagnose', 'update', 'verify'];
      const missing = required.filter(k => !token[k] || (typeof token[k] === 'string' && token[k].length < 5));

      if (missing.length > 0) {
        audit('warn', 'Incomplete .evolve-done: missing ' + missing.join(', '));
        process.stderr.write(
          'A-EVOLVE WARNING: .evolve-done incomplete. Missing: ' + missing.join(', ') + '.\n' +
          'Each field must be ≥5 chars with real content.\n'
        );
      } else {
        audit('pass', 'EVOLVE phase completed: ' + token.diagnose.slice(0, 50));
        // Clean up token (one-time use)
        fs.unlinkSync(EVOLVE_TOKEN);
      }
    } catch (e) {
      audit('warn', 'Invalid .evolve-done JSON: ' + e.message);
      process.stderr.write('A-EVOLVE WARNING: .evolve-done is not valid JSON.\n');
    }

    process.exit(0);
  } catch {
    process.exit(0); // Never block on hook errors
  }
});
