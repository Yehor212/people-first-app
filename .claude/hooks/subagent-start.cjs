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

  // Inject FULL enforcement context for subagent including Ruflo pipeline + checklist items
  const auditActive = fs.existsSync(path.join(ROOT, '.audit-active'));
  const CHECKLIST = path.join(ROOT, '.audit-checklist.json');
  const GOAL_FILE = path.join(ROOT, '.user-goal-contract');

  // Build checklist context — give agent its SPECIFIC assigned items
  let checklistContext = '';
  if (auditActive && fs.existsSync(CHECKLIST)) {
    try {
      const cl = JSON.parse(fs.readFileSync(CHECKLIST, 'utf8'));
      const pending = (cl.items || []).filter(i => !i.done);
      const done = (cl.items || []).filter(i => i.done).length;
      const total = (cl.items || []).length;
      checklistContext = ` AUDIT CHECKLIST (${done}/${total} done). Your PENDING items: ` +
        pending.slice(0, 10).map(i => `[${i.id}] ${(i.description || '').slice(0, 50)}`).join('; ') +
        (pending.length > 10 ? ` ... +${pending.length - 10} more` : '') +
        '. Mark items done by updating .audit-checklist.json after completing each.';
    } catch {}
  }

  // Build goal context — give agent the original user prompt
  let goalContext = '';
  if (auditActive && fs.existsSync(GOAL_FILE)) {
    try {
      const goal = fs.readFileSync(GOAL_FILE, 'utf8').slice(0, 400);
      goalContext = ` ORIGINAL USER GOAL: ${goal}`;
    } catch {}
  }

  // RUFLO ALWAYS — not gated behind audit mode
  const rufloReminder =
    ' RUFLO MANDATORY: (1) mcp__ruflo__memory_search before editing — find existing patterns. (2) mcp__ruflo__memory_store after each fix — save solution. Also: mcp__ruflo__agentdb_pattern-search, mcp__ruflo__analyze_diff-risk.' +
    (auditActive ? ' AUDIT MODE: Full 6-phase pipeline: +agentdb_feedback, +aidefence_scan, +performance_profile.' : '');

  const reminder = [
    'SUBAGENT ENFORCEMENT: Hooks apply to subagents.',
    'Protected files: .env, keystore, auth.ts, CLAUDE.md, settings.json.',
    'PRE-FLIGHT required before TS edits. POST-FLIGHT before stop.',
    rufloReminder,
    checklistContext,
    goalContext,
  ].join('');

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SubagentStart',
      additionalContext: reminder,
    },
  }));

  process.exit(0);
});
