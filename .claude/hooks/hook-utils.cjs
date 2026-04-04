#!/usr/bin/env node
/**
 * Shared utilities for enforcement hooks.
 * Solves: P3 (non-atomic writes), P4 (JSON.parse without try-catch),
 * P5 (setTimeout hanging), P8 (shell profile pollution).
 *
 * Usage: const { atomicWrite, safeJsonParse, readStdin, logBlock } = require('./hook-utils.cjs');
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

/**
 * P3 FIX: Atomic file write — write to .tmp then rename.
 * On Windows, rename can fail with EPERM if target is locked.
 * Fallback: direct write (non-atomic but won't crash).
 */
function atomicWrite(filePath, data) {
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const tmpPath = filePath + '.tmp.' + process.pid;
  try {
    fs.writeFileSync(tmpPath, content, 'utf8');
    try {
      fs.renameSync(tmpPath, filePath);
    } catch {
      // Windows EPERM fallback — direct write
      fs.writeFileSync(filePath, content, 'utf8');
      try { fs.unlinkSync(tmpPath); } catch {}
    }
  } catch (err) {
    // Last resort — direct write
    try { fs.writeFileSync(filePath, content, 'utf8'); } catch {}
  }
}

/**
 * P4 FIX: Safe JSON parse — never throws, returns default on failure.
 */
function safeJsonParse(str, defaultVal) {
  try {
    return JSON.parse(str);
  } catch {
    return defaultVal !== undefined ? defaultVal : {};
  }
}

/**
 * P4 FIX: Safe file read + parse — never throws.
 */
function safeReadJson(filePath, defaultVal) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return defaultVal !== undefined ? defaultVal : {};
  }
}

/**
 * P5+P6 FIX: Read stdin with timeout — prevents Node.js hanging.
 * Calls callback with parsed JSON (or default) within timeoutMs.
 * Uses 'processed' flag to prevent double execution.
 */
function readStdin(callback, timeoutMs) {
  const timeout = timeoutMs || 2000;
  let raw = '';
  let processed = false;

  function finish() {
    if (processed) return;
    processed = true;
    const data = safeJsonParse(raw, {});
    callback(data);
  }

  process.stdin.on('data', d => raw += d);
  process.stdin.on('end', () => finish());
  setTimeout(() => finish(), timeout);
}

/**
 * P3 FIX: Log block event atomically.
 */
function logBlock(hook, reason) {
  const entry = JSON.stringify({ ts: Date.now(), hook, event: 'BLOCKED', reason }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
}

/**
 * P9 FIX: Check if a timestamp file is stale (older than maxAgeMs).
 * Returns { stale: boolean, ageMs: number, data: object }.
 */
function checkStale(filePath, maxAgeMs) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const age = Date.now() - (data.timestamp || 0);
    return { stale: age > maxAgeMs, ageMs: age, data };
  } catch {
    return { stale: true, ageMs: Infinity, data: {} };
  }
}

/**
 * P11 FIX: Truncate injection text to maxLen chars.
 */
function truncateInjection(text, maxLen) {
  const limit = maxLen || 1500;
  if (text.length <= limit) return text;
  return text.slice(0, limit) + '\n... (truncated to ' + limit + ' chars)';
}

/**
 * ALL 16 MANDATORY Ruflo areas (v3 — zero skips).
 * Shared across: ruflo-enforcer, anti-skip-gate, stop-tsc-gate,
 * independent-verifier, commit-gate.
 * Verified functional 2026-04-04 (v3.5.48).
 */
const ALL_16_AREAS = {
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
const ALL_16_NAMES = Object.keys(ALL_16_AREAS);
const TOTAL_AREAS = ALL_16_NAMES.length; // 16

/**
 * Count used areas from .ruflo-last-action state.
 * Returns { usedCount, missingCount, usedAreas, missingAreas }.
 */
function countRufloAreas(rufloState) {
  const areas = rufloState?.areas || {};
  const used = ALL_16_NAMES.filter(a => areas[a]?.count > 0);
  const missing = ALL_16_NAMES.filter(a => !areas[a] || areas[a].count === 0);

  // Fallback: derive from toolLog if areas field empty (backward compat)
  if (used.length === 0 && Array.isArray(rufloState?.toolLog) && rufloState.toolLog.length > 0) {
    const derived = new Set();
    for (const entry of rufloState.toolLog) {
      const tool = entry.tool || '';
      for (const [area, prefixes] of Object.entries(ALL_16_AREAS)) {
        if (prefixes.some(p => tool.includes(p))) derived.add(area);
      }
    }
    const derivedArr = [...derived];
    return {
      usedCount: derivedArr.length,
      missingCount: TOTAL_AREAS - derivedArr.length,
      usedAreas: derivedArr,
      missingAreas: ALL_16_NAMES.filter(a => !derived.has(a)),
    };
  }

  return { usedCount: used.length, missingCount: missing.length, usedAreas: used, missingAreas: missing };
}

module.exports = {
  atomicWrite,
  safeJsonParse,
  safeReadJson,
  readStdin,
  logBlock,
  checkStale,
  truncateInjection,
  countRufloAreas,
  ALL_16_AREAS,
  ALL_16_NAMES,
  TOTAL_AREAS,
  ROOT,
  AUDIT_LOG,
};
