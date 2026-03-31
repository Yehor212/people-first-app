#!/usr/bin/env node
/**
 * PreCompact hook — side-effect only (additionalContext NOT supported for PreCompact).
 *
 * Logs compaction event to audit trail. The actual enforcement reminder
 * is injected by session-start.cjs (which fires after compaction with source="compact"
 * and DOES support additionalContext).
 *
 * Source: SDK docs confirm PreCompact only supports: continue, stopReason, suppressOutput, systemMessage.
 * Advisory only — never blocks.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  // Log compaction event to audit trail
  const entry = JSON.stringify({ ts: Date.now(), hook: 'pre-compact', event: 'compact', trigger: 'auto' }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}

  // Preserve goal contract and audit state across compaction
  const GOAL_CONTRACT = path.join(ROOT, '.user-goal-contract');
  const CHECKLIST = path.join(ROOT, '.audit-checklist.json');
  const AUDIT_FLAG = path.join(ROOT, '.audit-active');

  let goalReminder = '';
  if (fs.existsSync(AUDIT_FLAG)) {
    goalReminder += 'AUDIT SESSION ACTIVE. ';
    if (fs.existsSync(GOAL_CONTRACT)) {
      const goal = fs.readFileSync(GOAL_CONTRACT, 'utf8').slice(0, 500);
      goalReminder += 'Original user goal: ' + goal + ' ';
    }
    if (fs.existsSync(CHECKLIST)) {
      try {
        const cl = JSON.parse(fs.readFileSync(CHECKLIST, 'utf8'));
        const total = (cl.items || []).length;
        const done = (cl.items || []).filter(i => i.done).length;
        goalReminder += `Checklist: ${done}/${total} (${Math.round(done/total*100)}%). `;
      } catch {}
    }
    goalReminder += 'Ruflo pipeline required. Do NOT skip checklist items after compaction.';
  }

  if (goalReminder) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        systemMessage: goalReminder,
      },
    }));
  }

  process.exit(0);
});
