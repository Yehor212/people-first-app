#!/usr/bin/env node
/**
 * PostToolUseFailure hook — logs tool failures to audit trail.
 *
 * Fires after any tool execution fails.
 * Cannot block (tool already failed) — purely observational.
 * Useful for detecting error loops and recurring failures.
 * Advisory only — never blocks.
 *
 * Source: SDK PostToolUseFailure event.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let toolName = 'unknown';
  let errorMsg = 'unknown';
  let isInterrupt = false;
  try {
    const inp = JSON.parse(input);
    toolName = inp.tool_name || 'unknown';
    errorMsg = (inp.error || 'unknown').slice(0, 200);
    isInterrupt = inp.is_interrupt || false;
  } catch {}

  // Log failure to audit trail
  const entry = JSON.stringify({
    ts: Date.now(),
    hook: 'tool-failure-log',
    event: 'tool-failure',
    tool: toolName,
    error: errorMsg,
    interrupt: isInterrupt,
  }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}

  // Inject advisory context about the failure
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUseFailure',
      additionalContext: 'TOOL FAILURE LOGGED: ' + toolName + ' — ' + errorMsg.slice(0, 80),
    },
  }));

  process.exit(0);
});
