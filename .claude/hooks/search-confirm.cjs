#!/usr/bin/env node
/**
 * PostToolUse hook for Grep — FIND-ONE-SEARCH-ALL confirmation.
 *
 * Advisory (exit 0). Creates .search-confirmed token after Grep tool use.
 * This token is consumed by search-gate.cjs to unblock the next Edit/Write.
 *
 * Fail-open: if hook crashes → no token created → search-gate stays blocking → safe.
 *
 * Pattern: follows ide-diagnostic-gate.cjs (advisory PostToolUse, token creation).
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SEARCH_CONFIRMED = path.join(ROOT, '.search-confirmed');
const BUGFIX_PENDING = path.join(ROOT, '.bugfix-pending');
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // Only create token if .bugfix-pending exists (no point confirming without a pending fix)
    if (!fs.existsSync(BUGFIX_PENDING)) {
      process.exit(0);
    }

    // Extract search pattern from Grep tool input for audit trail
    const pattern = data.tool_input?.pattern || 'unknown';
    const searchPath = data.tool_input?.path || 'project-wide';

    // Create confirmation token
    const content = [
      'confirmed: ' + new Date().toISOString(),
      'pattern: ' + pattern,
      'path: ' + searchPath,
    ].join('\n');
    fs.writeFileSync(SEARCH_CONFIRMED, content, 'utf8');

    // Audit log
    const entry = JSON.stringify({
      ts: Date.now(),
      hook: 'search-confirm',
      event: 'confirmed',
      detail: 'pattern=' + String(pattern).slice(0, 100),
    }) + '\n';
    try { fs.appendFileSync(AUDIT_LOG, entry); } catch { /* best-effort */ }

    // Notify agent
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: 'SEARCH CONFIRMED: .search-confirmed token created for pattern "' +
          String(pattern).slice(0, 80) + '". Your next Edit/Write is now unblocked.',
      },
    }));
  } catch (e) {
    // Fail-open: crash → no token → search-gate stays blocking → safe
    process.stderr.write('HOOK ERROR [search-confirm]: ' + (e.message || e) + '\n');
  }
  process.exit(0);
});
