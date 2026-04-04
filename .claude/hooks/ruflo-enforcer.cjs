#!/usr/bin/env node
/**
 * RUFLO FULL ARSENAL ENFORCER (v3 — ALL 16 areas, ZERO skips)
 *
 * ALL 16 areas are MANDATORY. No REAL/FACADE distinction.
 * Every area was verified functional on 2026-04-04 (v3.5.48).
 *
 * 16 enforceable MCP areas (sparc-methodology has no MCP tools,
 * replaced by guidance which is cross-cutting):
 *
 *   1. agent-management     2. swarm-orchestration  3. memory-knowledge
 *   4. intelligence-learning 5. hooks-automation     6. hive-mind
 *   7. security              8. performance          9. github-integration
 *  10. session-workflow     11. embeddings-vectors  12. wasm-agents
 *  13. ruvllm-inference     14. code-analysis       15. config-system
 *  16. guidance
 *
 * Tracking: PreToolUse:mcp__ruflo__.* records area + tool.
 * Enforcement:
 *   - Edit gate: min 3 areas (allows incremental work)
 *   - Stop gates: ALL 16 areas (blocks session completion)
 *   - Commit gate: ALL 16 areas (blocks commits)
 *
 * Research:
 *   "CLAUDE.md instructions = 70-85% compliance" (IFEval)
 *   "Only mechanical enforcement = 95-99%+" (NASA IV&V)
 *   METR 2025: "Models know they are cheating" — must enforce ALL
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RUFLO_STATE = path.join(process.cwd(), '.ruflo-last-action');
const MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

// ─── ALL 16 MANDATORY AREAS (verified 2026-04-04, v3.5.48) ───
// No REAL/FACADE — ALL count, ALL required. Zero skips.
const ALL_AREAS = {
  'memory-knowledge':       ['ruflo__memory_', 'ruflo__agentdb_'],
  'intelligence-learning':  ['ruflo__neural_', 'ruflo__daa_'],
  'guidance':               ['ruflo__guidance_'],
  'code-analysis':          ['ruflo__analyze_'],
  'security':               ['ruflo__aidefence_', 'ruflo__claims_'],
  'performance':            ['ruflo__performance_'],
  'embeddings-vectors':     ['ruflo__embeddings_'],
  'config-system':          ['ruflo__config_'],
  'hooks-automation':       ['ruflo__hooks_'],
  'session-workflow':       ['ruflo__session_', 'ruflo__workflow_'],
  'agent-management':       ['ruflo__agent_'],
  'swarm-orchestration':    ['ruflo__swarm_'],
  'hive-mind':              ['ruflo__hive-mind_'],
  'wasm-agents':            ['ruflo__wasm_'],
  'ruvllm-inference':       ['ruflo__ruvllm_'],
  'github-integration':     ['ruflo__github_'],
};
const TOTAL_AREAS = Object.keys(ALL_AREAS).length; // 16

// All known Ruflo prefixes (for tracking any Ruflo tool call)
const ALL_PREFIXES = [
  ...Object.values(ALL_AREAS).flat(),
  'ruflo__transfer_', 'ruflo__coordination_',
  'ruflo__browser_', 'ruflo__terminal_',
  'ruflo__progress_', 'ruflo__system_', 'ruflo__mcp_',
  'ruflo__autopilot_',
];

// Phase tracking — core pipeline phases (backward compatible)
const PHASES = {
  memory_search:  { tools: ['memory_search', 'memory_retrieve', 'memory_list'], blocking: true, label: 'Memory Search (HNSW+ONNX)' },
  pattern_search: { tools: ['agentdb_pattern-search', 'agentdb_hierarchical-recall'], blocking: true, label: 'Pattern Search (BM25+semantic)' },
  store_result:   { tools: ['memory_store', 'agentdb_pattern-store'], blocking: false, label: 'Memory Store (save outcome)' },
};

// ─── HELPERS ───
function classifyTool(toolName) {
  for (const [area, prefixes] of Object.entries(ALL_AREAS)) {
    if (prefixes.some(p => toolName.includes(p))) return { area };
  }
  return { area: 'unknown' };
}

function countAreas(state) {
  const areas = state.areas || {};
  const used = Object.keys(ALL_AREAS).filter(a => areas[a]?.count > 0);
  const missing = Object.keys(ALL_AREAS).filter(a => !areas[a] || areas[a].count === 0);
  return { usedCount: used.length, total: TOTAL_AREAS, usedAreas: used, missingAreas: missing };
}

// ─── MAIN ───
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
  let state = { phases: {}, areas: {}, lastAction: 0, toolLog: [], facadeWarnings: [] };
  try {
    if (fs.existsSync(RUFLO_STATE)) {
      const loaded = JSON.parse(fs.readFileSync(RUFLO_STATE, 'utf8'));
      state = { ...state, ...loaded };
      // Ensure areas object exists (backward compat)
      if (!state.areas) state.areas = {};
      if (!state.facadeWarnings) state.facadeWarnings = [];
    }
  } catch {}

  // ─── TRACK: Record Ruflo tool usage with area classification ───
  const isRufloTool = ALL_PREFIXES.some(prefix => toolName.includes(prefix));
  if (isRufloTool) {
    state.lastAction = Date.now();
    state.toolLog = (state.toolLog || []).slice(-50);
    state.toolLog.push({ tool: toolName, time: Date.now() });

    // Classify and record area
    const { area } = classifyTool(toolName);
    if (!state.areas[area]) {
      state.areas[area] = { count: 0, firstUsed: Date.now(), tools: [] };
    }
    state.areas[area].count++;
    state.areas[area].lastUsed = Date.now();
    const areaTools = state.areas[area].tools || [];
    if (!areaTools.includes(toolName)) {
      areaTools.push(toolName);
      state.areas[area].tools = areaTools.slice(-10);
    }

    // Check which phase this satisfies
    for (const [phaseId, phase] of Object.entries(PHASES)) {
      if (phase.tools.some(t => toolName.includes(t))) {
        state.phases[phaseId] = { done: true, tool: toolName, time: Date.now() };
      }
    }

    fs.writeFileSync(RUFLO_STATE, JSON.stringify(state, null, 2));

    // Show ALL-16 area progress
    const { usedCount, missingAreas } = countAreas(state);
    const donePhases = Object.values(state.phases).filter(p => p.done).length;

    process.stderr.write(
      `\n📦 Ruflo: ${donePhases}/${Object.keys(PHASES).length} phases | ` +
      `${usedCount}/${TOTAL_AREAS} areas | Tool: ${toolName}\n`
    );
    if (missingAreas.length > 0 && missingAreas.length <= 8) {
      process.stderr.write(`   Missing: [${missingAreas.join(', ')}]\n`);
    }
    process.exit(0);
  }

  // ─── ENFORCE: PreToolUse:Edit|Write — check pipeline before edits ───
  if (toolName === 'Edit' || toolName === 'Write') {
    // BOOTSTRAP EXCEPTION: Allow infrastructure + memory files without Ruflo
    const filePath = input.tool_input?.file_path || '';
    if (filePath.includes('audit-checklist') || filePath.includes('audit-active') ||
        filePath.includes('.postflight-done') || filePath.includes('.preflight-token') ||
        filePath.includes('.verification-done') || filePath.includes('.ide-ack') ||
        filePath.includes('.ruflo-last-action') || filePath.includes('.evolve-done') ||
        filePath.includes('.ruflo-') || filePath.includes('.ci-evidence') ||
        filePath.includes('.evidence-chain') || filePath.includes('.user-goal') ||
        filePath.includes('.user-requirements') ||
        filePath.includes('memory/') || filePath.includes('memory\\')) {
      process.exit(0);
    }

    const stateFileExists = fs.existsSync(RUFLO_STATE);

    // BLOCKING when no state file (user: "ТОЛЬКО БЛОКІНГ")
    if (!stateFileExists) {
      process.stderr.write(
        '\n❌ RUFLO ENFORCER BLOCKED!\n' +
        '  No .ruflo-last-action found. Run Ruflo tools BEFORE editing:\n' +
        '  1. mcp__ruflo__guidance_workflow\n' +
        '  2. mcp__ruflo__memory_search\n' +
        '  3. mcp__ruflo__agentdb_pattern-search\n\n'
      );
      process.exit(2);
    }

    // Check blocking phases
    const missingBlocking = [];
    for (const [phaseId, phase] of Object.entries(PHASES)) {
      if (phase.blocking && !state.phases[phaseId]?.done) {
        missingBlocking.push({ id: phaseId, ...phase });
      }
    }

    // Check freshness
    const age = Date.now() - (state.lastAction || 0);
    const stale = age > MAX_AGE_MS;

    if (missingBlocking.length > 0 || stale) {
      process.stderr.write('\n❌ RUFLO ENFORCER BLOCKED!\n\n');

      if (missingBlocking.length > 0) {
        process.stderr.write('Missing REQUIRED phases:\n');
        missingBlocking.forEach(p => {
          process.stderr.write(`  ❌ ${p.label}\n`);
          process.stderr.write(`     → Run: mcp__ruflo__${p.tools[0]}\n`);
        });
      }

      if (stale) {
        process.stderr.write(`\n  ⏰ Last action: ${Math.round(age / 60000)}min ago (max: ${MAX_AGE_MS / 60000}min)\n`);
      }

      // Show area coverage status
      const { usedCount, usedAreas, missingAreas } = countAreas(state);
      process.stderr.write(`\n📊 Area coverage: ${usedCount}/${TOTAL_AREAS} areas\n`);
      if (usedAreas.length > 0) {
        process.stderr.write(`   Used: [${usedAreas.join(', ')}]\n`);
      }
      process.stderr.write(`   Missing: [${missingAreas.slice(0, 5).join(', ')}${missingAreas.length > 5 ? '...' : ''}]\n\n`);

      process.exit(2);
    }

    // BLOCKING area coverage on Edit/Write — min 3 to start work
    const { usedCount, missingAreas } = countAreas(state);
    const donePhases = Object.values(state.phases).filter(p => p.done).length;
    const MIN_AREAS_EDIT = 3;

    if (usedCount < MIN_AREAS_EDIT) {
      process.stderr.write(
        `\n❌ RUFLO AREA COVERAGE BLOCKED!\n` +
        `  ${usedCount}/${TOTAL_AREAS} areas (need ≥${MIN_AREAS_EDIT} to edit, ALL 16 to stop/commit)\n` +
        `  Missing: [${missingAreas.slice(0, 5).join(', ')}]\n` +
        `  Run: mcp__ruflo__guidance_workflow, mcp__ruflo__agent_list, mcp__ruflo__neural_status\n\n`
      );
      process.exit(2);
    } else {
      process.stderr.write(
        `📦 Ruflo: ${donePhases}/${Object.keys(PHASES).length} phases | ` +
        `${usedCount}/${TOTAL_AREAS} areas` +
        (usedCount >= TOTAL_AREAS ? ' ✅ ALL' : ` (${TOTAL_AREAS - usedCount} remaining)`) + '\n'
      );
    }
  }

  process.exit(0);
}

// Dual stdin reading: stream + timeout fallback
process.stdin.on('data', d => rawInput += d);
process.stdin.on('end', () => processInput());
const timer = setTimeout(() => processInput(), 2000);
timer.unref();
