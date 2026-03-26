#!/usr/bin/env node
/**
 * PreToolUse hook for Edit|Write — FIND-ONE-SEARCH-ALL gate.
 *
 * BLOCKING (exit 2). Enforces Law 3 (Exhaustion):
 * After a bug fix, the next Edit/Write is blocked until a project-wide
 * Grep confirms no similar instances remain.
 *
 * Token lifecycle:
 *   1. Bug fix made → agent creates .bugfix-pending (manual, prompted by ide-diagnostic-gate)
 *   2. Grep tool used → search-confirm.cjs creates .search-confirmed (automatic)
 *   3. Next Edit → this hook checks both tokens → cleans → allows
 *
 * Fail-closed: crash → exit 2 → edit blocked (safe default).
 * Stale tokens (>4h) auto-cleaned to prevent cross-session blocks.
 *
 * Pattern: follows preflight-gate.cjs (same fail-closed, stdin JSON, ROOT).
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const HOOK_NAME = "search-gate";
function audit(event, detail) {
  try { var e = JSON.stringify({ ts: Date.now(), hook: HOOK_NAME, event, detail });
    require("fs").appendFileSync(require("path").join(ROOT, ".claude-audit.log"), e + String.fromCharCode(10));
  } catch {}
}

const BUGFIX_PENDING = path.join(ROOT, '.bugfix-pending');
const SEARCH_CONFIRMED = path.join(ROOT, '.search-confirmed');
const CF_PENDING = path.join(ROOT, '.control-flow-pending');
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');
const STALE_MS = 4 * 60 * 60 * 1000; // 4 hours

function auditLog(event, detail) {
  const entry = JSON.stringify({
    ts: Date.now(),
    hook: 'search-gate',
    event,
    detail: String(detail).slice(0, 200),
  }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch { /* best-effort */ }
}

function isStale(filePath) {
  try {
    return (Date.now() - fs.statSync(filePath).mtimeMs) > STALE_MS;
  } catch { return false; }
}

