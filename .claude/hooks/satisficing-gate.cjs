#!/usr/bin/env node
/**
 * SATISFICING DETECTOR (Stop hook)
 * Hook input: not required; validates .audit-checklist.json during audit sessions.
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

  // ANTI-GAMING: Verify checklist items have EVIDENCE (git diff, not just "done: true")
  const { execSync } = require('child_process');
  let changedFiles = [];
  try {
    changedFiles = execSync('git diff --name-only', { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 })
      .trim().split('\n').filter(Boolean);
  } catch {}

  const doneItems = items.filter(i => i.done);
  const noEvidence = doneItems.filter(i => {
    // Check if item has file evidence (items should reference files they changed)
    const itemFiles = i.files || [];
    if (itemFiles.length === 0) return true; // No files listed = no evidence
    // Verify at least one listed file is actually in git diff
    return !itemFiles.some(f => changedFiles.some(cf => cf.includes(f)));
  });

  if (noEvidence.length > 0 && noEvidence.length > doneItems.length * 0.3) {
    process.stderr.write(
      `\n⚠️ ANTI-GAMING WARNING: ${noEvidence.length}/${doneItems.length} "done" items have NO file evidence in git diff.\n` +
      `Items marked done should have "files": ["path"] matching actual changed files.\n` +
      `This prevents gaming by marking items done without actual changes.\n\n`
    );
  }

  // ANTI-GAMING: Check minimum items (prevent trivial 3-item checklist)
  const MIN_ITEMS = 10;
  if (total < MIN_ITEMS) {
    process.stderr.write(
      `\n⚠️ CHECKLIST TOO SMALL: ${total} items (minimum ${MIN_ITEMS} for audit).\n` +
      `A real audit should have 10+ items covering multiple categories.\n` +
      `This prevents gaming by creating trivially small checklists.\n\n`
    );
    process.exit(2);
  }

  process.stderr.write(
    `✅ Satisficing check passed: ${done}/${total} = ${pct}% (≥${BLOCK_THRESHOLD}%) | Time: ${elapsedMin}min | Evidence: ${doneItems.length - noEvidence.length}/${doneItems.length} verified\n`
  );
} catch (err) {
  process.stderr.write(`satisficing-gate: ${err.message}\n`);
}

process.exit(0);
