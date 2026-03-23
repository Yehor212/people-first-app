#!/usr/bin/env node
/**
 * Bash PreToolUse enforcement gate — multi-layer protection.
 *
 * Layer 0: Block Bash file-write commands targeting protected files (issue #29795 tool-switching bypass)
 * Layer 1: Block destructive bash commands (rm -rf, find -delete, truncate, redirect to protected files)
 * Layer 2: Block destructive git commands (reset --hard, checkout -- ., clean -f, branch -D, stash drop)
 * Layer 3: Rewrite unsafe git commands to safe equivalents (--force → --force-with-lease, add . → add -u)
 * Layer 4: Block law docs from being committed
 * Layer 5: Block `git commit` without POST-FLIGHT token (normal + full cycle modes)
 * Layer 6: Block `git push` without ESLint clean
 *
 * All tokens are one-time (deleted after successful check).
 * Audit log: blocking events appended to .claude-audit.log
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const POSTFLIGHT = path.join(ROOT, '.postflight-done');
const FULLCYCLE_ACTIVE = path.join(ROOT, '.fullcycle-active');
const FULLCYCLE_LAWS = path.join(ROOT, '.fullcycle-laws-read');
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

// Required law spec files — auto-discovered from docs/ directory (future-proof: adding law29.md auto-detected)
const DOCS_DIR = path.join(ROOT, 'docs');
const REQUIRED_LAW_FILES = (() => {
  try {
    return fs.readdirSync(DOCS_DIR).filter(f =>
      (f.startsWith('law') || f === 'visual-aesthetic.md') && f.endsWith('.md')
    );
  } catch {
    // Fallback if docs/ unreadable
    return [
      'laws1-7.md', 'laws8-13.md', 'laws14-15.md',
      'law16-mirror.md', 'laws17-20.md', 'law21-surgeon.md',
      'law22-artisan.md', 'law23-philosopher.md', 'law24-empathy.md',
      'law25-concurrency.md', 'law26-techdebt.md', 'law27-ratchet.md',
      'law28-alchemist.md', 'visual-aesthetic.md',
    ];
  }
})();

function audit(event, reason, cmd) {
  try {
    const entry = JSON.stringify({ ts: Date.now(), hook: 'commit-gate', event, reason, cmd: (cmd || '').slice(0, 120) }) + '\n';
    fs.appendFileSync(AUDIT_LOG, entry);
  } catch {}
}

function block(reason, cmd) {
  audit('block', reason, cmd);
  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const inp = JSON.parse(input);
    const cmd = inp.tool_input?.command || '';
    // Normalize escaped newlines for multi-line script detection (C2)
    const cmdNorm = cmd.replace(/\\\n/g, ' ');

    // --- Layer 0: Protected file bypass detection (issue #29795 tool-switching) ---
    // When Edit/Write is blocked, agent may switch to Bash file-write commands.
    // Only checks clearly dangerous patterns (sed -i, python -c, tee, dd) to avoid false positives.
    const PROTECTED_PATHS = [
      '.env', '.env.local', '.env.production',
      'android/keystore', 'supabase/functions/_shared/auth.ts',
      '.claude-audit.log', '.claude/settings.json', 'CLAUDE.md',
      '.evidence-chain', '.verification-done',
    ];
    const bashFileWritePatterns = [
      { pattern: /\bsed\s+-i\b/, label: 'sed in-place edit' },
      { pattern: /\bpython[3]?\s+-c\b/, label: 'python -c file write' },
      { pattern: /\btee\s+(?!-)/, label: 'tee to file' },
      { pattern: /\bdd\s+.*\bof=/, label: 'dd output file' },
      { pattern: /\bmv\s+/, label: 'mv (rename/overwrite target)' },
      { pattern: /\bcp\s+/, label: 'cp (copy over target)' },
      { pattern: /\bcurl\s+.*-o\s/, label: 'curl download to file' },
      { pattern: /\bwget\s+.*-O\s/, label: 'wget download to file' },
      { pattern: /\bawk\b[^|]*>/, label: 'awk redirect to file' },
      { pattern: /\bln\s+/, label: 'ln hardlink/symlink to file' },
    ];
    for (const pp of PROTECTED_PATHS) {
      // Path-boundary-aware matching: avoid .env matching .env.example
      const esc = pp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pathRe = new RegExp('(?:^|[\\s/\\\\"\'])' + esc + '(?:$|[\\s"\'\\\\])', 'i');
      if (pathRe.test(cmdNorm)) {
        for (const fwp of bashFileWritePatterns) {
          if (fwp.pattern.test(cmdNorm)) {
            block('PROTECTED FILE BYPASS BLOCKED: ' + pp + ' targeted via ' + fwp.label + '. Use Edit/Write tool instead (where protected-files.cjs applies).', cmd);
          }
        }
      }
    }

    // --- Layer 1: Destructive BASH command blocking ---
    const bashDestructive = [
      { pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-rf|-f\b|--recursive|--force)\b/, label: 'rm with force/recursive flags' },
      { pattern: /\bfind\b.*\s-delete\b/, label: 'find -delete' },
      { pattern: />\s*[a-zA-Z][\w./\\-]*\.(ts|tsx|js|jsx)\b/, label: 'redirect empty to source file' },
      { pattern: /\btruncate\s/, label: 'truncate file' },
      { pattern: />\s*[^\s]*\.env(?:\.local|\.production)?(?:\s|$|"|')/, label: 'redirect to .env file' },
      { pattern: />\s*[^\s]*\.claude-audit\.log\b/, label: 'overwrite audit log' },
      { pattern: />\s*[^\s]*CLAUDE\.md(?:\s|$|"|')/, label: 'redirect to CLAUDE.md' },
      { pattern: />\s*[^\s]*settings\.json(?:\s|$|"|')/, label: 'redirect to settings.json' },
    ];
    for (const d of bashDestructive) {
      if (d.pattern.test(cmdNorm)) {
        block('DESTRUCTIVE BASH COMMAND BLOCKED: ' + d.label + '. This operation could cause irreversible data loss.', cmd);
      }
    }

    // --- Layer 2: Destructive GIT command blocking ---
    const gitDestructive = [
      { pattern: /git\s+reset\s+--hard\b/, label: 'git reset --hard' },
      { pattern: /git\s+checkout\s+--\s+\.\s*$/, label: 'git checkout -- .' },
      { pattern: /git\s+clean\s+(-f\w*|--force)\b/, label: 'git clean -f/--force' },
      { pattern: /git\s+branch\s+-D\b/, label: 'git branch -D' },
      { pattern: /git\s+stash\s+drop/, label: 'git stash drop' },
    ];
    for (const d of gitDestructive) {
      if (d.pattern.test(cmdNorm)) {
        block('DESTRUCTIVE GIT COMMAND BLOCKED: ' + d.label + '. No safe equivalent. Consider alternatives.', cmd);
      }
    }

    // --- Layer 3: Input rewriting — unsafe → safe equivalent (updatedInput) ---
    const rewriteRules = [
      { pattern: /git\s+push\s+--force(?![-\w])/, rewrite: c => c.replace(/--force(?![-\w])/, '--force-with-lease') },
      { pattern: /git\s+push\s+-f(?=\s|$)/, rewrite: c => c.replace(/-f(?=\s|$)/, '--force-with-lease') },
      { pattern: /git\s+add\s+\.(?=\s|$|&|\|)/, rewrite: c => c.replace(/git\s+add\s+\.(?=\s|$|&|\|)/, 'git add -u') },
      { pattern: /git\s+add\s+-A\b/, rewrite: c => c.replace(/-A\b/, '-u') },
    ];
    for (const r of rewriteRules) {
      if (r.pattern.test(cmd)) {
        const safe = r.rewrite(cmd);
        audit('rewrite', cmd + ' → ' + safe, cmd);
        console.log(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'allow',
            permissionDecisionReason: 'Rewritten to safe equivalent: ' + safe,
            updatedInput: { command: safe }
          }
        }));
        process.exit(0);
      }
    }

    // --- Layer 4+5: git commit gate (includes law docs blocking) ---
    if (cmd.includes('git commit')) {
      // Layer 4: Block law docs from being committed
      const { execSync } = require('child_process');
      try {
        const staged = execSync('git diff --cached --name-only', { cwd: ROOT, stdio: 'pipe', timeout: 5000 }).toString();
        const lawFiles = staged.split('\n').filter(f =>
          f.match(/^docs\/law.*\.md$/) || f.match(/^docs\/visual-aesthetic\.md$/)
        );
        if (lawFiles.length > 0) {
          block('LAW DOCS BLOCKED! Cannot commit: ' + lawFiles.join(', ') + '. Run: git reset HEAD ' + lawFiles.join(' '), cmd);
        }
      } catch {} // If git diff fails, continue to other checks

      // Layer 5: POST-FLIGHT token validation
      const isFullCycle = fs.existsSync(FULLCYCLE_ACTIVE);

      // Check POST-FLIGHT token EXISTS
      if (!fs.existsSync(POSTFLIGHT)) {
        block(
          'POST-FLIGHT BLOCKED! Complete 28-law table + 5 mirrors + ci:preflight. Then write proof: echo "28-law table done, 5 mirrors done" > .postflight-done',
          cmd
        );
      }

      // Check POST-FLIGHT token CONTENT — structured JSON or legacy
      const postflightContent = fs.readFileSync(POSTFLIGHT, 'utf8');
      const postflightCleaned = postflightContent.replace(/^\uFEFF/, '').trim();

      if (postflightCleaned.startsWith('{')) {
        // Structured JSON format — full validation
        try {
          const { validate } = require('./reflection-validate.cjs');
          const result = validate(postflightCleaned);
          if (!result.valid) {
            block('POST-FLIGHT REFLECTION INVALID!\n' + result.errors.map(e => '  - ' + e).join('\n') + '\n\nFix errors in .postflight-done and retry.', cmd);
          }
          if (result.warnings.length > 0) {
            process.stderr.write('POST-FLIGHT WARNINGS:\n' + result.warnings.map(w => '  ⚠️ ' + w).join('\n') + '\n');
          }
          audit('allow', 'structured postflight validated' + (result.warnings.length > 0 ? ' (with warnings)' : ''), cmd);
        } catch (requireErr) {
          // reflection-validate.cjs not found — fail-closed
          block('Cannot load reflection-validate.cjs: ' + requireErr.message + '. Ensure module exists in .claude/hooks/', cmd);
        }
      } else {
        // Legacy format — accept with warning
        // TODO(2026-04-03): Remove legacy format support
        if (!postflightContent.includes('28')) {
          block(
            'POST-FLIGHT TOKEN INVALID! File must contain "28" (proof of 28-law table).\n' +
            'Use structured JSON: Write tool → .postflight-done → { timestamp, goal, changes[], laws_checked:28, mirrors_checked:5, ci_passed:true, self_reflection:{...} }',
            cmd
          );
        }
        process.stderr.write('WARNING: Legacy .postflight-done format. Use structured JSON for better validation.\n');
      }

      // Layer 5b: Law 27 — Ratchet enforcement (mechanical, not advisory)
      // Runs ratchet:check BEFORE allowing commit. No exceptions.
      const { execSync: execSyncRatchet } = require('child_process');
      try {
        execSyncRatchet('npm run ratchet:check', {
          cwd: ROOT,
          stdio: 'pipe',
          timeout: 120000, // 2 min max
        });
        audit('allow', 'ratchet:check PASSED', cmd);
      } catch (ratchetErr) {
        const output = (ratchetErr.stdout || '').toString().slice(-500);
        block(
          'RATCHET CHECK FAILED (Law 27)! Quality floor violated. Fix violations before commit.\n\n' + output,
          cmd
        );
      }

      // If full cycle mode, check laws-read token
      if (isFullCycle) {
        if (!fs.existsSync(FULLCYCLE_LAWS)) {
          block(
            'FULL CYCLE BLOCKED! Read ALL 14 law spec files, then write each filename to .fullcycle-laws-read (one per line)',
            cmd
          );
        }

        // Verify content: must list at least 14 law filenames + ARCHITECTURE.md
        const lawsContent = fs.readFileSync(FULLCYCLE_LAWS, 'utf8');
        const missing = REQUIRED_LAW_FILES.filter(f => !lawsContent.includes(f));
        if (missing.length > 0) {
          block(
            `FULL CYCLE INCOMPLETE! Missing ${missing.length} law files in .fullcycle-laws-read: ${missing.join(', ')}`,
            cmd
          );
        }
        // ARCHITECTURE.md is project blueprint — must be read in full cycle
        if (!lawsContent.includes('ARCHITECTURE.md')) {
          block(
            'FULL CYCLE INCOMPLETE! ARCHITECTURE.md not listed in .fullcycle-laws-read. Read it and add to the list.',
            cmd
          );
        }
      }

      // Layer 5d: Mandatory Verifier in full-cycle mode (Two-Person Rule, Nuclear safety)
      // Research: ICE ensemble (+7-15pp), IMDA 2025 self-report unreliability, GitHub Required Reviewer
      // In full-cycle mode, a separate verifier agent MUST approve before commit
      if (isFullCycle) {
        const VERIFICATION_DONE = path.join(ROOT, '.verification-done');
        if (!fs.existsSync(VERIFICATION_DONE)) {
          block(
            'FULL CYCLE VERIFICATION REQUIRED!\n' +
            'Two-Person Rule: a separate verifier agent must approve your changes.\n' +
            'Run: Agent tool with .claude/agents/verifier.md → write .verification-done token.\n' +
            'Token format: { agent: "verifier", timestamp, checks: [{name, pass, evidence}], verdict: "APPROVE" }',
            cmd
          );
        } else {
          // Validate verification token structure
          try {
            const vtoken = JSON.parse(fs.readFileSync(VERIFICATION_DONE, 'utf8').replace(/^\uFEFF/, ''));
            if (vtoken.agent !== 'verifier') {
              block('VERIFICATION TOKEN INVALID: agent field must be "verifier" (got "' + vtoken.agent + '")', cmd);
            }
            if (!Array.isArray(vtoken.checks) || vtoken.checks.length < 3) {
              block('VERIFICATION TOKEN INVALID: need >= 3 checks (got ' + (vtoken.checks || []).length + ')', cmd);
            }
            if (vtoken.verdict !== 'APPROVE') {
              block('VERIFICATION TOKEN: verifier did NOT approve (verdict="' + vtoken.verdict + '")', cmd);
            }
            // Check token freshness (< 1 hour)
            if (vtoken.timestamp) {
              const age = Date.now() - new Date(vtoken.timestamp).getTime();
              if (age > 3600000) {
                block('VERIFICATION TOKEN STALE: ' + Math.round(age / 60000) + ' min old. Re-run verifier.', cmd);
              }
            }
            audit('allow', 'verifier approved (' + (vtoken.checks || []).length + ' checks)', cmd);
          } catch (parseErr) {
            block('VERIFICATION TOKEN NOT VALID JSON: ' + parseErr.message, cmd);
          }
          // Consume token
          try { fs.unlinkSync(VERIFICATION_DONE); } catch {}
        }
      }

      // §B: Check .worktree-verify-pending — warn if worktree output not verified in main
      const WORKTREE_VERIFY = path.join(ROOT, '.worktree-verify-pending');
      if (fs.existsSync(WORKTREE_VERIFY)) {
        process.stderr.write('⚠️ WORKTREE VERIFY: .worktree-verify-pending exists. Did you verify worktree output in MAIN before committing?\n');
        // Advisory only — warn but don't block (Anti-Pattern #6/#7)
        try { fs.unlinkSync(WORKTREE_VERIFY); } catch {}
      }

      // §D: Staged gap detection — warn if staged TS changes exist without fresh postflight
      // (postflight already validated above, but this catches edge case of stale postflight)

      // Layer 5c: Evidence Chain Challenge-Response (Aviation checklist pattern, Aegis research)
      // Cross-reference: preflight evidence.search[] claims vs actual .evidence-chain entries
      const EVIDENCE_CHAIN = path.join(ROOT, '.evidence-chain');
      try {
        if (fs.existsSync(path.join(ROOT, '.preflight-token')) && fs.existsSync(EVIDENCE_CHAIN)) {
          const preflight = JSON.parse(fs.readFileSync(path.join(ROOT, '.preflight-token'), 'utf8').replace(/^\uFEFF/, ''));
          const searchClaims = (preflight.evidence && Array.isArray(preflight.evidence.search)) ? preflight.evidence.search : [];
          const chainEntries = fs.readFileSync(EVIDENCE_CHAIN, 'utf8').trim().split('\n').filter(Boolean);

          if (searchClaims.length > 0 && chainEntries.length === 0) {
            process.stderr.write('EVIDENCE CHAIN WARNING: preflight claims ' + searchClaims.length +
              ' search entries but .evidence-chain is empty. Were searches actually performed?\n');
          }
        }
      } catch { /* non-critical — advisory only */ }

      // Layer 5e: CI Evidence Gate — BLOCKING (NASA GMIP pattern)
      // Research: "Verification that depends on agent choosing to verify will be skipped" (OpenAI, Qodo, NASA)
      // .ci-evidence must exist and be <10min old when TS changes are staged
      // Incident: agent declared "all works" without running tsc/eslint/vitest — Anti-Pattern #5
      const CI_EVIDENCE_PATH = path.join(ROOT, '.ci-evidence');
      try {
        const staged = execSync('git diff --cached --name-only', { cwd: ROOT, stdio: 'pipe', timeout: 5000 }).toString();
        const hasTsChanges = staged.split('\n').some(f => /\.(ts|tsx)$/.test(f.trim()));

        if (hasTsChanges) {
          if (!fs.existsSync(CI_EVIDENCE_PATH)) {
            block(
              'CI EVIDENCE REQUIRED! You have staged .ts/.tsx changes but no .ci-evidence file.\n' +
              'Run: npm run ci:preflight (or at minimum: npx tsc --noEmit && npx eslint src/ --max-warnings 0)\n' +
              'The ci-tracker hook records evidence automatically when you run CI commands.\n' +
              'Anti-Pattern #5: Never claim "all works" without fresh CI output.',
              cmd
            );
          } else {
            const lines = fs.readFileSync(CI_EVIDENCE_PATH, 'utf8').trim().split('\n').filter(Boolean);
            if (lines.length > 0) {
              try {
                const last = JSON.parse(lines[lines.length - 1]);
                const ageMin = Math.round((Date.now() - (last.ts || 0)) / 60000);
                if (ageMin > 10) {
                  block(
                    'CI EVIDENCE STALE! Last CI run was ' + ageMin + ' minutes ago.\n' +
                    'Run: npm run ci:preflight (or: npx tsc --noEmit && npx eslint src/ --max-warnings 0)\n' +
                    'Anti-Pattern #12: Stale Citation — CI evidence must be <10 minutes old.',
                    cmd
                  );
                }
              } catch { /* parse error — allow, ci-tracker format may vary */ }
            }
          }
        }
      } catch { /* git diff failed — don't block on git errors */ }

      // All checks passed — consume tokens
      try { fs.unlinkSync(POSTFLIGHT); } catch {}
      if (isFullCycle) {
        try { fs.unlinkSync(FULLCYCLE_LAWS); } catch {}
        try { fs.unlinkSync(FULLCYCLE_ACTIVE); } catch {}
      }
      // --- Layer 7: Snyk scan verification (Anti-Pattern #18) ---
      const SNYK_PENDING = path.join(ROOT, '.snyk-pending');
      const SNYK_DONE = path.join(ROOT, '.snyk-scan-done');
      if (fs.existsSync(SNYK_PENDING)) {
        // Fail-open: if token is >4 hours old, auto-clean (stale from previous session)
        try {
          const snykData = JSON.parse(fs.readFileSync(SNYK_PENDING, 'utf8'));
          const snykAge = Date.now() - new Date(snykData.timestamp).getTime();
          if (snykAge > 4 * 3600000) {
            fs.unlinkSync(SNYK_PENDING);
            audit('allow', 'stale .snyk-pending cleaned (>4h old)', cmd);
          } else if (!fs.existsSync(SNYK_DONE)) {
            block(
              'SNYK SCAN REQUIRED (Anti-Pattern #18 — Tool Blindness)!\n' +
              'New code detected in: ' + (snykData.file || 'unknown') + '\n' +
              'Per CLAUDE.md global rule: run snyk_code_scan before commit.\n' +
              'After scan, create .snyk-scan-done token.',
              cmd
            );
          } else {
            // Both tokens exist — clean up
            try { fs.unlinkSync(SNYK_PENDING); } catch {}
            try { fs.unlinkSync(SNYK_DONE); } catch {}
            audit('allow', 'Snyk scan verified and tokens cleaned', cmd);
          }
        } catch {
          // Malformed token — clean up, don't block
          try { fs.unlinkSync(SNYK_PENDING); } catch {}
          audit('allow', 'malformed .snyk-pending cleaned', cmd);
        }
      }

      // Clean IDE ack tokens on commit
      try { fs.unlinkSync(path.join(ROOT, '.ide-ack-pending')); } catch {}
      try { fs.unlinkSync(path.join(ROOT, '.ide-ack-done')); } catch {}
      try { fs.unlinkSync(path.join(ROOT, '.ci-evidence')); } catch {}
      audit('allow', 'commit gate passed', cmd);
      console.log('Gate PASSED — all tokens verified and consumed');
    }

    // --- Layer 6: git push gate (ESLint) ---
    if (cmd.includes('git push')) {
      const { execSync } = require('child_process');
      try {
        execSync('npx eslint . --max-warnings=0', {
          cwd: ROOT,
          stdio: 'pipe',
          timeout: 120000,
        });
        audit('allow', 'eslint passed', cmd);
        console.log('ESLint preflight PASSED');
      } catch {
        block('ESLint preflight FAILED. Run: npx eslint . --max-warnings=0 --fix', cmd);
      }

      // --- Layer 6b: Remote CI check (Anti-Pattern #13 — Local All-Clear) ---
      // Local CI passes ≠ Remote CI passes. Check GitHub Actions before push.
      try {
        const ghResult = execSync('gh run view --json conclusion -q .conclusion', {
          cwd: ROOT,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 15000,
        }).trim();
        if (ghResult === 'failure') {
          block(
            'LOCAL ALL-CLEAR BLOCKED (Anti-Pattern #13)!\n' +
            'Last GitHub Actions run FAILED. Local CI ≠ Remote CI.\n' +
            'Check: gh run view --log-failed\n' +
            'Fix remote CI first, or if this push IS the fix, add "fix(ci)" to commit message.',
            cmd
          );
        } else if (ghResult === 'success') {
          audit('allow', 'remote CI also green', cmd);
        }
      } catch {
        // gh CLI not available or network error — don't block (fail-open for missing tool)
        audit('allow', 'gh CLI unavailable — skipping remote CI check', cmd);
      }
    }
  } catch (e) {
    process.stderr.write('HOOK ERROR [commit-gate]: ' + (e.message || e) + '\n');
    // Fail-closed for security hook — block on parse error
    process.exit(2);
  }
});
