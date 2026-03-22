#!/usr/bin/env node
/**
 * SubagentStart hook — logs subagent spawn events to audit trail.
 *
 * Fires when a subagent is spawned via Agent tool.
 * Injects enforcement reminder so subagents inherit context.
 * Advisory only — never blocks.
 *
 * Source: SDK SubagentStart event, hooks inherit to subagents but context may be lost.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let agentType = 'unknown';
  let agentId = 'unknown';
  try {
    const inp = JSON.parse(input);
    agentType = inp.agent_type || 'unknown';
    agentId = inp.agent_id || 'unknown';
  } catch {}

  // Log subagent spawn to audit trail
  const entry = JSON.stringify({
    ts: Date.now(),
    hook: 'subagent-start',
    event: 'spawn',
    agentType,
    agentId: agentId.slice(0, 20),
  }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}

  // Inject enforcement context for subagent
  const reminder = [
    'SUBAGENT ENFORCEMENT: Hooks apply to subagents.',
    'Protected files: .env, keystore, auth.ts, CLAUDE.md, settings.json.',
    'PRE-FLIGHT required before TS edits. POST-FLIGHT before stop.',
  ].join(' ');

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SubagentStart',
      additionalContext: reminder,
    },
  }));

  process.exit(0);
});
