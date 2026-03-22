#!/usr/bin/env node
/**
 * WorktreeRemove hook — logs worktree removal events.
 *
 * Fires when a git worktree is being removed (cleanup).
 * Advisory only — never blocks.
 * Source: SDK WorktreeRemove event (verified: code.claude.com/docs/en/hooks.md)
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let worktreePath = 'unknown';
  try {
    const inp = JSON.parse(input);
    worktreePath = (inp.worktree_path || 'unknown').slice(-60);
  } catch {}

  const entry = JSON.stringify({ ts: Date.now(), hook: 'worktree-remove-log', event: 'worktree-remove', path: worktreePath }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
  process.exit(0);
});
