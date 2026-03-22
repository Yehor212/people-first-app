#!/usr/bin/env node
/**
 * Notification hook — logs notification events to audit trail.
 *
 * Fires on: permission_prompt, idle_prompt, auth_success, elicitation_dialog.
 * Useful for tracking permission patterns and idle states.
 * Advisory only — never blocks.
 * Source: SDK Notification event (verified: code.claude.com/docs/en/hooks.md)
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let notificationType = 'unknown';
  let message = '';
  try {
    const inp = JSON.parse(input);
    notificationType = inp.notification_type || inp.type || 'unknown';
    message = (inp.message || inp.title || '').slice(0, 100);
  } catch {}

  const entry = JSON.stringify({ ts: Date.now(), hook: 'notification-log', event: 'notification', type: notificationType, msg: message || undefined }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
  process.exit(0);
});
