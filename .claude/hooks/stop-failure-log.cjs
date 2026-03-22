#!/usr/bin/env node
/**
 * StopFailure hook — logs API/system errors that terminate the turn.
 *
 * Fires when turn ends due to API error (rate limit, auth, server error).
 * Cannot prevent the failure — purely observational.
 * Useful for detecting recurring API issues and cost patterns.
 * Advisory only — never blocks.
 *
 * Source: SDK StopFailure event.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let errorType = 'unknown';
  let errorMsg = 'unknown';
  try {
    const inp = JSON.parse(input);
    errorType = inp.error_type || inp.stop_reason || 'unknown';
    errorMsg = (inp.error || inp.message || 'unknown').slice(0, 200);
  } catch {}

  // Log stop failure to audit trail
  const entry = JSON.stringify({
    ts: Date.now(),
    hook: 'stop-failure-log',
    event: 'stop-failure',
    errorType,
    error: errorMsg,
  }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}

  process.exit(0);
});
