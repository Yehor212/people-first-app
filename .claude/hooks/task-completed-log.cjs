#!/usr/bin/env node
/**
 * TaskCompleted hook — logs when a background task completes.
 *
 * Fires when a background task is marked complete.
 * Advisory only — never blocks.
 * Source: SDK TaskCompleted event (verified: code.claude.com/docs/en/hooks.md)
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let taskId = 'unknown';
  let taskSubject = 'unknown';
  try {
    const inp = JSON.parse(input);
    taskId = (inp.task_id || 'unknown').slice(0, 30);
    taskSubject = (inp.task_subject || inp.task_description || 'unknown').slice(0, 80);
  } catch {}

  const entry = JSON.stringify({ ts: Date.now(), hook: 'task-completed-log', event: 'task-complete', taskId, subject: taskSubject }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
  process.exit(0);
});
