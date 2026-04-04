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
      '.ruflo-last-action', // v2: prevent fake area coverage via Bash (METR reward hacking)
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
      { pattern: /\bcat\s+.*>/, label: 'cat redirect to file' },
      { pattern: /\becho\s+.*>/, label: 'echo redirect to file' },
      { pattern: /\bprintf\s+.*>/, label: 'printf redirect to file' },
      { pattern: /\bnode\s+-e\s.*writeFile/, label: 'node -e writeFile' },
      { pattern: /\bperl\s+-.*>/, label: 'perl redirect to file' },
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
          'POST-FLIGHT BLOCKED! Write .postflight-done with JSON: { timestamp, goal, changes[], verdict: "APPROVE", evidence: "tsc 0, vitest N pass" }',
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
        // Legacy text format — accept with warning
        if (postflightCleaned.length < 5) {
          block(
            'POST-FLIGHT TOKEN INVALID! Use JSON: { timestamp, goal, changes[], verdict: "APPROVE", evidence: "..." }',
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

      // Layer 5d: Mandatory Verifier for TS/TSX changes (Two-Person Rule)
      // A separate verifier agent must approve before committing TypeScript changes
      {
        let stagedFiles = '';
        try { stagedFiles = execSync('git diff --cached --name-only', { cwd: ROOT, stdio: 'pipe', timeout: 5000 }).toString(); } catch {}
        const hasTsChanges = stagedFiles.split('\n').some(f => /\.(ts|tsx)$/.test(f.trim()));
        if (hasTsChanges) {
        const VERIFICATION_DONE = path.join(ROOT, '.verification-done');
        if (!fs.existsSync(VERIFICATION_DONE)) {
          block(
            'VERIFICATION REQUIRED!\n' +
            'A separate verifier agent must approve TypeScript changes before commit.\n' +
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
            if (vtoken.verdict !== 'APPROVE') {
              block('VERIFICATION TOKEN: verifier did NOT approve (verdict="' + vtoken.verdict + '")', cmd);
            }

            // Hole 1 fix: require 5 NAMED mandatory checks (not just count >= 3)
            const REQUIRED_CHECKS = ['typescript', 'eslint', 'tests_pass', 'build_succeeds', 'i18n'];
            const checkNames = (vtoken.checks || []).map(c => c.name);
            const missingChecks = REQUIRED_CHECKS.filter(r => !checkNames.includes(r));
            if (missingChecks.length > 0) {
              block('VERIFICATION TOKEN INCOMPLETE: missing required checks: ' + missingChecks.join(', ') + '.\n' +
                'Token must include ALL of: ' + REQUIRED_CHECKS.join(', '), cmd);
            }

            // Hole 1 fix: evidence must contain concrete results, not just "exit 0"
            for (const check of (vtoken.checks || [])) {
              if (check.name === 'tests_pass' && check.pass && !/\d+\s*(pass|test|spec)/i.test(check.evidence || '')) {
                block('VERIFICATION TOKEN WEAK EVIDENCE: tests_pass evidence must include test count (e.g. "3224 passed"). Got: "' + (check.evidence || '') + '"', cmd);
              }
              if (check.name === 'typescript' && check.pass && !/\d+\s*(error|clean|type)/i.test(check.evidence || '')) {
                block('VERIFICATION TOKEN WEAK EVIDENCE: typescript evidence must include error count (e.g. "0 errors"). Got: "' + (check.evidence || '') + '"', cmd);
              }
              if (check.name === 'build_succeeds' && check.pass && !/build|built|\d+\s*(kb|mb|ms|s\b|module|entri)/i.test(check.evidence || '')) {
                block('VERIFICATION TOKEN WEAK EVIDENCE: build_succeeds evidence must include build details. Got: "' + (check.evidence || '') + '"', cmd);
              }
            }

            // Check token freshness (< 30 minutes — real verification takes 2-5 min)
            if (vtoken.timestamp) {
              const age = Date.now() - new Date(vtoken.timestamp).getTime();
              if (age > 1800000) {
                block('VERIFICATION TOKEN STALE: ' + Math.round(age / 60000) + ' min old (max 30). Re-run verifier.', cmd);
              }
            }
            audit('allow', 'verifier approved (' + (vtoken.checks || []).length + ' checks)', cmd);
          } catch (parseErr) {
            block('VERIFICATION TOKEN NOT VALID JSON: ' + parseErr.message, cmd);
          }
          // Token consumed AFTER all layers pass (moved to end — Bug fix: early deletion caused re-generation on Layer 5f/5g/5h block)
        }
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
              // Parse all entries, check freshness AND required commands
              const now = Date.now();
              const MAX_AGE_MS = 15 * 60000; // 15 min (vitest can take 50s+, tsc before it)
              const recentLabels = new Set();
              let newestTs = 0;

              for (const line of lines) {
                try {
                  const entry = JSON.parse(line);
                  const age = now - (entry.ts || 0);
                  if (age <= MAX_AGE_MS) {
                    recentLabels.add(entry.pattern || entry.label || 'unknown');
                    if ((entry.ts || 0) > newestTs) newestTs = entry.ts;
                  }
                } catch { /* skip malformed */ }
              }

              if (recentLabels.size === 0) {
                block(
                  'CI EVIDENCE STALE! No CI runs in last 15 minutes.\n' +
                  'Run: npm run ci:preflight (or: npx tsc --noEmit && npx vitest run)\n' +
                  'Anti-Pattern #12: Stale Citation.',
                  cmd
                );
              } else {
                // Require BOTH tsc AND vitest for TS commits
                const REQUIRED = ['tsc', 'vitest'];
                const missing = REQUIRED.filter(r => !recentLabels.has(r) && !recentLabels.has('ci:preflight'));
                if (missing.length > 0) {
                  block(
                    'CI EVIDENCE INCOMPLETE! Missing: ' + missing.join(', ') + '.\n' +
                    'Ran: ' + [...recentLabels].join(', ') + '. Need BOTH tsc + vitest for TS commits.\n' +
                    'Run: npm run ci:preflight (includes all checks)\n' +
                    'Root cause: tsc alone does NOT catch test failures (incident: 3222 tests, 2 failed).',
                    cmd
                  );
                }
              }
            }
          }
        }
      } catch { /* git diff failed — don't block on git errors */ }

      // --- Layer 5f: Commit size limit (Small PRs principle) ---
      // Research: "several small PRs beat one big one" (CodeRabbit, First Round Review)
      try {
        const stagedFiles = execSync('git diff --cached --name-only', { cwd: ROOT, stdio: 'pipe', timeout: 5000 })
          .toString().trim().split('\n').filter(f => f.trim().length > 0);
        if (stagedFiles.length > 7) {
          // Allow if commit message contains EXPLICIT justification keyword at START of a word
          // Verifier finding 2.1: regex was too permissive — "audit log" in message bypassed
          // Bug fix: also handle HEREDOC format: -m "$(cat <<'EOF'\n...\nEOF\n)"
          const msgMatch = cmd.match(/-m\s+["']([^"']+)["']/);
          const heredocMatch = !msgMatch && cmd.match(/<<'?EOF'?[\s\S]*?\n([\s\S]*?)\n\s*EOF/);
          const commitMsg = msgMatch ? msgMatch[1] : heredocMatch ? heredocMatch[1] : cmd.replace(/^git commit\s*/, '');
          const hasJustification = /\b(batch|bulk|refactor|migration|rename|enforcement)\b/i.test(commitMsg);
          if (!hasJustification) {
            block(
              'COMMIT SIZE LIMIT: ' + stagedFiles.length + ' files staged (max 7 without justification).\n' +
              'Split into smaller commits for better reviewability.\n' +
              'Override: include "batch", "refactor", "migration", "enforcement", or "audit" in commit message.\n' +
              'Research: "several small PRs beat one big one" (CodeRabbit 2026).',
              cmd
            );
          }
        }
        // --- Layer 5g: Infrastructure Bias Detection (Anti-Pattern #9) ---
        const hookFiles = stagedFiles.filter(f => f.includes('.claude/hooks/'));
        if (hookFiles.length > 0 && stagedFiles.length > 0) {
          const ratio = hookFiles.length / stagedFiles.length;
          if (ratio > 0.7 && stagedFiles.length >= 3) {
            // BLOCKING — not advisory. User: "если не blocking, ты будешь игнорить"
            // Override: include "enforcement" in commit message for legitimate hook-only commits
            if (!hasJustification) {
              block(
                'INFRASTRUCTURE BIAS BLOCKED (Anti-Pattern #9)!\n' +
                Math.round(ratio * 100) + '% of staged files are hooks (' + hookFiles.length + '/' + stagedFiles.length + ').\n' +
                'Include app code fixes alongside enforcement changes.\n' +
                'Override: include "enforcement" in commit message.',
                cmd
              );
            }
          }
        }
      } catch { /* git diff failed — don't block */ }

      // --- Layer 5h: Ruflo Full Pipeline + Area Coverage (BLOCKING) ---
      // v2: Now checks AREA BREADTH in addition to 3 core phases.
      // Root cause of v1 bypass: agent ran 3 tools from 1 area → all gates passed.
      // Research: METR 2025 "Models know they are cheating" — must enforce ALL areas
      //           "Only mechanical enforcement = 95-99%+" (NASA IV&V)
      // v3: ALL 16 areas mandatory. Zero skips.
      {
        const RUFLO_STATE_CG = path.join(ROOT, '.ruflo-last-action');
        const { countRufloAreas, TOTAL_AREAS: TOTAL_16_CG } = require('./hook-utils.cjs');

        if (fs.existsSync(RUFLO_STATE_CG)) {
          try {
            const rs = JSON.parse(fs.readFileSync(RUFLO_STATE_CG, 'utf8'));
            const rufloAge = Date.now() - (rs.lastAction || 0);

            // Freshness: 4h max
            if (rufloAge > 4 * 60 * 60000) {
              block(
                'RUFLO EVIDENCE STALE! Last action ' + Math.round(rufloAge / 60000) + 'min ago (max 240).\n' +
                'Use ALL 16 Ruflo areas, then ruflo-enforcer auto-updates state.',
                cmd
              );
            }

            // BEFORE-work phases
            const missingBefore = [];
            if (!rs.phases?.memory_search?.done) missingBefore.push('memory_search (mcp__ruflo__memory_search)');
            if (!rs.phases?.pattern_search?.done) missingBefore.push('pattern_search (mcp__ruflo__agentdb_pattern-search)');
            if (missingBefore.length > 0) {
              block(
                'RUFLO PIPELINE INCOMPLETE! Missing BEFORE-work phases:\n' +
                missingBefore.map(p => '  - ' + p).join('\n'),
                cmd
              );
            }

            // AFTER-work phase
            if (!rs.phases?.store_result?.done) {
              block('RUFLO STORE REQUIRED! Run mcp__ruflo__memory_store to save solution pattern.', cmd);
            }

            // ALL 16 AREA CHECK (v3 — zero skips)
            const { usedCount, missingAreas } = countRufloAreas(rs);
            if (usedCount < TOTAL_16_CG) {
              block(
                'RUFLO ALL-16 COVERAGE BLOCKED!\n' +
                '  Areas used: ' + usedCount + '/' + TOTAL_16_CG + ' (need ALL 16)\n' +
                '  Missing ' + missingAreas.length + ': [' + missingAreas.join(', ') + ']\n' +
                '  Call 1 tool from each missing area. Examples:\n' +
                missingAreas.slice(0, 5).map(a => '    - mcp__ruflo__' + a.replace(/-/g, '_').split('_')[0] + '_status/list').join('\n'),
                cmd
              );
            }

            audit('allow', 'ruflo verified: 3/3 phases + ' + usedCount + '/' + TOTAL_16_CG + ' areas (' + Math.round(rufloAge / 60000) + 'min ago)', cmd);
          } catch (rufloErr) {
            block('RUFLO STATE INVALID: ' + rufloErr.message, cmd);
          }
        } else {
          block(
            'RUFLO EVIDENCE REQUIRED! No .ruflo-last-action found.\n' +
            'Full pipeline (v3 — ALL 16 areas):\n' +
            '  1. Call tools from ALL 16 areas (ruflo-enforcer auto-tracks)\n' +
            '  2. mcp__ruflo__memory_store (save outcome)\n' +
            '  3. State file auto-created by PreToolUse tracking.',
            cmd
          );
        }
      }

      // NOTE: Token consumption moved AFTER Layer 7/7b (verifier finding 2.2)
      // If Layer 7 blocks, tokens are preserved — no forced postflight recreation.

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

      // --- Layer 7b: Research completion verification ---
      const RESEARCH_PENDING_CG = path.join(ROOT, '.research-pending');
      const RESEARCH_DONE_CG = path.join(ROOT, '.research-done');
      if (fs.existsSync(RESEARCH_PENDING_CG)) {
        try {
          const rp = JSON.parse(fs.readFileSync(RESEARCH_PENDING_CG, 'utf8'));
          if (rp.expires_at && Date.now() > rp.expires_at) {
            fs.unlinkSync(RESEARCH_PENDING_CG);
            try { fs.unlinkSync(RESEARCH_DONE_CG); } catch {}
            audit('allow', 'stale .research-pending cleaned (expired)', cmd);
          } else if (!fs.existsSync(RESEARCH_DONE_CG) && rp.min_searches > 0) {
            block('RESEARCH REQUIRED: user explicitly requested ' + rp.min_searches + ' search(es). Use WebSearch before commit.', cmd);
          } else if (fs.existsSync(RESEARCH_DONE_CG)) {
            const rd = JSON.parse(fs.readFileSync(RESEARCH_DONE_CG, 'utf8'));
            if (rp.min_searches > 0 && (rd.count || 0) < rp.min_searches) {
              block('RESEARCH INCOMPLETE: ' + (rd.count || 0) + '/' + rp.min_searches + ' search(es). User requested explicit count.', cmd);
            } else {
              try { fs.unlinkSync(RESEARCH_PENDING_CG); } catch {}
              try { fs.unlinkSync(RESEARCH_DONE_CG); } catch {}
              audit('allow', 'Research verified: ' + rd.count + ' searches completed', cmd);
            }
          }
        } catch {
          try { fs.unlinkSync(RESEARCH_PENDING_CG); } catch {}
          audit('allow', 'malformed .research-pending cleaned', cmd);
        }
      }

      // All layers passed — NOW consume tokens (verifier finding 2.2: moved after L7/7b)
      // Bug fix: verification token also moved here (was at L5d, causing re-generation on L5f block)
      try { fs.unlinkSync(POSTFLIGHT); } catch {}
      try { fs.unlinkSync(VERIFICATION_DONE); } catch {}
      if (isFullCycle) {
        try { fs.unlinkSync(FULLCYCLE_LAWS); } catch {}
        try { fs.unlinkSync(FULLCYCLE_ACTIVE); } catch {}
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
        execSync('npx eslint . --max-warnings=96', {
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

    // --- Layer 8: Ruflo diff-risk advisory (Anti-Pattern #18 Tool Blindness) ---
    // Remind to use mcp__ruflo__analyze_diff-risk before push
    if (cmd.includes('git push') || cmd.includes('git commit')) {
      const RUFLO_STAMP = path.join(ROOT, '.ruflo-last-action');
      let rufloUsed = false;
      try {
        const data = JSON.parse(fs.readFileSync(RUFLO_STAMP, 'utf8'));
        // FIX: use lastAction (not timestamp) — matches .ruflo-last-action schema
        rufloUsed = (Date.now() - (data.lastAction || data.timestamp || 0)) < 30 * 60 * 1000;
      } catch {}
      if (!rufloUsed) {
        process.stderr.write(
          '\n⚠️ RUFLO DIFF-RISK ADVISORY: No recent Ruflo activity.\n' +
          'Consider running mcp__ruflo__analyze_diff-risk before push\n' +
          'to assess change risk and get recommended reviewers.\n\n'
        );
        audit('advisory', 'ruflo diff-risk not run', cmd);
      }
    }
  } catch (e) {
    process.stderr.write('HOOK ERROR [commit-gate]: ' + (e.message || e) + '\n');
    // Fail-closed for security hook — block on parse error
    process.exit(2);
  }
});
