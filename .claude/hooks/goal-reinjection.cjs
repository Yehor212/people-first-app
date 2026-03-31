#!/usr/bin/env node
/**
 * GOAL RE-INJECTION HOOK (PostToolUse)
 *
 * Prevents instruction decay by reminding Claude of the original user goal
 * every N tool calls. Research shows original instructions get buried under
 * tool outputs by step 10, causing task drift.
 *
 * Mechanism: Counts tool calls via .tool-call-counter file.
 * Every 10 calls, outputs goal from .user-goal-contract to stderr.
 * Claude sees this as hook feedback and re-anchors to the goal.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const COUNTER_FILE = path.join(process.cwd(), '.tool-call-counter');
const GOAL_FILE = path.join(process.cwd(), '.user-goal-contract');
const AUDIT_FLAG = path.join(process.cwd(), '.audit-active');
// During audit: reinject every 5 steps (research: decay starts at step 10, catch it at 5)
// Normal: every 10 steps
const REINJECTION_INTERVAL = fs.existsSync(AUDIT_FLAG) ? 5 : 10;

try {
  // Increment counter
  let count = 0;
  try { count = parseInt(fs.readFileSync(COUNTER_FILE, 'utf8')) || 0; } catch {}
  count++;
  fs.writeFileSync(COUNTER_FILE, String(count));

  // Every N calls — re-inject goal
  if (count % REINJECTION_INTERVAL === 0 && fs.existsSync(GOAL_FILE)) {
    const goal = fs.readFileSync(GOAL_FILE, 'utf8').trim();
    if (goal) {
      const preview = goal.length > 600 ? goal.slice(0, 600) + '...' : goal;
      process.stderr.write(
        `\n⚡ GOAL RE-INJECTION (step ${count}):\n` +
        `Your original task contract:\n${preview}\n` +
        `Are you still on track? Check your checklist progress.\n\n`
      );
    }
  }
} catch (err) {
  // Non-blocking — never fail the tool call
  process.stderr.write(`goal-reinjection: ${err.message}\n`);
}
process.exit(0);
