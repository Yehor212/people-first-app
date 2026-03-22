#!/usr/bin/env node
/**
 * Elicitation hook — logs MCP server elicitation requests.
 *
 * Fires when an MCP server requests user input.
 * Logs which MCP servers are requesting interaction.
 * Advisory only — never blocks (let user decide).
 * Source: SDK Elicitation event (verified: code.claude.com/docs/en/hooks.md)
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let serverName = 'unknown';
  let mode = 'unknown';
  try {
    const inp = JSON.parse(input);
    serverName = inp.mcp_server_name || 'unknown';
    mode = inp.mode || 'unknown';
  } catch {}

  const entry = JSON.stringify({ ts: Date.now(), hook: 'elicitation-log', event: 'elicitation', server: serverName, mode }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
  process.exit(0);
});
