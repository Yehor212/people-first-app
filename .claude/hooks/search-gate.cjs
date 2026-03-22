#!/usr/bin/env node
/**
 * PreToolUse hook for Edit|Write — FIND-ONE-SEARCH-ALL gate.
 *
 * BLOCKING (exit 2). Enforces Law 3 (Exhaustion):
 * After a bug fix, the next Edit/Write is blocked until a project-wide
 * Grep confirms no similar instances remain.
 *
 * Token lifecycle:
 *   1. Bug fix made → agent creates .bugfix-pending (manual, prompted by ide-diagnostic-gate)
 *   2. Grep tool used → search-confirm.cjs creates .search-confirmed (automatic)
 *   3. Next Edit → this hook checks both tokens → cleans → allows
 *
 * Fail-closed: crash → exit 2 → edit blocked (safe default).
 * Stale tokens (>4h) auto-cleaned to prevent cross-session blocks.
 *
 * Pattern: follows preflight-gate.cjs (same fail-closed, stdin JSON, ROOT).
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const HOOK_NAME = "search-gate";
function audit(event, detail) {
  try { var e = JSON.stringify({ ts: Date.now(), hook: HOOK_NAME, event, detail });
    require("fs").appendFileSync(require("path").join(ROOT, ".claude-audit.log"), e + String.fromCharCode(10));
  } catch {}
}

const BUGFIX_PENDING = path.join(ROOT, '.bugfix-pending');
const SEARCH_CONFIRMED = path.join(ROOT, '.search-confirmed');
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');
const STALE_MS = 4 * 60 * 60 * 1000; // 4 hours

function auditLog(event, detail) {
  const entry = JSON.stringify({
    ts: Date.now(),
    hook: 'search-gate',
    event,
    detail: String(detail).slice(0, 200),
  }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch { /* best-effort */ }
}

function isStale(filePath) {
  try {
    return (Date.now() - fs.statSync(filePath).mtimeMs) > STALE_MS;
  } catch { return false; }
}

function cleanToken(filePath) {
  try { fs.unlinkSync(filePath); } catch { /* already gone */ }
}

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = (data.tool_input?.file_path || '').replace(/\\/g, '/');

    // Only enforce on TypeScript files (same filter as preflight-gate)
    if (!filePath.match(/\.(ts|tsx)$/)) {
      process.exit(0);
    }

    // Clean stale tokens (cross-session protection)
    if (fs.existsSync(BUGFIX_PENDING) && isStale(BUGFIX_PENDING)) {
      cleanToken(BUGFIX_PENDING);
      auditLog('stale-cleanup', 'bugfix-pending >4h');
    }
    if (fs.existsSync(SEARCH_CONFIRMED) && isStale(SEARCH_CONFIRMED)) {
      cleanToken(SEARCH_CONFIRMED);
      auditLog('stale-cleanup', 'search-confirmed >4h');
    }

    const hasBugfix = fs.existsSync(BUGFIX_PENDING);
    const hasSearch = fs.existsSync(SEARCH_CONFIRMED);

    // Case 1: No bugfix pending → normal flow
    if (!hasBugfix) {
      process.exit(0);
    }

    // Case 2: Both tokens → debt cleared, clean both, allow edit
    if (hasBugfix && hasSearch) {
      auditLog('debt-cleared', 'both tokens present → cleaned');
      cleanToken(BUGFIX_PENDING);
      cleanToken(SEARCH_CONFIRMED);
      audit("allow", "passed all checks");
  process.exit(0);
    }

    // Case 3: Bugfix pending but no search → BLOCK
    let bugfixInfo = '';
    try { bugfixInfo = fs.readFileSync(BUGFIX_PENDING, 'utf8').trim(); } catch {}

    process.stderr.write([
      '',
      '══════════════════════════════════════════════════════════════',
      '  FIND-ONE-SEARCH-ALL BLOCKED (Law 3 — Exhaustion)',
      '══════════════════════════════════════════════════════════════',
      '',
      '  You fixed a bug but have NOT searched the project for',
      '  similar instances.',
      '',
      bugfixInfo ? '  Context: ' + bugfixInfo : '',
      '',
      '  REQUIRED:',
      '  1. Use the Grep tool to search the ENTIRE project',
      '     for the same bug pattern',
      '  2. search-confirm.cjs will auto-create .search-confirmed',
      '  3. Then your next Edit will be unblocked',
      '',
      '  Emergency override: echo "override" > .search-confirmed',
      '',
      '══════════════════════════════════════════════════════════════',
      '',
    ].filter(Boolean).join('\n'));

    auditLog('BLOCKED', bugfixInfo || 'no context');
    process.exit(2);

  } catch (e) {
    // Fail-closed: ANY crash → block edit (safe default)
    process.stderr.write('HOOK CRASH [search-gate]: ' + (e.message || e) + ' — BLOCKING\n');
    auditLog('CRASH', e.message || String(e));
    process.exit(2);
  }
});
