#!/usr/bin/env node
/**
 * INDEPENDENT DETERMINISTIC VERIFIER (Stop hook — command type)
 *
 * Replaces the agent-type verifier to solve:
 * P1: Single-verifier paradox — this runs REAL commands, no LLM judgment
 * P2: Self-grading fallacy — tsc/vitest/grep are mathematically verifiable
 *
 * Research: "LLMs cannot self-correct without external signals" (ICLR 2024)
 * Research: "BFT requires n=3f+1" — but deterministic checks have f=0 by definition
 *
 * Runs: git diff, tsc, vitest, grep, i18n:check, checklist%, ruflo
 * Writes: .verification-done with JSON evidence (ALWAYS, even on BLOCK)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { atomicWrite, safeReadJson, readStdin, checkStale } = require('./hook-utils.cjs');

const ROOT = process.cwd();
const AUDIT_FLAG = path.join(ROOT, '.audit-active');
const CHECKLIST = path.join(ROOT, '.audit-checklist.json');
const RUFLO_STAMP = path.join(ROOT, '.ruflo-last-action');
const VERIFY_FILE = path.join(ROOT, '.verification-done');

readStdin((data) => {
  // Anti-loop
  if (data.stop_hook_active) {
    atomicWrite(VERIFY_FILE, { timestamp: new Date().toISOString(), status: 'ALLOW-RERUN', hook: 'independent-verifier' });
    process.exit(0);
  }

  const results = {
    timestamp: new Date().toISOString(),
    hook: 'independent-verifier',
    checks: {},
    blockers: [],
  };

  // 1. Git diff
  let changedFiles = [];
  try {
    changedFiles = execSync('git diff --name-only', { cwd: ROOT, encoding: 'utf8', timeout: 10000 })
      .trim().split('\n').filter(Boolean);
    results.checks.git_diff = { pass: true, files: changedFiles.length };
  } catch {
    results.checks.git_diff = { pass: true, files: 0 };
  }

  const tsChanged = changedFiles.some(f => f.endsWith('.ts') || f.endsWith('.tsx'));
  const i18nChanged = changedFiles.some(f => f.includes('src/i18n/'));

  // 2. TypeScript
  if (tsChanged) {
    try {
      execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', timeout: 90000 });
      results.checks.tsc = { pass: true };
    } catch (err) {
      const output = (err.stderr || err.stdout || '').toString().slice(0, 300);
      results.checks.tsc = { pass: false, error: output };
      results.blockers.push('tsc failed');
    }
  } else {
    results.checks.tsc = { pass: true, skipped: 'no TS changes' };
  }

  // 3. Vitest
  if (tsChanged) {
    try {
      execSync('npx vitest run', { cwd: ROOT, stdio: 'pipe', timeout: 120000 });
      results.checks.vitest = { pass: true };
    } catch (err) {
      const output = (err.stderr || err.stdout || '').toString().slice(0, 300);
      results.checks.vitest = { pass: false, error: output };
      results.blockers.push('vitest failed');
    }
  } else {
    results.checks.vitest = { pass: true, skipped: 'no TS changes' };
  }

  // 4. Silent catches
  if (tsChanged) {
    try {
      const matches = execSync("grep -rn \".catch(() =>\" src/ --include=\"*.ts\" --include=\"*.tsx\"", {
        cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 10000
      }).trim();
      if (matches) {
        results.checks.silent_catch = { pass: false, count: matches.split('\n').length };
        results.blockers.push('silent catches found');
      } else {
        results.checks.silent_catch = { pass: true };
      }
    } catch {
      results.checks.silent_catch = { pass: true }; // grep exit 1 = no matches = pass
    }
  }

  // 5. Audit checklist
  const isAudit = fs.existsSync(AUDIT_FLAG);
  if (isAudit) {
    if (fs.existsSync(CHECKLIST)) {
      const cl = safeReadJson(CHECKLIST, { items: [] });
      const items = cl.items || [];
      const total = items.length;
      const done = items.filter(i => i.done).length;
      const pct = total > 0 ? Math.round(done / total * 100) : 0;
      results.checks.checklist = { pass: pct >= 80, done, total, pct };
      if (pct < 80) results.blockers.push(`checklist ${done}/${total} = ${pct}%`);
    } else {
      results.checks.checklist = { pass: false, error: 'no checklist file' };
      results.blockers.push('audit active but no checklist');
    }

    // 6. Ruflo usage
    const rufloCheck = checkStale(RUFLO_STAMP, 60 * 60 * 1000);
    results.checks.ruflo = { pass: !rufloCheck.stale, ageMin: Math.round(rufloCheck.ageMs / 60000) };
    if (rufloCheck.stale) results.blockers.push('ruflo not used or stale');

    // 7. Gaming cross-check
    if (fs.existsSync(CHECKLIST)) {
      const cl = safeReadJson(CHECKLIST, { items: [] });
      const doneItems = (cl.items || []).filter(i => i.done && i.files && i.files.length > 0);
      const noEvidence = doneItems.filter(i => !i.files.some(f => changedFiles.some(cf => cf.includes(f))));
      results.checks.gaming = {
        pass: noEvidence.length <= doneItems.length * 0.3,
        evidenced: doneItems.length - noEvidence.length,
        total: doneItems.length,
      };
    }
  }

  // 8. SEMANTIC: Goal alignment (deterministic keyword matching, no LLM)
  const GOAL_FILE = path.join(ROOT, '.user-goal-contract');
  if (fs.existsSync(GOAL_FILE) && changedFiles.length > 0) {
    try {
      const goal = fs.readFileSync(GOAL_FILE, 'utf8').toLowerCase();
      const stopwords = new Set(['this','that','with','from','have','will','been','were','about','would','could','should','after','before','these','those','other','very','just','also','only','each','such','make','like','over','even','most','more','much','still','take','come','know','need','want','find','give','tell']);
      const goalWords = [...new Set(goal.match(/[a-z]{5,}/g) || [])].filter(w => !stopwords.has(w)).slice(0, 30);
      if (goalWords.length >= 5) {
        const diffContent = changedFiles.join(' ').toLowerCase();
        const matched = goalWords.filter(w => diffContent.includes(w));
        const coverage = Math.round(matched.length / goalWords.length * 100);
        results.checks.goal_alignment = { pass: coverage >= 20 || !isAudit, coverage_pct: coverage, matched: matched.length, total: goalWords.length };
        if (isAudit && coverage < 20) results.blockers.push('goal alignment ' + coverage + '%');
      }
    } catch {}
  }

  // 9. SEMANTIC: Test quality ratio warning
  if (tsChanged) {
    const testFiles = changedFiles.filter(f => f.includes('.test.') || f.includes('__tests__'));
    const srcFiles = changedFiles.filter(f => !f.includes('.test.') && !f.includes('__tests__') && (f.endsWith('.ts') || f.endsWith('.tsx')));
    results.checks.test_ratio = { pass: true, tests: testFiles.length, sources: srcFiles.length,
      warning: (testFiles.length > srcFiles.length * 2 && testFiles.length > 3) ? 'More tests than source — verify not gaming' : undefined };
  }

  // 10. SEMANTIC: Checklist legitimacy — items should match user goal keywords
  if (isAudit && fs.existsSync(CHECKLIST) && fs.existsSync(GOAL_FILE)) {
    try {
      const goal = fs.readFileSync(GOAL_FILE, 'utf8').toLowerCase();
      const cl = safeReadJson(CHECKLIST, { items: [] });
      const goalWords = [...new Set(goal.match(/[a-z]{5,}/g) || [])].slice(0, 20);
      const itemText = (cl.items || []).map(i => (i.description || '').toLowerCase()).join(' ');
      const matched = goalWords.filter(w => itemText.includes(w));
      const pct = goalWords.length > 0 ? Math.round(matched.length / goalWords.length * 100) : 100;
      results.checks.checklist_legitimacy = { pass: pct >= 30, pct };
      if (pct < 30) results.blockers.push('checklist legitimacy ' + pct + '%');
    } catch {}
  }

  // 11. i18n check
  if (i18nChanged) {
    try {
      execSync('npm run i18n:check', { cwd: ROOT, stdio: 'pipe', timeout: 30000 });
      results.checks.i18n = { pass: true };
    } catch {
      results.checks.i18n = { pass: false };
      results.blockers.push('i18n:check failed');
    }
  }

  // Final verdict
  results.status = results.blockers.length === 0 ? 'ALLOW' : 'BLOCKED';
  results.blockerCount = results.blockers.length;

  // ALWAYS write evidence (P1: deterministic, not LLM-dependent)
  atomicWrite(VERIFY_FILE, results);

  // Show result to user
  const icon = results.status === 'ALLOW' ? '✅' : '❌';
  const checks = Object.entries(results.checks)
    .map(([k, v]) => `${v.pass ? '✅' : '❌'}${k}`)
    .join(' ');
  process.stderr.write(`\n🛡️ VERIFIER: ${icon} ${results.status} | ${checks}\n`);

  if (results.blockers.length > 0) {
    process.stderr.write(`   Blockers: ${results.blockers.join(', ')}\n`);
    process.exit(2);
  }

  process.exit(0);
}, 3000);
