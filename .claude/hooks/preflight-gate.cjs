#!/usr/bin/env node
/**
 * PreToolUse hook for Edit/Write — PRE-FLIGHT enforcement gate.
 *
 * BLOCKS repo-impacting edits unless .preflight-token exists
 * with valid content (must contain "7checks", "verdict", "GO").
 *
 * AgentSpec tuple: (Edit/Write on guarded file, no valid .preflight-token, BLOCK)
 *
 * Guarded by default:
 * - Runtime/test/build files (.ts/.tsx/.js/.cjs/.mjs and related paths)
 * - Governance/enforcement docs (docs/ai/, AGENTS.md, ARCHITECTURE.md)
 * - Configs, lockfiles, manifests, and hook/agent templates
 *
 * Exceptions (always allowed):
 * - Session artifact token files (.preflight-token, .postflight-done, etc.)
 * - memory/ notes
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

// Paths that always bypass the gate (session artifacts / memory)
const ALWAYS_ALLOW_PATTERNS = [
  'memory/',
  '.preflight-token',
  '.test-first-token',
  '.postflight-done',
  '.fullcycle-active',
  '.fullcycle-laws-read',
  '.verification-done',
  '.ci-evidence',
  '.ide-ack-pending',
  '.ide-ack-done',
];

const GUARDED_PREFIXES = [
  '.claude/hooks/',
  '.Codex/',
  '.agents/',
  'src/',
  'e2e/',
  'scripts/',
  'supabase/',
  'android/',
  'ios/',
  'tools/ruflow-plus/templates/',
  'docs/ai/',
];

const GUARDED_EXACT_FILES = new Set([
  'AGENTS.md',
  'ARCHITECTURE.md',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'netlify.toml',
]);

const GUARDED_CODE_EXT = /\.(ts|tsx|js|jsx|cjs|mjs|cts|mts)$/i;
const GUARDED_CONFIG_PATTERNS = [
  /(^|\/)(tsconfig(\..+)?\.json)$/i,
  /(^|\/)(playwright|vite|vitest|tailwind|capacitor|eslint|postcss)\.config\.[cm]?[jt]s$/i,
  /(^|\/)(knip|vercel)\.json$/i,
  /\.toml$/i,
];

function requiresPreflight(relPath) {
  if (!relPath) return false;
  if (ALWAYS_ALLOW_PATTERNS.some(p => relPath.startsWith(p))) {
    return false;
  }
  if (GUARDED_EXACT_FILES.has(relPath)) {
    return true;
  }
  if (GUARDED_PREFIXES.some(p => relPath.startsWith(p))) {
    return true;
  }
  if (GUARDED_CODE_EXT.test(relPath)) {
    return true;
  }
  return GUARDED_CONFIG_PATTERNS.some(pattern => pattern.test(relPath));
}

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = (data.tool_input?.file_path || '').replace(/\\/g, '/');

    const relPath = filePath.replace(ROOT.replace(/\\/g, '/'), '').replace(/^\//, '');
    if (!requiresPreflight(relPath)) {
      process.exit(0); // Allow non-guarded paths
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
      'You MUST complete the <thinking> block with 7 checks + VERDICT: GO before editing guarded repo files.\n' +
      'Use docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md as the operator contract.\n\n' +
      'Write structured JSON to .preflight-token:\n' +
      '  { timestamp, goal, depth (L1/L2/L3/L4), transmutation, checks_completed,\n' +
      '    evidence: {read[], search[], assumed[]}, pre_mortem,\n' +
      '    confidence: {codebase_familiarity, change_scope, regression_risk,\n' +
      '    platform_coverage, state_integrity} (1-9, 10 forbidden),\n' +
      '    overall_score, scope_boundaries, post_verification_plan,\n' +
      '    anti_patterns_checked, unknowns, verdict: "GO" }\n\n' +
      'Repo-touching work defaults to L2 minimum. Cross-platform/stateful/prompt/config/build/CI/sync/auth work usually requires L3.\n\n' +
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
