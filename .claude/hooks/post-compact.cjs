#!/usr/bin/env node
/**
 * PostCompact hook — logs post-compaction event to audit trail.
 *
 * Fires after context window compression completes.
 * Advisory only — never blocks.
 * Source: SDK PostCompact event (verified: code.claude.com/docs/en/hooks.md)
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let trigger = 'unknown';
  try {
    const inp = JSON.parse(input);
    trigger = inp.trigger || 'auto';
  } catch {}

  const entry = JSON.stringify({ ts: Date.now(), hook: 'post-compact', event: 'compact-done', trigger }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
  process.exit(0);
});
