#!/usr/bin/env node
/**
 * FAST TSC GATE (Stop hook — command type)
 *
 * Runs in PARALLEL with the agent verifier. Catches TypeScript errors
 * in <30s even if the agent hook times out on vitest.
 *
 * This is a BACKUP gate — if the agent verifier times out (180s),
 * this fast command hook still blocks on tsc errors.
 *
 * Also blocks if .audit-active exists but checklist <80%.
 * These are the fastest checks that must NEVER be skipped.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');
const LAST_VERIFY = path.join(ROOT, '.last-verification');

// EVIDENCE IMMEDIATELY — before stdin, before anything. Proves hook launched.
try {
  fs.writeFileSync(LAST_VERIFY, JSON.stringify({
    timestamp: new Date().toISOString(),
    hook: 'stop-tsc-gate',
    status: 'LAUNCHED',
  }, null, 2), 'utf8');
} catch {}

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // Anti-loop: if already in forced continuation, allow
    if (data.stop_hook_active) {
      writeEvidence('ALLOW-RERUN', 'stop_hook_active=true');
      process.exit(0);
    }
  } catch {}

  // Helper: write evidence on both BLOCK and ALLOW
  function writeEvidence(status, reason) {
    try {
      fs.writeFileSync(LAST_VERIFY, JSON.stringify({
        timestamp: new Date().toISOString(),
        hook: 'stop-tsc-gate',
        status,
        reason: reason || '',
      }, null, 2), 'utf8');
    } catch {}
  }

  // EVIDENCE FIRST: Write proof that this hook STARTED (even if it blocks later)
  try {
    fs.writeFileSync(LAST_VERIFY, JSON.stringify({
      timestamp: new Date().toISOString(),
      hook: 'stop-tsc-gate',
      status: 'RUNNING',
      result: 'in-progress',
    }, null, 2), 'utf8');
  } catch {}

  // Check 1: Are there TS/TSX changes?
  let tsChanged = false;
  try {
    const diff = execSync('git diff --name-only', { cwd: ROOT, encoding: 'utf8', timeout: 10000 });
    tsChanged = diff.includes('.ts') || diff.includes('.tsx');
  } catch {}

  // Check 2: tsc (fast — 30s)
  if (tsChanged) {
    try {
      execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    } catch (err) {
      const output = (err.stderr || err.stdout || '').toString().slice(0, 500);
      const entry = JSON.stringify({ ts: Date.now(), hook: 'stop-tsc-gate', event: 'BLOCKED', reason: 'tsc failed' }) + '\n';
      try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}

      writeEvidence('BLOCKED', 'tsc failed');
      process.stderr.write(
        '\n❌ FAST TSC GATE BLOCKED!\n' +
        'TypeScript compilation failed. Fix errors before stopping.\n' +
        output + '\n'
      );
      process.exit(2);
    }
  }

  // Check 3: Audit checklist (fast — <1s)
  const AUDIT_FLAG = path.join(ROOT, '.audit-active');
  const CHECKLIST = path.join(ROOT, '.audit-checklist.json');
  if (fs.existsSync(AUDIT_FLAG) && fs.existsSync(CHECKLIST)) {
    try {
      const cl = JSON.parse(fs.readFileSync(CHECKLIST, 'utf8'));
      const items = cl.items || [];
      const total = items.length;
      const done = items.filter(i => i.done).length;
      const pct = total > 0 ? Math.round(done / total * 100) : 0;
      if (total >= 10 && pct < 80) {
        writeEvidence('BLOCKED', `checklist ${done}/${total} = ${pct}%`);
        process.stderr.write(
          `\n❌ FAST CHECKLIST GATE: ${done}/${total} = ${pct}% (need ≥80%)\n`
        );
        process.exit(2);
      }
    } catch {}
  }

  // Check 4: Ruflo usage (fast — <1s)
  const RUFLO_STAMP = path.join(ROOT, '.ruflo-last-action');
  if (fs.existsSync(AUDIT_FLAG)) {
    if (!fs.existsSync(RUFLO_STAMP)) {
      writeEvidence('BLOCKED', 'no ruflo activity');
      process.stderr.write('\n❌ FAST RUFLO GATE: No Ruflo activity during audit session.\n');
      process.exit(2);
    }
    try {
      const data = JSON.parse(fs.readFileSync(RUFLO_STAMP, 'utf8'));
      const age = Date.now() - data.timestamp;
      if (age > 60 * 60 * 1000) { // 1 hour stale
        writeEvidence('BLOCKED', 'ruflo stale >1h');
        process.stderr.write('\n❌ FAST RUFLO GATE: Ruflo last used >1 hour ago.\n');
        process.exit(2);
      }
    } catch {}
  }

  // Update verification evidence with FINAL result
  try {
    fs.writeFileSync(LAST_VERIFY, JSON.stringify({
      timestamp: new Date().toISOString(),
      hook: 'stop-tsc-gate',
      tsChanged,
      tscPassed: tsChanged ? true : 'n/a',
      auditActive: fs.existsSync(path.join(ROOT, '.audit-active')),
      checklistOk: true,
      rufloOk: true,
      result: 'ALLOW',
    }, null, 2), 'utf8');
  } catch {}

  // VISIBILITY: Always show verification result to user
  const checks = [];
  if (tsChanged) checks.push('tsc ✅');
  const auditActive = fs.existsSync(path.join(ROOT, '.audit-active'));
  if (auditActive) {
    checks.push(fs.existsSync(path.join(ROOT, '.audit-checklist.json')) ? 'checklist ✅' : 'checklist ⬜');
    checks.push(fs.existsSync(path.join(ROOT, '.ruflo-last-action')) ? 'ruflo ✅' : 'ruflo ⬜');
  }
  if (checks.length > 0) {
    process.stderr.write(`\n🛡️ VERIFIER: ${checks.join(' | ')}${auditActive ? ' | audit mode ON' : ''}\n`);
  } else {
    process.stderr.write('\n🛡️ VERIFIER: no TS changes, fast gate passed\n');
  }

  process.exit(0);
});
