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

module.exports = {
  atomicWrite,
  safeJsonParse,
  safeReadJson,
  readStdin,
  logBlock,
  checkStale,
  truncateInjection,
  ROOT,
  AUDIT_LOG,
};
