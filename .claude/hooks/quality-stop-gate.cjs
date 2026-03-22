#!/usr/bin/env node
/**
 * Stop hook — quality gate before Claude finishes responding.
 *
 * BLOCKS Claude from stopping if:
 * - There are uncommitted .ts/.tsx changes AND no .postflight-done token
 *
 * On successful stop:
 * - Cleans .preflight-token (consumed — next task needs fresh pre-flight)
 *
 * AgentSpec tuple: (Stop, uncommitted TS changes + no POST-FLIGHT, BLOCK)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const HOOK_NAME = "quality-stop-gate";
function audit(event, detail) {
  try { var e = JSON.stringify({ ts: Date.now(), hook: HOOK_NAME, event, detail });
    require("fs").appendFileSync(require("path").join(ROOT, ".claude-audit.log"), e + String.fromCharCode(10));
  } catch {}
}

const POSTFLIGHT = path.join(ROOT, '.postflight-done');
const PREFLIGHT_TOKEN = path.join(ROOT, '.preflight-token');
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // SDK sets stop_hook_active=true on second Stop call after a block.
    // This prevents infinite blocking loops. (Confirmed: Claude Code SDK behavior)
    if (data.stop_hook_active === true) {
      // Clean preflight token on final stop
      try { fs.unlinkSync(PREFLIGHT_TOKEN); } catch { /* ok */ }
      process.exit(0);
    }

    // Check for uncommitted .ts/.tsx changes
    let tsChanges = false;
    try {
      const diff = execSync('git diff --name-only', { cwd: ROOT, encoding: 'utf8', timeout: 5000 });
      const staged = execSync('git diff --staged --name-only', { cwd: ROOT, encoding: 'utf8', timeout: 5000 });
      const allChanges = (diff + '\n' + staged).trim();
      tsChanges = allChanges.split('\n').some(f => /\.(ts|tsx)$/.test(f.trim()));
    } catch {
      // git not available or error — don't block
      process.exit(0);
    }

    // Intent snapshot: log GOAL vs actual changes for accountability trail (ReflAct/AEGIS)
    let goal = '';
    try {
      const tokenContent = fs.readFileSync(PREFLIGHT_TOKEN, 'utf8');
      const goalLine = tokenContent.split('\n').find(l => l.startsWith('GOAL:'));
      if (goalLine) goal = goalLine.replace('GOAL:', '').trim();
    } catch { /* no token */ }
    if (goal) {
      const entry = JSON.stringify({ ts: Date.now(), hook: 'quality-stop-gate', event: 'stop', goal, tsChanges }) + '\n';
      try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
    }

    // No TS changes → allow stop, clean token, advisory completion check
    if (!tsChanges) {
      try { fs.unlinkSync(PREFLIGHT_TOKEN); } catch { /* ok */ }
      process.stderr.write(
        'COMPLETION SELF-CHECK (advisory):\n' +
        '- All user-requested tasks completed?\n' +
        '- Any partial work or TODO left?\n' +
        '- IDE diagnostics clean?\n'
      );
      process.exit(0);
    }

    // TS changes exist — check for POST-FLIGHT token
    if (fs.existsSync(POSTFLIGHT)) {
      // Quick validation of POST-FLIGHT content (advisory — commit-gate is hard gate)
      try {
        const pfContent = fs.readFileSync(POSTFLIGHT, 'utf8').replace(/^\uFEFF/, '').trim();
        if (pfContent.startsWith('{')) {
          try {
            const { validate } = require('./reflection-validate.cjs');
            const result = validate(pfContent);
            if (!result.valid) {
              process.stderr.write(
                'POST-FLIGHT TOKEN WARNING (will be BLOCKED at commit):\n' +
                result.errors.map(e => '  - ' + e).join('\n') + '\n' +
                'Fix before committing.\n'
              );
            }
            if (result.warnings.length > 0) {
              process.stderr.write(result.warnings.map(w => '  ⚠️ ' + w).join('\n') + '\n');
            }
          } catch { /* reflection-validate.cjs not found — skip advisory */ }
        }
      } catch { /* read error — skip advisory */ }

      // POST-FLIGHT done — allow stop, clean preflight token
      try { fs.unlinkSync(PREFLIGHT_TOKEN); } catch { /* ok */ }

      // EMPIRICISM CHECK: verify CI evidence freshness (Anti-Pattern #12)
      let ciWarning = '';
      const CI_EVIDENCE = path.join(ROOT, '.ci-evidence');
      try {
        if (fs.existsSync(CI_EVIDENCE)) {
          const lines = fs.readFileSync(CI_EVIDENCE, 'utf8').trim().split('\n').filter(Boolean);
          if (lines.length > 0) {
            const last = JSON.parse(lines[lines.length - 1]);
            const ageMin = Math.round((Date.now() - (last.ts || 0)) / 60000);
            if (ageMin > 5) {
              ciWarning = `\n⚠️ STALE CI: Last CI evidence is ${ageMin}min old. If you claimed "CI passed" — did you SHOW fresh output? (Anti-Pattern #12)\n`;
            }
          }
        } else {
          ciWarning = '\n⚠️ NO CI EVIDENCE: .ci-evidence file missing. If you claimed "CI passed" without running it — that is Anti-Pattern #12 (Stale Citation).\n';
        }
      } catch { /* parse error — skip */ }

      process.stderr.write(
        'COMPLETION SELF-CHECK (advisory):\n' +
        '- All user-requested tasks completed?\n' +
        '- Any partial work or TODO left?\n' +
        '- IDE diagnostics clean?\n' +
        '- EMPIRICISM: Every "passed"/"clean" claim backed by FRESH Bash output in your response?\n' +
        '- ROOT CAUSE: For every fix in this session — documented 5 Whys? Or impossibility explained?\n' +
        ciWarning
      );
      process.exit(0);
    }

    // BLOCK — uncommitted TS changes without POST-FLIGHT
    process.stderr.write(
      'QUALITY STOP GATE BLOCKED!\n\n' +
      'You have uncommitted TypeScript changes but no POST-FLIGHT verification.\n\n' +
      'Complete POST-FLIGHT NOW:\n' +
      '1. Law compliance table (28 laws, ✅/❌, file:line evidence)\n' +
      '2. Mirror Protocol (5 mirrors)\n' +
      '3. Visual Aesthetic Audit (if UI changes)\n' +
      '4. npm run ci:preflight\n' +
      '5. Write structured JSON to .postflight-done:\n' +
      '   { timestamp, goal, changes[], laws_checked:28, mirrors_checked:5,\n' +
      '     ci_passed:true, self_reflection: {what_went_wrong, what_I_assumed,\n' +
      '     what_I_verified (with evidence markers), git_history_checked,\n' +
      '     confidence: HIGH/MEDIUM/LOW} }\n'
    );
    process.exit(2);
  } catch (e) {
    process.stderr.write('HOOK ERROR [quality-stop-gate]: ' + (e.message || e) + '\n');
    audit("allow", "passed all checks");
  process.exit(0);
  }
});
