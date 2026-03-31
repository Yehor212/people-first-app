#!/usr/bin/env node
/**
 * CHECKLIST GATE (PreToolUse:Edit|Write)
 *
 * During audit sessions (.audit-active exists), blocks edits unless
 * .audit-checklist.json exists with tracked items. Prevents the agent
 * from making ad-hoc fixes without explicit checklist tracking.
 *
 * Mechanism: exit(2) = BLOCK if no checklist during active audit.
 * Reports checklist progress in stderr on every edit.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const AUDIT_FLAG = path.join(process.cwd(), '.audit-active');
const CHECKLIST = path.join(process.cwd(), '.audit-checklist.json');

// Only enforce during audit sessions
if (!fs.existsSync(AUDIT_FLAG)) {
  process.exit(0);
}

// ANTI-DEADLOCK: Auto-clean stale .audit-active (>4 hours old)
try {
  const auditAge = Date.now() - fs.statSync(AUDIT_FLAG).mtimeMs;
  if (auditAge > 4 * 3600 * 1000) {
    fs.unlinkSync(AUDIT_FLAG);
    process.stderr.write('🧹 Stale .audit-active removed (>4h old). Audit enforcement disabled.\n');
    process.exit(0);
  }
} catch {}

// Shared: log blocks for pattern analysis
function logBlock(hook, reason) {
  const AUDIT_LOG = path.join(process.cwd(), '.claude-audit.log');
  const entry = JSON.stringify({ ts: Date.now(), hook, event: 'BLOCKED', reason }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
}

// BOOTSTRAP EXCEPTION: Allow creating .audit-checklist.json itself
// and allow deleting .audit-active (cleanup). Without this = DEADLOCK.
let input;
try {
  let raw = '';
  // Sync stdin read attempt (may not work on all platforms)
  try { raw = require('fs').readFileSync(0, 'utf8'); } catch {
    // If sync read fails, allow through (non-blocking for bootstrap)
    if (!fs.existsSync(CHECKLIST)) {
      process.stderr.write(
        '📋 CHECKLIST REQUIRED: Write .audit-checklist.json before other edits.\n' +
        '   Allowing this operation for bootstrap.\n'
      );
      process.exit(0);
    }
  }
  input = JSON.parse(raw);
} catch {
  // Can't parse stdin — allow for bootstrap
  if (!fs.existsSync(CHECKLIST)) {
    process.stderr.write('📋 CHECKLIST REQUIRED: Write .audit-checklist.json before other edits.\n');
    process.exit(0);
  }
}

// Check if this operation is creating the checklist itself
if (input) {
  const filePath = input.tool_input?.file_path || '';
  const command = input.tool_input?.command || '';
  const isChecklistWrite = filePath.includes('audit-checklist');
  const isAuditCleanup = command.includes('audit-active') || command.includes('audit-checklist');
  if (isChecklistWrite || isAuditCleanup) {
    process.stderr.write('📋 Bootstrap: allowing checklist creation / audit cleanup.\n');
    process.exit(0);
  }
}

if (!fs.existsSync(CHECKLIST)) {
  const reason = 'No .audit-checklist.json during active audit';
  logBlock('checklist-gate', reason);
  process.stderr.write(
    'CHECKLIST GATE BLOCKED!\n' +
    'Audit session active but no .audit-checklist.json found.\n' +
    'Create a checklist before making edits:\n' +
    '  Write .audit-checklist.json with { "items": [{ "id": "...", "description": "...", "done": false }] }\n'
  );
  process.exit(2);
}

try {
  const checklist = JSON.parse(fs.readFileSync(CHECKLIST, 'utf8'));
  const items = checklist.items || [];
  const total = items.length;
  const done = items.filter(i => i.done).length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;

  // ANTI-GAMING: Minimum item count (prevent trivial 3-item checklists)
  const MIN_ITEMS = 10;
  if (total < MIN_ITEMS) {
    logBlock('checklist-gate', `Checklist too small: ${total} items (need ≥${MIN_ITEMS})`);
    process.stderr.write(
      `CHECKLIST GATE BLOCKED: Only ${total} items (need ≥${MIN_ITEMS}).\n` +
      `A real audit checklist should have 10+ items from the user prompt.\n` +
      `Add more items from the original request before editing.\n`
    );
    process.exit(2);
  }

  // ANTI-GAMING: Items must have descriptions (prevent empty placeholders)
  const emptyItems = items.filter(i => !i.description || i.description.length < 10);
  if (emptyItems.length > total * 0.3) {
    logBlock('checklist-gate', `${emptyItems.length}/${total} items have empty/short descriptions`);
    process.stderr.write(
      `CHECKLIST GATE BLOCKED: ${emptyItems.length}/${total} items have no description (<10 chars).\n` +
      `Each item must describe a specific check from the user's original request.\n`
    );
    process.exit(2);
  }

  process.stderr.write(`📋 Audit checklist: ${done}/${total} (${pct}%)\n`);
} catch (err) {
  process.stderr.write(`checklist-gate: parse error: ${err.message}\n`);
}

process.exit(0);
