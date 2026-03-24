#!/usr/bin/env node
/**
 * TeammateIdle hook — BLOCKING quality gate for Agent Teams.
 *
 * Replaces teammate-idle-log.cjs (advisory) with enforcement:
 * 1. CHECK 1: Worktree isolation — blocks if cwd = project root (token race condition)
 * 2. CHECK 2: Verification evidence — blocks if no tsc/vitest/grep in transcript
 *
 * exit(2) = send feedback, teammate keeps working (not idle)
 * exit(0) = teammate allowed to go idle
 * FAIL-CLOSED: any crash → exit(2) (safe default)
 *
 * SDK stdin fields: teammate_name, team_name, transcript_path, cwd, session_id
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');
const HOOK_NAME = 'teammate-idle-gate';

function audit(event, detail) {
  const entry = JSON.stringify({ ts: Date.now(), hook: HOOK_NAME, event, detail: String(detail).slice(0, 200) }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
}

const norm = (p) => (p || '').replace(/\\/g, '/').toLowerCase();

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const teammateName = (data.teammate_name || 'unknown').slice(0, 40);
    const teamName = (data.team_name || 'unknown').slice(0, 40);
    const cwd = data.cwd || '';

    // Always audit (preserve from teammate-idle-log.cjs)
    audit('teammate-idle', 'teammate=' + teammateName + ' team=' + teamName + ' cwd=' + cwd.slice(-60));

    // CHECK 1: Worktree isolation — block if teammate is in main project directory
    // Multiple agents in same dir → token race condition (.preflight-token, .postflight-done, etc.)
    if (norm(cwd) === norm(ROOT)) {
      process.stderr.write(
        'WORKTREE REQUIRED: Teammate "' + teammateName + '" is in main project directory.\n' +
        'Token conflict risk (.preflight-token, .postflight-done shared between agents).\n' +
        'Ask the lead to assign you to a git worktree: "move me to a worktree"\n'
      );
      audit('BLOCKED', 'worktree-required: cwd=' + cwd);
      process.exit(2);
    }

    // CHECK 2: Verification evidence in transcript
    const transcriptPath = data.transcript_path || '';
    let hasEvidence = false;
    if (transcriptPath && fs.existsSync(transcriptPath)) {
      try {
        const stat = fs.statSync(transcriptPath);
        const readSize = Math.min(stat.size, 10000); // last 10KB
        const buf = Buffer.alloc(readSize);
        const fd = fs.openSync(transcriptPath, 'r');
        fs.readSync(fd, buf, 0, readSize, Math.max(0, stat.size - readSize));
        fs.closeSync(fd);
        const chunk = buf.toString('utf8');
        hasEvidence = /vitest|tsc|eslint|npm run|Grep|WebSearch|test.*pass|PASS|ci:preflight/i.test(chunk);
      } catch {
        // Transcript read failed — conservative: no evidence
      }
    }

    if (!hasEvidence) {
      process.stderr.write(
        'TEAMMATE QUALITY GATE: No verification evidence in transcript.\n' +
        'Run tsc + vitest or use Grep to verify your work before going idle.\n'
      );
      audit('BLOCKED', 'no-verification: teammate=' + teammateName);
      process.exit(2);
    }

    // All checks passed — teammate can go idle
    audit('allow', 'teammate=' + teammateName + ' idle with verification evidence');
    process.exit(0);

  } catch (e) {
    // FAIL-CLOSED: crash → block (safe default — teammate keeps working)
    process.stderr.write('HOOK CRASH [' + HOOK_NAME + ']: ' + (e.message || e) + ' — BLOCKING (fail-closed)\n');
    audit('CRASH', e.message || String(e));
    process.exit(2);
  }
});
