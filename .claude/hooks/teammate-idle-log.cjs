#!/usr/bin/env node
/**
 * TeammateIdle hook — logs when an Agent Teams teammate becomes idle.
 *
 * Fires in Agent Teams mode (experimental) when a teammate finishes.
 * Advisory only — never blocks.
 * Source: SDK TeammateIdle event (verified: code.claude.com/docs/en/hooks.md)
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let teammateName = 'unknown';
  let teamName = 'unknown';
  try {
    const inp = JSON.parse(input);
    teammateName = (inp.teammate_name || 'unknown').slice(0, 40);
    teamName = (inp.team_name || 'unknown').slice(0, 40);
  } catch {}

  const entry = JSON.stringify({ ts: Date.now(), hook: 'teammate-idle-log', event: 'teammate-idle', teammate: teammateName, team: teamName }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
  process.exit(0);
});
