#!/usr/bin/env node
/**
 * PermissionRequest hook — logs permission request events.
 *
 * Fires when a permission dialog would appear for a tool.
 * Logs which tools request permissions for audit analysis.
 * Advisory only — never blocks (let user decide).
 * Source: SDK PermissionRequest event (verified: code.claude.com/docs/en/hooks.md)
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let toolName = 'unknown';
  try {
    const inp = JSON.parse(input);
    toolName = inp.tool_name || 'unknown';
  } catch {}

  const entry = JSON.stringify({ ts: Date.now(), hook: 'permission-request-log', event: 'permission-request', tool: toolName }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
  process.exit(0);
});
