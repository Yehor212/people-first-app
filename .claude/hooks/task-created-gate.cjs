#!/usr/bin/env node
/**
 * TaskCreated hook — log task creation for audit trail.
 *
 * Fires when a task is created via TaskCreate tool (agent teams).
 * Logs task details. During audit mode, checks that task references
 * checklist items.
 * Advisory — does not block task creation.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');
const AUDIT_FLAG = path.join(ROOT, '.audit-active');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let taskId = 'unknown';
  let taskSubject = '';
  let teammateName = '';
  try {
    const data = JSON.parse(input);
    taskId = data.task_id || 'unknown';
    taskSubject = data.task_subject || data.task_description || '';
    teammateName = data.teammate_name || '';
  } catch {}

  // Log task creation
  const entry = JSON.stringify({
    ts: Date.now(),
    hook: 'task-created-gate',
    event: 'task-create',
    taskId,
    subject: taskSubject.slice(0, 80),
    teammate: teammateName,
  }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}

  // During audit: remind to track against checklist
  if (fs.existsSync(AUDIT_FLAG)) {
    process.stderr.write(
      `📋 Task created: [${taskId}] ${taskSubject.slice(0, 60)}\n` +
      `   Ensure this task maps to a specific .audit-checklist.json item.\n`
    );
  }

  process.exit(0);
});
