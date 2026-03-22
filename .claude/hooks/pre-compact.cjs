#!/usr/bin/env node
/**
 * PreCompact hook — side-effect only (additionalContext NOT supported for PreCompact).
 *
 * Logs compaction event to audit trail. The actual enforcement reminder
 * is injected by session-start.cjs (which fires after compaction with source="compact"
 * and DOES support additionalContext).
 *
 * Source: SDK docs confirm PreCompact only supports: continue, stopReason, suppressOutput, systemMessage.
 * Advisory only — never blocks.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  // Log compaction event to audit trail
  const entry = JSON.stringify({ ts: Date.now(), hook: 'pre-compact', event: 'compact', trigger: 'auto' }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
  process.exit(0);
});
