#!/usr/bin/env node
/**
 * PreToolUse hook for Edit/Write — PRE-FLIGHT enforcement gate.
 *
 * BLOCKS code edits on .ts/.tsx files unless .preflight-token exists
 * with valid content (must contain "7checks", "verdict", "GO").
 *
 * AgentSpec tuple: (Edit/Write on .ts/.tsx, no valid .preflight-token, BLOCK)
 *
 * Exceptions (always allowed):
 * - Non-TypeScript files (.css, .json, .md, .html, etc.)
 * - Files in .claude/hooks/ (hook development)
 * - Files in docs/ (documentation)
 * - Files in memory/ (memory system)
 * - Test token files (.preflight-token, .postflight-done, etc.)
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const HOOK_NAME = "preflight-gate";
function audit(event, detail) {
  try { var e = JSON.stringify({ ts: Date.now(), hook: HOOK_NAME, event, detail });
    require("fs").appendFileSync(require("path").join(ROOT, ".claude-audit.log"), e + String.fromCharCode(10));
  } catch {}
}

const TOKEN = path.join(ROOT, '.preflight-token');

// Paths that bypass the gate (not production code)
const BYPASS_PATTERNS = [
  '.claude/hooks/',
  '.claude/settings',
  'docs/',
  'memory/',
  '.preflight-token',
  '.postflight-done',
  '.fullcycle-active',
  '.fullcycle-laws-read',
];

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = (data.tool_input?.file_path || '').replace(/\\/g, '/');

    // Only gate TypeScript files
    if (!filePath.match(/\.(ts|tsx)$/)) {
      process.exit(0); // Allow non-TS files
    }

    // Check bypass patterns
    const relPath = filePath.replace(ROOT.replace(/\\/g, '/'), '').replace(/^\//, '');
    if (BYPASS_PATTERNS.some(p => relPath.startsWith(p))) {
      process.exit(0); // Allow bypassed paths
    }

    // §A: Check .ide-ack-pending — if exists, must have .ide-ack-done before next edit
    const IDE_ACK_PENDING = path.join(ROOT, '.ide-ack-pending');
    const IDE_ACK_DONE = path.join(ROOT, '.ide-ack-done');
    if (fs.existsSync(IDE_ACK_PENDING)) {
      if (fs.existsSync(IDE_ACK_DONE)) {
        // Acknowledged — clean both tokens and proceed
        try { fs.unlinkSync(IDE_ACK_PENDING); } catch {}
        try { fs.unlinkSync(IDE_ACK_DONE); } catch {}
      } else {
        // NOT acknowledged — block
        let pendingInfo = '';
        try { pendingInfo = JSON.parse(fs.readFileSync(IDE_ACK_PENDING, 'utf8')).file || ''; } catch {}
        process.stderr.write(
          'IDE DIAGNOSTIC ACK REQUIRED!\n\n' +
          'Before editing again, acknowledge IDE diagnostics:\n' +
          '  echo \'{"file":"' + pendingInfo + '","errors":0}\' > .ide-ack-done\n' +
          '  OR if fixing: echo \'{"file":"' + pendingInfo + '","fixing":"[error desc]"}\' > .ide-ack-done\n'
        );
        process.exit(2);
      }
    }

    // Check for valid preflight token (atomic read — no race condition)
    let tokenContent = '';
    try { tokenContent = fs.readFileSync(TOKEN, 'utf8'); } catch { /* no token or read error */ }

    const cleaned = tokenContent.replace(/^\uFEFF/, '').trim();

    // Structured JSON format (new — validated by preflight-validate.cjs)
    if (cleaned.startsWith('{')) {
      try {
        const { validate } = require('./preflight-validate.cjs');
        const result = validate(cleaned);
        if (result.valid) {
          process.exit(0); // Structured token valid — allow edit
        }
        // Invalid structured token — block with specific errors
        process.stderr.write(
          'PRE-FLIGHT TOKEN INVALID (structured JSON):\n' +
          result.errors.map(e => '  - ' + e).join('\n') + '\n\n' +
          'Fix the errors in .preflight-token and retry.\n'
        );
        process.exit(2);
      } catch (requireErr) {
        // preflight-validate.cjs not found — fail-closed
        process.stderr.write('HOOK ERROR [preflight-gate]: Cannot load preflight-validate.cjs: ' + requireErr.message + '\n');
        process.exit(2);
      }
    }

    // Legacy format — accept with warning
    // TODO(2026-04-03): Remove legacy format support
    const tokenLower = cleaned.toLowerCase();
    if (tokenLower.includes('7checks') && tokenLower.includes('verdict') && tokenLower.includes('go')) {
      process.stderr.write('WARNING: Legacy .preflight-token format detected. Use structured JSON for better validation.\n');
      audit("allow", "passed all checks");
  process.exit(0); // Legacy token valid — allow edit
    }

    // BLOCK — no valid token
    process.stderr.write(
      'PRE-FLIGHT GATE BLOCKED!\n\n' +
      'You MUST complete the <thinking> block with 7 checks + VERDICT: GO before editing TypeScript files.\n\n' +
      'Write structured JSON to .preflight-token:\n' +
      '  { timestamp, goal, depth (L1/L2/L3), transmutation, checks_completed,\n' +
      '    evidence: {read[], search[], assumed[]}, pre_mortem,\n' +
      '    confidence: {codebase_familiarity, change_scope, regression_risk,\n' +
      '    platform_coverage, state_integrity} (1-9, 10 forbidden),\n' +
      '    overall_score, unknowns, verdict: "GO" }\n\n' +
      'Or legacy format:\n' +
      '  echo "preflight-7checks-verdict-GO" > .preflight-token && echo "GOAL: [your goal]" >> .preflight-token\n'
    );
    process.exit(2);
  } catch (e) {
    // Fail-CLOSED: security hook must block on error, not allow
    // (SDK fail-open on exit(1) means crash = bypass. exit(2) = explicit block)
    process.stderr.write('HOOK ERROR [preflight-gate]: ' + (e.message || e) + '\n');
    process.exit(2);
  }
});
