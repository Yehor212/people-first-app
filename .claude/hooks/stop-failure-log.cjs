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

  // Escalating enforcement: track consecutive stop failures
  const BLOCK_COUNTER = path.join(ROOT, '.stop-block-count');
  let blockCount = 0;
  try { blockCount = parseInt(fs.readFileSync(BLOCK_COUNTER, 'utf8')) || 0; } catch {}
  blockCount++;
  try { fs.writeFileSync(BLOCK_COUNTER, String(blockCount), 'utf8'); } catch {}

  // Log stop failure to audit trail with escalation level
  const escalation = blockCount >= 5 ? 'CRITICAL' : blockCount >= 3 ? 'HIGH' : 'NORMAL';
  const entry = JSON.stringify({
    ts: Date.now(),
    hook: 'stop-failure-log',
    event: 'stop-failure',
    errorType,
    error: errorMsg,
    blockCount,
    escalation,
  }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}

  if (blockCount >= 3) {
    process.stderr.write(
      `\n🚨 ESCALATING ENFORCEMENT (${blockCount} consecutive stop failures):\n` +
      `The same issue has blocked you ${blockCount} times.\n` +
      (blockCount >= 5
        ? 'CRITICAL: 5+ blocks. Review .claude-audit.log for pattern. Consider resetting with: rm .stop-block-count\n'
        : 'Check the block reason and fix the root cause before retrying.\n') +
      '\n'
    );
  }

  process.exit(0);
});
