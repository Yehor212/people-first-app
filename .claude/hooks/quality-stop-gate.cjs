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
      const tokenContent = fs.readFileSync(PREFLIGHT_TOKEN, 'utf8').replace(/^\uFEFF/, '').trim();
      if (tokenContent.startsWith('{')) {
        const parsed = JSON.parse(tokenContent);
        goal = parsed.goal || '';
      } else {
        // Legacy text format fallback
        const goalLine = tokenContent.split('\n').find(l => l.startsWith('GOAL:'));
        if (goalLine) goal = goalLine.replace('GOAL:', '').trim();
      }
    } catch { /* no token or parse error */ }
    if (goal) {
      const entry = JSON.stringify({ ts: Date.now(), hook: 'quality-stop-gate', event: 'stop', goal, tsChanges }) + '\n';
      try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
    }

    // REQUIREMENT COVERAGE CHECK at stop time (research: PairCoder, Strands +17.5pp)
    // Prevents stopping before all user-requested actions are addressed
    const USER_REQ = path.join(ROOT, '.user-requirements');
    let reqWarning = '';
    try {
      if (fs.existsSync(USER_REQ)) {
        const reqs = JSON.parse(fs.readFileSync(USER_REQ, 'utf8'));
        if (reqs.has_no_simplification && reqs.total_actions > 0) {
          // In no-simplification mode: remind about ALL user actions before stopping
          const allActions = [...(reqs.actions_ru || []), ...(reqs.actions_en || [])];
          reqWarning = '\n** NO-SIMPLIFICATION MODE ACTIVE **\n' +
            'User requested ' + reqs.total_actions + ' actions: [' + allActions.join(', ') + ']\n' +
            'Before stopping, verify EACH action was addressed. Scope reduction = BLOCKED at commit.\n';
        }
        if (reqs.has_full_cycle) {
          reqWarning += '\n** FULL CYCLE MODE ** — law_compliance[28] + mirror_compliance[5] + web research required.\n';
        }
      }
    } catch { /* non-critical */ }

    // DIAGNOSTIC EXHAUSTION advisory at stop time
    // Reminds about unchecked sources from preflight enumeration
    try {
      const pfContent = fs.readFileSync(PREFLIGHT_TOKEN, 'utf8').replace(/^\uFEFF/, '').trim();
      if (pfContent.startsWith('{')) {
        const preflight = JSON.parse(pfContent);
        if (Array.isArray(preflight.diagnostic_sources) && preflight.diagnostic_sources.length > 0) {
          reqWarning += '\n** DIAGNOSTIC EXHAUSTION ** — preflight enumerated ' +
            preflight.diagnostic_sources.length + ' sources: [' +
            preflight.diagnostic_sources.join(', ') + ']\n' +
            'postflight.sources_checked[] must cover ALL of them. Commit BLOCKED if mismatch.\n';
        }
      }
    } catch { /* no preflight or parse error */ }

    // EVIDENCE CHAIN CANARY: observable verification — count actual Grep uses vs diagnostic_sources
    // Research: Mutation testing (Stryker), Canary injection — verify detection capability
    const EVIDENCE_CHAIN = path.join(ROOT, '.evidence-chain');
    try {
      const pfContent2 = fs.readFileSync(PREFLIGHT_TOKEN, 'utf8').replace(/^\uFEFF/, '').trim();
      if (pfContent2.startsWith('{')) {
        const preflight = JSON.parse(pfContent2);
        if (Array.isArray(preflight.diagnostic_sources) && preflight.diagnostic_sources.length >= 3) {
          // Count actual Grep tool uses from evidence chain
          let grepCount = 0;
          if (fs.existsSync(EVIDENCE_CHAIN)) {
            const chainLines = fs.readFileSync(EVIDENCE_CHAIN, 'utf8').trim().split('\n').filter(Boolean);
            grepCount = chainLines.filter(l => { try { return JSON.parse(l).tool === 'Grep'; } catch { return false; } }).length;
          }
          const sourceCount = preflight.diagnostic_sources.length;
          // If enumerated 5+ sources but did <2 greps — suspicious satisficing
          if (grepCount < Math.floor(sourceCount / 3)) {
            reqWarning += '\n** EVIDENCE CHAIN CANARY ** — enumerated ' + sourceCount +
              ' diagnostic sources but only ' + grepCount + ' Grep tool uses recorded.\n' +
              'Did you actually search each source? Observable evidence suggests satisficing.\n';
          }
        }
      }
    } catch { /* non-critical */ }

    // No TS changes → allow stop, clean token, advisory completion check
    if (!tsChanges) {
      try { fs.unlinkSync(PREFLIGHT_TOKEN); } catch { /* ok */ }
      process.stderr.write(
        'COMPLETION SELF-CHECK:\n' +
        '- All user-requested tasks completed?\n' +
        '- Any partial work or TODO left?\n' +
        '- IDE diagnostics clean?\n' +
        reqWarning
      );
      audit("allow", "passed all checks");
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

      // EMPIRICISM CHECK: verify CI evidence freshness (Anti-Pattern #12 — Stale Citation)
      // UPGRADED: advisory → BLOCKING. Cannot stop with stale/missing CI when TS changes exist.
      const CI_EVIDENCE = path.join(ROOT, '.ci-evidence');
      if (tsChanges) {
        try {
          if (!fs.existsSync(CI_EVIDENCE)) {
            process.stderr.write(
              'STALE CITATION BLOCKED (Anti-Pattern #12)!\n' +
              'You have TS changes but no .ci-evidence file.\n' +
              'Run: npx tsc --noEmit && npx eslint src/ --max-warnings 0\n' +
              'CI tracker records evidence automatically.\n'
            );
            audit("block", "no CI evidence with TS changes");
            process.exit(2);
          }
          const lines = fs.readFileSync(CI_EVIDENCE, 'utf8').trim().split('\n').filter(Boolean);
          if (lines.length > 0) {
            const last = JSON.parse(lines[lines.length - 1]);
            const ageMin = Math.round((Date.now() - (last.ts || 0)) / 60000);
            if (ageMin > 10) {
              process.stderr.write(
                'STALE CITATION BLOCKED (Anti-Pattern #12)!\n' +
                'Last CI evidence is ' + ageMin + ' minutes old.\n' +
                'Run: npx tsc --noEmit && npx vitest run\n'
              );
              audit("block", "stale CI evidence: " + ageMin + "min");
              process.exit(2);
            }
            // RE-RUN ENFORCEMENT: check that BOTH tsc AND vitest ran (not just one)
            const labels = new Set(lines.map(l => { try { return JSON.parse(l).pattern; } catch { return ''; } }).filter(Boolean));
            const hasTsc = labels.has('tsc');
            const hasVitest = labels.has('vitest');
            if (!hasTsc || !hasVitest) {
              const missing = [];
              if (!hasTsc) missing.push('tsc');
              if (!hasVitest) missing.push('vitest');
              process.stderr.write(
                'RE-RUN ENFORCEMENT BLOCKED!\n' +
                'CI evidence missing: ' + missing.join(' + ') + '\n' +
                'Both tsc AND vitest must run before stopping.\n' +
                'Run: npx tsc --noEmit && npx vitest run\n'
              );
              audit("block", "re-run: missing " + missing.join('+'));
              process.exit(2);
            }
          }
        } catch { /* parse error — don't block on malformed evidence */ }
      }

      process.stderr.write(
        'COMPLETION SELF-CHECK (advisory):\n' +
        '- All user-requested tasks completed?\n' +
        '- Any partial work or TODO left?\n' +
        '- IDE diagnostics clean?\n' +
        '- EMPIRICISM: Every "passed"/"clean" claim backed by FRESH Bash output in your response?\n' +
        '- ROOT CAUSE: For every fix in this session — documented 5 Whys? Or impossibility explained?\n' +
        reqWarning
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
    // Clean stale tokens on error path to prevent carry-over to next session
    try { fs.unlinkSync(PREFLIGHT_TOKEN); } catch { /* ok */ }
    audit("allow", "error path — tokens cleaned");
    process.exit(0);
  }
});
