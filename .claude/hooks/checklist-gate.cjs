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

// Shared: log blocks for pattern analysis
function logBlock(hook, reason) {
  const AUDIT_LOG = path.join(process.cwd(), '.claude-audit.log');
  const entry = JSON.stringify({ ts: Date.now(), hook, event: 'BLOCKED', reason }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
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
