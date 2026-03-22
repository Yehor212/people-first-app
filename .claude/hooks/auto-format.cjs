#!/usr/bin/env node
/**
 * PostToolUse hook for Edit|Write — Auto-format with Prettier.
 *
 * Runs prettier --write on edited files with supported extensions.
 * Uses stdin JSON (tool_input.file_path), NOT env vars.
 *
 * Circuit breaker: after 3 consecutive failures within 5 minutes,
 * skips formatting for the rest of the window (Netflix Hystrix pattern).
 * Resets on success.
 *
 * Note: CLAUDE_FILE_PATH env var does NOT exist in Claude Code SDK.
 */
const fs = require('fs');
const path = require('path');

const SUPPORTED = /\.(ts|tsx|js|jsx|css|json|md)$/;
const CB_FILE = path.join(process.cwd(), '.prettier-circuit-breaker');
const CB_THRESHOLD = 3;
const CB_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function readCircuitBreaker() {
  try {
    const data = JSON.parse(fs.readFileSync(CB_FILE, 'utf8'));
    // Reset if window expired
    if (Date.now() - data.lastFailure > CB_WINDOW_MS) return { failures: 0, lastFailure: 0 };
    return data;
  } catch { return { failures: 0, lastFailure: 0 }; }
}

function writeCircuitBreaker(data) {
  try { fs.writeFileSync(CB_FILE, JSON.stringify(data)); } catch {}
}

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = data.tool_input?.file_path || '';

    if (!filePath || !filePath.match(SUPPORTED)) {
      process.exit(0);
    }

    // Circuit breaker check
    const cb = readCircuitBreaker();
    if (cb.failures >= CB_THRESHOLD) {
      process.stderr.write('HOOK SKIP [auto-format]: circuit breaker OPEN (' + cb.failures + ' failures). Resets in ' + Math.round((CB_WINDOW_MS - (Date.now() - cb.lastFailure)) / 1000) + 's\n');
      process.exit(0);
    }

    const { execSync } = require('child_process');
    execSync('npx prettier --write "' + filePath.replace(/"/g, '\\"') + '"', {
      cwd: process.cwd(),
      stdio: 'pipe',
      timeout: 10000,
    });

    // Success — reset circuit breaker
    if (cb.failures > 0) writeCircuitBreaker({ failures: 0, lastFailure: 0 });
    console.log('Formatted: ' + filePath);
  } catch (e) {
    // Record failure for circuit breaker
    const cb = readCircuitBreaker();
    writeCircuitBreaker({ failures: cb.failures + 1, lastFailure: Date.now() });
    process.stderr.write('HOOK WARNING [auto-format]: ' + (e.message || e).slice(0, 200) + '\n');
  }
  process.exit(0);
});
