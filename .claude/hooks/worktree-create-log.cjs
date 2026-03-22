#!/usr/bin/env node
/**
 * WorktreeCreate hook — logs worktree creation events.
 *
 * Fires when a git worktree is being created (isolation mode).
 * Advisory only — never blocks.
 * Source: SDK WorktreeCreate event (verified: code.claude.com/docs/en/hooks.md)
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let name = 'unknown';
  try {
    const inp = JSON.parse(input);
    name = (inp.name || 'unknown').slice(0, 60);
  } catch {}

  const entry = JSON.stringify({ ts: Date.now(), hook: 'worktree-create-log', event: 'worktree-create', name }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
  process.exit(0);
});