function cleanToken(filePath) {
  try { fs.unlinkSync(filePath); } catch { /* already gone */ }
}

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = (data.tool_input?.file_path || '').replace(/\\/g, '/');

    // Only enforce on TypeScript files (same filter as preflight-gate)
    if (!filePath.match(/\.(ts|tsx)$/)) {
      process.exit(0);
    }

    // Clean stale tokens (cross-session protection)
    if (fs.existsSync(BUGFIX_PENDING) && isStale(BUGFIX_PENDING)) {
      cleanToken(BUGFIX_PENDING);
      auditLog('stale-cleanup', 'bugfix-pending >4h');
    }
    if (fs.existsSync(SEARCH_CONFIRMED) && isStale(SEARCH_CONFIRMED)) {
      cleanToken(SEARCH_CONFIRMED);
      auditLog('stale-cleanup', 'search-confirmed >4h');
    }

    const hasBugfix = fs.existsSync(BUGFIX_PENDING);
    const hasSearch = fs.existsSync(SEARCH_CONFIRMED);

    // Anti-Pattern #15: Control flow modification pending path trace
    // .control-flow-pending created by code-quality-check when EXISTING control flow modified
    // Blocks next Edit until agent acknowledges by writing new .preflight-token (which cleans token)
    if (fs.existsSync(CF_PENDING) && !isStale(CF_PENDING)) {
      let cfInfo = '';
      try { cfInfo = fs.readFileSync(CF_PENDING, 'utf8').trim(); } catch {}
      // Clean token if preflight-token was rewritten AFTER the CF pending was created
      const TOKEN = path.join(ROOT, '.preflight-token');
      if (fs.existsSync(TOKEN)) {
        try {
          const cfTs = fs.statSync(CF_PENDING).mtimeMs;
          const pfTs = fs.statSync(TOKEN).mtimeMs;
          if (pfTs > cfTs) {
            // Preflight written AFTER control flow edit → agent acknowledged
            cleanToken(CF_PENDING);
            auditLog('cf-cleared', 'preflight-token newer than control-flow-pending');
            // Fall through to normal flow
          } else {
            // Preflight is older → agent hasn't re-analyzed
            process.stderr.write([
              '',
              '══════════════════════════════════════════════════════════════',
              '  FIX WITHOUT TRACE BLOCKED (Anti-Pattern #15)',
              '══════════════════════════════════════════════════════════════',
              '',
              '  You modified EXISTING control flow but have NOT written',
              '  a new preflight-token with path trace analysis.',
              '',
              cfInfo ? '  Context: ' + cfInfo.slice(0, 200) : '',
              '',
              '  REQUIRED:',
              '  1. Write a NEW .preflight-token with updated pre_mortem',
              '     that traces TRUE, FALSE, and EDGE CASE paths',
              '  2. Then your next Edit will be unblocked',
              '',
              '══════════════════════════════════════════════════════════════',
              '',
            ].filter(Boolean).join('\n'));
            auditLog('BLOCKED', 'control-flow-pending: ' + cfInfo.slice(0, 100));
            process.exit(2);
          }
        } catch { cleanToken(CF_PENDING); } // parse error → clean
      } else {
        // No preflight at all → block
        process.stderr.write('FIX WITHOUT TRACE BLOCKED: Write .preflight-token with path trace before editing.\n');
        auditLog('BLOCKED', 'no preflight after control flow change');
        process.exit(2);
      }
    }

    // Research gate — Perplexity-style mandatory web search
    const RESEARCH_PENDING = path.join(ROOT, '.research-pending');
    const RESEARCH_DONE = path.join(ROOT, '.research-done');
    if (fs.existsSync(RESEARCH_PENDING)) {
      // Clean stale (>30 min)
      try {
        const rp = JSON.parse(fs.readFileSync(RESEARCH_PENDING, 'utf8'));
        if (rp.expires_at && Date.now() > rp.expires_at) {
          cleanToken(RESEARCH_PENDING);
          cleanToken(RESEARCH_DONE);
          auditLog('stale-cleanup', 'research-pending expired');
        } else {
          const minSearches = rp.min_searches || 1;
          let doneCount = 0;
          if (fs.existsSync(RESEARCH_DONE)) {
            try { doneCount = JSON.parse(fs.readFileSync(RESEARCH_DONE, 'utf8')).count || 0; } catch {}
          }
          if (doneCount < minSearches) {
            process.stderr.write([
              '',
              '══════════════════════════════════════════════════════════════',
              doneCount === 0
                ? '  🔬 RESEARCH REQUIRED (Perplexity-style enforcement)'
                : '  🔬 RESEARCH INCOMPLETE (' + doneCount + '/' + minSearches + ')',
              '══════════════════════════════════════════════════════════════',
              '',
              '  User requested web research. You MUST use WebSearch tool',
              '  at least ' + minSearches + 'x before editing code.',
              '',
              '  Current: ' + doneCount + '/' + minSearches + ' searches completed.',
              '',
              '  REQUIRED: Use WebSearch or WebFetch tool to research.',
              '  ci-tracker.cjs will automatically count your searches.',
              '',
              '══════════════════════════════════════════════════════════════',
              '',
            ].join('\n'));
            auditLog('BLOCKED', 'research: ' + doneCount + '/' + minSearches);
            process.exit(2);
          }
          // Research complete — continue to normal flow
        }
      } catch { cleanToken(RESEARCH_PENDING); } // parse error → clean
    }

    // Case 1: No bugfix pending → normal flow
    if (!hasBugfix) {
      process.exit(0);
    }

    // Case 2: Both tokens → debt cleared, clean both, allow edit
    if (hasBugfix && hasSearch) {
      auditLog('debt-cleared', 'both tokens present → cleaned');
      cleanToken(BUGFIX_PENDING);
      cleanToken(SEARCH_CONFIRMED);
      audit("allow", "passed all checks");
  process.exit(0);
    }

    // Case 3: Bugfix pending but no search → BLOCK
    let bugfixInfo = '';
    try { bugfixInfo = fs.readFileSync(BUGFIX_PENDING, 'utf8').trim(); } catch {}

    process.stderr.write([
      '',
      '══════════════════════════════════════════════════════════════',
      '  FIND-ONE-SEARCH-ALL BLOCKED (Law 3 — Exhaustion)',
      '══════════════════════════════════════════════════════════════',
      '',
      '  You fixed a bug but have NOT searched the project for',
      '  similar instances.',
      '',
      bugfixInfo ? '  Context: ' + bugfixInfo : '',
      '',
      '  REQUIRED:',
      '  1. Use the Grep tool to search the ENTIRE project',
      '     for the same bug pattern',
      '  2. search-confirm.cjs will auto-create .search-confirmed',
      '  3. Then your next Edit will be unblocked',
      '',
      '  Emergency override: echo "override" > .search-confirmed',
      '',
      '══════════════════════════════════════════════════════════════',
      '',
    ].filter(Boolean).join('\n'));

    auditLog('BLOCKED', bugfixInfo || 'no context');
    process.exit(2);

  } catch (e) {
    // Fail-closed: ANY crash → block edit (safe default)
    process.stderr.write('HOOK CRASH [search-gate]: ' + (e.message || e) + ' — BLOCKING\n');
    auditLog('CRASH', e.message || String(e));
    process.exit(2);
  }
});
