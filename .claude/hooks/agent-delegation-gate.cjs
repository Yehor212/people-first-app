#!/usr/bin/env node
/**
 * AGENT DELEGATION GATE (PreToolUse:Agent)
 *
 * During audit sessions, blocks Agent spawning unless the agent prompt
 * contains specific checklist items. Prevents "launch agent and hope
 * it covers everything" anti-pattern.
 *
 * Mechanism: Parses agent prompt from stdin JSON, checks against
 * .audit-checklist.json pending items. Requires ≥3 specific items
 * referenced in the prompt, or blocks with exit(2).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const AUDIT_FLAG = path.join(process.cwd(), '.audit-active');
const CHECKLIST = path.join(process.cwd(), '.audit-checklist.json');
const MIN_ITEMS_REFERENCED = 3;

if (!fs.existsSync(AUDIT_FLAG)) {
  process.exit(0);
}

// Read stdin via stream (cross-platform: /dev/stdin doesn't exist on Windows)
let rawInput = '';
process.stdin.on('data', d => rawInput += d);
process.stdin.on('end', () => {

let input;
try {
  input = JSON.parse(rawInput);
} catch {
  process.stderr.write('agent-delegation-gate: failed to parse stdin — blocking (fail-closed)\n');
  process.exit(2);
}

// Only check Agent tool
const toolName = input.tool_name || input.tool || '';
if (!toolName.includes('Agent')) {
  process.exit(0);
}

const prompt = input.tool_input?.prompt || '';

if (!fs.existsSync(CHECKLIST)) {
  process.stderr.write(
    'AGENT DELEGATION BLOCKED: No .audit-checklist.json — create checklist before delegating.\n'
  );
  process.exit(2);
}

try {
  const checklist = JSON.parse(fs.readFileSync(CHECKLIST, 'utf8'));
  const pending = (checklist.items || []).filter(i => !i.done);

  if (pending.length < MIN_ITEMS_REFERENCED) {
    // Not enough pending items to require references
    process.exit(0);
  }

  // Check how many checklist items are referenced in agent prompt
  const referenced = pending.filter(item => {
    const desc = (item.description || '').slice(0, 40);
    const id = item.id || '';
    return prompt.includes(id) || (desc.length > 10 && prompt.includes(desc));
  });

  if (referenced.length < MIN_ITEMS_REFERENCED) {
    process.stderr.write(
      `AGENT DELEGATION BLOCKED!\n` +
      `Agent prompt references ${referenced.length}/${MIN_ITEMS_REFERENCED} required checklist items.\n` +
      `Include SPECIFIC checklist items (id or description) in agent prompt.\n` +
      `Pending items (${pending.length}):\n`
    );
    pending.slice(0, 5).forEach(item => {
      process.stderr.write(`  - [${item.id}] ${(item.description || '').slice(0, 60)}\n`);
    });
    process.exit(2);
  }

  process.stderr.write(`✅ Agent prompt references ${referenced.length} checklist items.\n`);
} catch (err) {
  process.stderr.write(`agent-delegation-gate: ${err.message}\n`);
}

// Check 2: Auto-inject Ruflo instructions if missing (tool input modification v2.0.10+)
const RUFLO_KEYWORDS = ['ruflo', 'memory_search', 'memory_store', 'pattern-search', 'agentdb'];
const hasRufloInstructions = RUFLO_KEYWORDS.some(kw => prompt.toLowerCase().includes(kw));

// Build injection payload: Ruflo + checklist items + user goal
const injections = [];

// Ruflo pipeline
if (!hasRufloInstructions) {
  injections.push(
    '\n\n## RUFLO PIPELINE (auto-injected by agent-delegation-gate)',
    'Before ANY .ts/.tsx edit:',
    '1. Run mcp__ruflo__memory_search with query describing what you are about to fix',
    '2. Run mcp__ruflo__agentdb_pattern-search for hybrid BM25+semantic search',
    '3. If similar pattern found — use it instead of reinventing',
    'After completing fix:',
    '4. Run mcp__ruflo__memory_store to save the solution pattern',
    '5. Key format: "fix-[category]-[description]", namespace: "zenflow-patterns"',
    '6. Run mcp__ruflo__agentdb_feedback with taskId and success status',
  );
}

// Checklist items for this agent
const CHECKLIST_PATH = path.join(process.cwd(), '.audit-checklist.json');
if (fs.existsSync(CHECKLIST_PATH)) {
  try {
    const cl = JSON.parse(fs.readFileSync(CHECKLIST_PATH, 'utf8'));
    const pending = (cl.items || []).filter(i => !i.done);
    if (pending.length > 0) {
      injections.push(
        '\n\n## AUDIT CHECKLIST (auto-injected)',
        `${pending.length} items pending. After completing each, update .audit-checklist.json to mark done:true`,
      );
      pending.slice(0, 15).forEach(item => {
        injections.push(`- [${item.id}] ${(item.description || '').slice(0, 80)}`);
      });
    }
  } catch {}
}

// User goal contract
const GOAL_PATH = path.join(process.cwd(), '.user-goal-contract');
if (fs.existsSync(GOAL_PATH)) {
  try {
    const goal = fs.readFileSync(GOAL_PATH, 'utf8').slice(0, 400);
    if (goal.length > 50) {
      injections.push('\n\n## ORIGINAL USER GOAL (auto-injected)', goal);
    }
  } catch {}
}

if (injections.length > 0) {
  process.stderr.write(`📦 Auto-injecting into agent prompt: Ruflo${!hasRufloInstructions ? '' : '(already present)'}, checklist, goal.\n`);

  const AUDIT_LOG = path.join(process.cwd(), '.claude-audit.log');
  const entry = JSON.stringify({
    ts: Date.now(), hook: 'agent-delegation-gate', event: 'inject',
    ruflo: !hasRufloInstructions, checklist: fs.existsSync(CHECKLIST_PATH), goal: fs.existsSync(GOAL_PATH),
  }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}

  const modified = JSON.parse(JSON.stringify(input.tool_input || {}));
  modified.prompt = (modified.prompt || '') + injections.join('\n');

  // Use updatedInput (SDK standard) + permissionDecision: allow (required for input modification)
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput: modified,
    },
  }));
  process.exit(0);
}

process.exit(0);
}); // end process.stdin.on('end')
