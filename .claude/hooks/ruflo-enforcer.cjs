#!/usr/bin/env node
/**
 * RUFLO FULL ARSENAL ENFORCER
 *
 * During audit sessions, enforces the complete Ruflo 6-phase pipeline:
 *
 * PHASE 1 (Session Start): agentdb_session-start → episodic replay
 * PHASE 2 (Before Edit):   memory_search → find existing patterns
 * PHASE 3 (Before Edit):   agentdb_pattern-search → hybrid BM25+semantic
 * PHASE 4 (After Fix):     memory_store → save solution pattern
 * PHASE 5 (After Fix):     agentdb_feedback → record task outcome
 * PHASE 6 (Session End):   agentdb_session-end → consolidation
 *
 * Tracks which phases were completed. Blocks edits if Phase 2 or 3
 * not done within 30 minutes. Advisory warnings for other phases.
 *
 * Full arsenal: 16 areas, 100+ tools. This hook enforces the pipeline
 * so the agent cannot skip Ruflo even if "simpler tools are enough."
 */
'use strict';

const fs = require('fs');
const path = require('path');

const AUDIT_FLAG = path.join(process.cwd(), '.audit-active');
const RUFLO_STATE = path.join(process.cwd(), '.ruflo-last-action');
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

// All Ruflo tool prefixes that count as pipeline activity
const RUFLO_TOOLS = [
  'ruflo__memory',       // memory_search, memory_store, memory_list, etc.
  'ruflo__agentdb',      // pattern-search, pattern-store, session-start, feedback, etc.
  'ruflo__neural',       // train, predict, optimize, patterns
  'ruflo__performance',  // benchmark, profile, metrics, bottleneck
  'ruflo__analyze',      // diff, diff-risk, diff-classify, file-risk
  'ruflo__aidefence',    // scan, analyze, has_pii, is_safe
  'ruflo__hooks',        // intelligence, pattern-store, trajectory
  'ruflo__autopilot',    // status, predict, learn, progress
  'ruflo__guidance',     // capabilities, discover, recommend, workflow
  'ruflo__embeddings',   // generate, search, compare
];

// Phase tracking
const PHASES = {
  session_start: { tools: ['agentdb_session-start'], blocking: false, label: 'Session Start (episodic replay)' },
  memory_search: { tools: ['memory_search', 'memory_retrieve'], blocking: true, label: 'Memory Search (existing patterns)' },
  pattern_search: { tools: ['agentdb_pattern-search', 'agentdb_hierarchical-recall', 'agentdb_context-synthesize'], blocking: true, label: 'Pattern Search (BM25+semantic)' },
  store_result: { tools: ['memory_store', 'agentdb_pattern-store', 'agentdb_hierarchical-store'], blocking: false, label: 'Store Result (save pattern)' },
  feedback: { tools: ['agentdb_feedback'], blocking: false, label: 'Feedback (record outcome)' },
  session_end: { tools: ['agentdb_session-end'], blocking: false, label: 'Session End (consolidation)' },
};

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
  // Fail-CLOSED during audit: if we can't parse input, block
  process.stderr.write('ruflo-enforcer: failed to parse stdin — blocking (fail-closed)\n');
  process.exit(2);
}

const toolName = input.tool_name || input.tool || '';

// Load current state
let state = { phases: {}, lastAction: 0, toolLog: [] };
try {
  state = JSON.parse(fs.readFileSync(RUFLO_STATE, 'utf8'));
} catch {}

// PostToolUse: record Ruflo tool usage and update phase tracking
const isRufloTool = RUFLO_TOOLS.some(prefix => toolName.includes(prefix));
if (isRufloTool) {
  state.lastAction = Date.now();
  state.toolLog = (state.toolLog || []).slice(-50); // keep last 50
  state.toolLog.push({ tool: toolName, time: Date.now() });

  // Check which phase this satisfies
  for (const [phaseId, phase] of Object.entries(PHASES)) {
    if (phase.tools.some(t => toolName.includes(t))) {
      state.phases[phaseId] = { done: true, tool: toolName, time: Date.now() };
    }
  }

  fs.writeFileSync(RUFLO_STATE, JSON.stringify(state, null, 2));

  // Show pipeline status
  const doneCount = Object.values(state.phases).filter(p => p.done).length;
  const totalPhases = Object.keys(PHASES).length;
  process.stderr.write(`📦 Ruflo pipeline: ${doneCount}/${totalPhases} phases | Tool: ${toolName}\n`);
  process.exit(0);
}

// PreToolUse:Edit — enforce blocking phases
if (toolName === 'Edit' || toolName === 'Write') {
  const missingBlocking = [];
  const missingAdvisory = [];

  for (const [phaseId, phase] of Object.entries(PHASES)) {
    const phaseDone = state.phases[phaseId]?.done;
    if (!phaseDone) {
      if (phase.blocking) {
        missingBlocking.push({ id: phaseId, ...phase });
      } else {
        missingAdvisory.push({ id: phaseId, ...phase });
      }
    }
  }

  // Check age of last action
  const age = Date.now() - (state.lastAction || 0);
  const stale = age > MAX_AGE_MS;

  if (missingBlocking.length > 0 || (stale && state.lastAction > 0)) {
    process.stderr.write('\nRUFLO FULL ARSENAL ENFORCER BLOCKED!\n\n');

    if (missingBlocking.length > 0) {
      process.stderr.write('Missing REQUIRED phases (must complete before editing):\n');
      missingBlocking.forEach(p => {
        process.stderr.write(`  ❌ ${p.label}\n`);
        process.stderr.write(`     → Run: mcp__ruflo__${p.tools[0]}\n`);
      });
    }

    if (stale) {
      const mins = Math.round(age / 60000);
      process.stderr.write(`\n  ⏰ Last Ruflo action was ${mins}min ago (limit: 30min)\n`);
      process.stderr.write('     → Run mcp__ruflo__memory_search to refresh\n');
    }

    process.stderr.write('\nFull Ruflo pipeline (6 phases):\n');
    for (const [phaseId, phase] of Object.entries(PHASES)) {
      const done = state.phases[phaseId]?.done;
      const icon = done ? '✅' : (phase.blocking ? '❌' : '⬜');
      process.stderr.write(`  ${icon} Phase ${phaseId}: ${phase.label}\n`);
    }
    process.stderr.write('\n');
    process.exit(2);
  }

  // Advisory warnings for non-blocking phases
  if (missingAdvisory.length > 0) {
    process.stderr.write(`📦 Ruflo advisory: ${missingAdvisory.length} optional phases pending:\n`);
    missingAdvisory.forEach(p => {
      process.stderr.write(`  ⬜ ${p.label}\n`);
    });
  }

  // Show pipeline summary
  const doneCount = Object.values(state.phases).filter(p => p.done).length;
  process.stderr.write(`📦 Ruflo pipeline: ${doneCount}/${Object.keys(PHASES).length} phases complete\n`);
}

process.exit(0);
}); // end process.stdin.on('end')
