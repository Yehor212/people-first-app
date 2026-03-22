#!/usr/bin/env node
/**
 * InstructionsLoaded hook — logs when CLAUDE.md or rules files are loaded.
 *
 * Fires when instructions load (session_start, nested_traversal, path_glob_match, include, compact).
 * Useful for auditing which rules are active and detecting rule drift.
 * Advisory only — never blocks.
 * Source: SDK InstructionsLoaded event (verified: code.claude.com/docs/en/hooks.md)
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let filePath = 'unknown';
  let loadReason = 'unknown';
  try {
    const inp = JSON.parse(input);
    filePath = (inp.file_path || 'unknown').slice(-80);
    loadReason = inp.load_reason || inp.source || 'unknown';
  } catch {}

  const entry = JSON.stringify({ ts: Date.now(), hook: 'instructions-loaded', event: 'load', file: filePath, reason: loadReason }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
  process.exit(0);
});
