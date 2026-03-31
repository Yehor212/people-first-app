#!/usr/bin/env node
/**
 * SATISFICING DETECTOR (Stop hook)
 *
 * During audit sessions, blocks the agent from stopping if the
 * checklist completion is below 80%. Prevents the "good enough"
 * anti-pattern where the agent fixes 30% of issues and declares victory.
 *
 * Mechanism: exit(2) = BLOCK if .audit-checklist.json completion < 80%.
 * Also warns at 60-80% range.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const AUDIT_FLAG = path.join(process.cwd(), '.audit-active');
const CHECKLIST = path.join(process.cwd(), '.audit-checklist.json');
const BLOCK_THRESHOLD = 80;
const WARN_THRESHOLD = 60;

if (!fs.existsSync(AUDIT_FLAG) || !fs.existsSync(CHECKLIST)) {
  process.exit(0);
}

// Time-on-task tracking
const auditStartMs = (() => {
  try { return fs.statSync(AUDIT_FLAG).mtimeMs; } catch { return Date.now(); }
})();
const elapsedMin = Math.round((Date.now() - auditStartMs) / 60000);

try {
  const checklist = JSON.parse(fs.readFileSync(CHECKLIST, 'utf8'));
  const items = checklist.items || [];
  const total = items.length;
  const done = items.filter(i => i.done).length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;

  if (total === 0) {
    process.stderr.write('⚠️ Audit checklist is empty — no items to track.\n');
    process.exit(0);
  }

  if (pct < WARN_THRESHOLD) {
    process.stderr.write(
      `\n❌ SATISFICING DETECTOR BLOCKED!\n` +
      `Checklist: ${done}/${total} = ${pct}% (need ≥${BLOCK_THRESHOLD}%)\n` +
      `You completed less than ${WARN_THRESHOLD}% — this looks like satisficing.\n` +
      `Remaining items:\n`
    );
    items.filter(i => !i.done).slice(0, 10).forEach(item => {
      process.stderr.write(`  ❌ [${item.id}] ${(item.description || '').slice(0, 70)}\n`);
    });
    const remaining = items.filter(i => !i.done).length;
    if (remaining > 10) {
      process.stderr.write(`  ... and ${remaining - 10} more\n`);
    }
    process.stderr.write('\nComplete remaining items before stopping.\n\n');
    process.exit(2);
  }

  if (pct < BLOCK_THRESHOLD) {
    process.stderr.write(
      `\n⚠️ SATISFICING WARNING!\n` +
      `Checklist: ${done}/${total} = ${pct}% (need ≥${BLOCK_THRESHOLD}%)\n` +
      `You're in the ${WARN_THRESHOLD}-${BLOCK_THRESHOLD}% range — almost there.\n` +
      `Remaining: ${total - done} items. Push through to ${BLOCK_THRESHOLD}%.\n\n`
    );
    process.exit(2);
  }

  process.stderr.write(
    `✅ Satisficing check passed: ${done}/${total} = ${pct}% (≥${BLOCK_THRESHOLD}%) | Time: ${elapsedMin}min\n`
  );
} catch (err) {
  process.stderr.write(`satisficing-gate: ${err.message}\n`);
}

process.exit(0);
