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

  // Save audit checklist progress to .ruflo-session-snapshot for cross-session persistence
  const CHECKLIST = path.join(ROOT, '.audit-checklist.json');
  const SNAPSHOT = path.join(ROOT, '.ruflo-session-snapshot');
  if (fs.existsSync(CHECKLIST)) {
    try {
      const checklist = JSON.parse(fs.readFileSync(CHECKLIST, 'utf8'));
      const items = checklist.items || [];
      const done = items.filter(i => i.done).length;
      const snapshot = {
        timestamp: new Date().toISOString(),
        checklist_total: items.length,
        checklist_done: done,
        checklist_pct: items.length > 0 ? Math.round(done / items.length * 100) : 0,
        pending_items: items.filter(i => !i.done).map(i => ({ id: i.id, desc: (i.description || '').slice(0, 60) })).slice(0, 20),
        session_reason: reason,
      };
      fs.writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch {}
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
