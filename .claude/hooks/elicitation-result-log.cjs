#!/usr/bin/env node
/**
 * ElicitationResult hook — logs MCP elicitation responses.
 *
 * Fires when user responds to an MCP server elicitation.
 * Advisory only — never blocks.
 * Source: SDK ElicitationResult event (verified: code.claude.com/docs/en/hooks.md)
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let serverName = 'unknown';
  try {
    const inp = JSON.parse(input);
    serverName = inp.mcp_server_name || 'unknown';
  } catch {}

  const entry = JSON.stringify({ ts: Date.now(), hook: 'elicitation-result-log', event: 'elicitation-result', server: serverName }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
  process.exit(0);
});
