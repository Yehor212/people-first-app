#!/usr/bin/env node
/**
 * SessionEnd hook — cleanup tokens and final audit entry.
 *
 * Fires when session terminates (clear, logout, exit).
 * Cleans up temporary token files.
 * Writes final audit entry with session summary.
 * Advisory only — never blocks.
 *
 * Source: SDK SessionEnd event.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

const CLEANUP_TOKENS = [
  '.preflight-token',
  '.postflight-done',
  '.fullcycle-active',
  '.fullcycle-laws-read',
  '.claude-md-unlock',
];

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let reason = 'unknown';
  try {
    const inp = JSON.parse(input);
    reason = inp.session_end_reason || inp.reason || 'unknown';
  } catch {}

  // Clean up temporary token files
  const cleaned = [];
  for (const token of CLEANUP_TOKENS) {
    const tokenPath = path.join(ROOT, token);
    try {
      if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath);
        cleaned.push(token);
      }
    } catch { /* ignore cleanup errors */ }
  }

  // Log session end to audit trail
  const entry = JSON.stringify({
    ts: Date.now(),
    hook: 'session-end',
    event: 'end',
    reason,
    cleaned: cleaned.length > 0 ? cleaned : undefined,
  }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}

  process.exit(0);
});
