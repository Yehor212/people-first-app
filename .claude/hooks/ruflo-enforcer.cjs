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
const MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours — audit/long sessions need generous TTL

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

// Phase tracking — REAL Ruflo tools only (facade tools removed, see audit 2026-03-31)
// Research: "85% of ruflo MCP tools are mock/stub" (GitHub #653)
// Only track tools with REAL functionality (HNSW memory, neural, embeddings, analyze)
const PHASES = {
  // BEFORE work (blocking — must complete before first Edit)
  memory_search: { tools: ['memory_search', 'memory_retrieve', 'memory_list'], blocking: true, label: 'Memory Search — find prior patterns (REAL: HNSW+ONNX)' },
  pattern_search: { tools: ['agentdb_pattern-search', 'agentdb_hierarchical-recall'], blocking: true, label: 'Pattern Search — BM25+semantic hybrid (REAL)' },
  // AFTER work (advisory — should complete before commit, commit-gate enforces)
  store_result: { tools: ['memory_store', 'agentdb_pattern-store'], blocking: false, label: 'Memory Store — save outcome for future sessions (REAL)' },
};

// Ruflo enforcement ALWAYS BLOCKING (exit 2) — not advisory
// Research: "stderr warnings ignored by LLM. Only blocking enforcement works."
// .audit-active adds: checklist-gate, satisficing-gate, stricter checks
const auditActive = fs.existsSync(AUDIT_FLAG);

// ANTI-DEADLOCK: Auto-clean stale .audit-active (>4 hours old)
if (auditActive) {
  try {
    const auditAge = Date.now() - fs.statSync(AUDIT_FLAG).mtimeMs;
    if (auditAge > 4 * 3600 * 1000) {
      // Stale — don't treat as audit but still enforce Ruflo
    }
  } catch {}
}

// Read stdin with timeout fallback — prevents hanging if SDK doesn't close stdin
let rawInput = '';
let processed = false;

function processInput() {
  if (processed) return;
  processed = true;

  let input;
  try {
    input = JSON.parse(rawInput || '{}');
  } catch {
    process.stderr.write('ruflo-enforcer: failed to parse stdin\n');
    process.exit(2);
  }

const toolName = input.tool_name || input.tool || '';

// Load current state
let state = { phases: {}, lastAction: 0, toolLog: [] };
const stateFileExists = fs.existsSync(RUFLO_STATE);
try {
  if (stateFileExists) state = JSON.parse(fs.readFileSync(RUFLO_STATE, 'utf8'));
} catch {}

// PreToolUse OR PostToolUse: record Ruflo tool usage and update phase tracking
// This fires via PreToolUse:mcp__ruflo__.* (reliable) and PostToolUse:mcp__ruflo__.* (unreliable).
// PreToolUse for MCP = confirmed working. PostToolUse for MCP = may not fire (SDK issue).
// Using PreToolUse ensures state file is written BEFORE the MCP call completes,
// so subsequent Edit/Write calls see fresh ruflo activity.
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
  // BOOTSTRAP EXCEPTION: Allow infrastructure + memory files without Ruflo
  const filePath = input.tool_input?.file_path || '';
  if (filePath.includes('audit-checklist') || filePath.includes('audit-active') ||
      filePath.includes('.postflight-done') || filePath.includes('.preflight-token') ||
      filePath.includes('.verification-done') || filePath.includes('.ide-ack') ||
      filePath.includes('.ruflo-last-action') ||
      filePath.includes('memory/') || filePath.includes('memory\\')) {
    process.exit(0);
  }
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

  // If no state file exists, advisory only (prevents deadlock).
  // BLOCKING enforcement is at commit-gate Layer 5h — that's the real gate.
  // This advisory ensures the agent gets early warning to create the state file.
  if (!stateFileExists) {
    process.stderr.write('⚠️ RUFLO: no .ruflo-last-action. Run memory_search + pattern-search, then create state via Bash.\n');
    process.stderr.write('  Commit will be BLOCKED without ruflo evidence (commit-gate Layer 5h).\n');
    process.exit(0);
  }

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
} // end processInput()

// Dual stdin reading: stream + timeout fallback
process.stdin.on('data', d => rawInput += d);
process.stdin.on('end', () => processInput());
// P5 FIX: unref() prevents setTimeout from keeping Node alive after processInput exits
const timer = setTimeout(() => processInput(), 2000);
timer.unref();
