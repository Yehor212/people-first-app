#!/usr/bin/env node
/**
 * SessionStart hook — workspace integrity check on session start.
 *
 * Runs once per session. Checks:
 * 1. All hook files exist on disk
 * 2. Cleans stale token files from crashed/abandoned sessions (>4 hours old)
 * 3. Reports any integrity issues via additionalContext
 *
 * Source: disler/claude-code-hooks-mastery, openguardrails static scanning concept
 * Advisory only — never blocks.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const HOOKS_DIR = path.join(ROOT, '.claude/hooks');

// AUTO-POPULATED from settings.json (primary source) with manual fallback.
// Root cause fix: eliminates manual list as single source of truth.
// settings.json = SDK registration (authoritative). Manual = fallback if parse fails.
const FALLBACK_HOOKS = [
  'protected-files.cjs', 'preflight-gate.cjs', 'goal-drift-check.cjs',
  'preflight-inject.cjs', 'ide-diagnostic-gate.cjs', 'auto-format.cjs',
  'output-taint-check.cjs', 'quality-stop-gate.cjs', 'commit-gate.cjs',
  'pre-compact.cjs', 'session-start.cjs',
  'subagent-start.cjs', 'tool-failure-log.cjs',
  'subagent-stop.cjs', 'session-end.cjs', 'stop-failure-log.cjs', 'config-change-log.cjs',
  'post-compact.cjs', 'instructions-loaded.cjs', 'notification-log.cjs',
  'permission-request-log.cjs', 'worktree-create-log.cjs', 'worktree-remove-log.cjs',
  'elicitation-log.cjs', 'elicitation-result-log.cjs', 'teammate-idle-gate.cjs',
  'task-completed-gate.cjs',
  'search-gate.cjs', 'search-confirm.cjs',
  'ci-tracker.cjs',
  'bandaid-gate.cjs', 'code-quality-check.cjs',
  'tool-guard.cjs',
];

// Auto-discover hooks from settings.json (root cause: eliminate manual sync)
let EXPECTED_HOOKS;
try {
  const settingsPath = path.join(ROOT, '.claude/settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const discovered = new Set();
  for (const matchers of Object.values(settings.hooks || {})) {
    for (const matcher of matchers) {
      for (const hook of (matcher.hooks || [])) {
        const name = (hook.command || '').split('/').pop();
        if (name && name.endsWith('.cjs')) discovered.add(name);
      }
    }
  }
  EXPECTED_HOOKS = [...discovered];
} catch {
  EXPECTED_HOOKS = FALLBACK_HOOKS;
}

// Support modules (require()'d by hooks, not standalone hooks)
const EXPECTED_MODULES = [
  'preflight-validate.cjs', 'reflection-validate.cjs', 'evidence-veracity.cjs',
];

const STALE_TOKENS = [
  '.preflight-token', '.postflight-done', '.fullcycle-active', '.fullcycle-laws-read',
  '.bugfix-pending', '.search-confirmed',
  '.ci-evidence', '.ide-ack-pending', '.ide-ack-done', '.worktree-verify-pending',
  '.snyk-pending', '.snyk-scan-done', '.control-flow-pending',
  '.research-pending', '.research-done',
];
const STALE_THRESHOLD_MS = 4 * 3600 * 1000; // 4 hours

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  const warnings = [];

  // 1. Check hook files exist
  for (const hook of EXPECTED_HOOKS) {
    const hookPath = path.join(HOOKS_DIR, hook);
    if (!fs.existsSync(hookPath)) {
      warnings.push('MISSING HOOK: ' + hook + ' — enforcement may be degraded');
    }
  }

  // 1b. Check support modules exist
  for (const mod of EXPECTED_MODULES) {
    const modPath = path.join(HOOKS_DIR, mod);
    if (!fs.existsSync(modPath)) {
      warnings.push('MISSING MODULE: ' + mod + ' — validation may be degraded');
    }
  }

  // 1b-extra. Check hook file recency (Pillar 5 staleness)
  try {
    let oldestDays = 0;
    for (const hook of EXPECTED_HOOKS) {
      try {
        const stat = fs.statSync(path.join(HOOKS_DIR, hook));
        const days = (Date.now() - stat.mtimeMs) / 86400000;
        if (days > oldestDays) oldestDays = days;
      } catch {}
    }
    if (oldestDays > 60) {
      warnings.push('STALE ENFORCEMENT: oldest hook is ' + Math.round(oldestDays) + 'd old — review needed');
    }
  } catch {}

  // 1c. DRIFT DETECTION: settings.json hooks ↔ EXPECTED_HOOKS ↔ test coverage
  // This is the "забыл что делать" safety net — detects when you add a hook
  // to settings.json but forget to update EXPECTED_HOOKS or add tests.
  try {
    const settingsPath = path.join(ROOT, '.claude/settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const registeredHooks = new Set();
    for (const matchers of Object.values(settings.hooks || {})) {
      for (const matcher of matchers) {
        for (const hook of (matcher.hooks || [])) {
          const name = (hook.command || '').split('/').pop();
          if (name) registeredHooks.add(name);
        }
      }
    }
    const expectedSet = new Set(EXPECTED_HOOKS);

    // Hooks in settings.json but NOT in EXPECTED_HOOKS — newly added, forgot to register
    const inSettingsNotExpected = [...registeredHooks].filter(h => !expectedSet.has(h));
    if (inSettingsNotExpected.length > 0) {
      warnings.push(
        'HOOK DRIFT: ' + inSettingsNotExpected.join(', ') + ' registered in settings.json but NOT in EXPECTED_HOOKS!\n' +
        '    → Add to EXPECTED_HOOKS[] in session-start.cjs\n' +
        '    → Add tests in test-all-hooks.cjs\n' +
        '    → Update CLAUDE.md hook count'
      );
    }

    // Hooks in EXPECTED_HOOKS but NOT in settings.json — removed but forgot to clean up
    const inExpectedNotSettings = EXPECTED_HOOKS.filter(h => !registeredHooks.has(h));
    if (inExpectedNotSettings.length > 0) {
      warnings.push(
        'HOOK DRIFT: ' + inExpectedNotSettings.join(', ') + ' in EXPECTED_HOOKS but NOT registered in settings.json!\n' +
        '    → Either add to settings.json or remove from EXPECTED_HOOKS[]'
      );
    }
  } catch { /* settings.json parse error — skip drift check */ }

  // 1d. SYNTAX VALIDATION: node --check on all blocking hooks (fail-open prevention)
  // If a hook has a syntax error, Node.js crashes with exit(1) = SDK fail-open = enforcement DISABLED.
  // Pre-validating syntax catches this BEFORE hooks run.
  // Research: Stefan Judis, Husky fail-closed pattern, spawn-wrap reliability.
  try {
    const { execSync } = require('child_process');
    const syntaxErrors = [];
    for (const hookFile of EXPECTED_HOOKS) {
      const hookPath = path.join(HOOKS_DIR, hookFile);
      if (!fs.existsSync(hookPath)) continue;
      try {
        execSync('node --check "' + hookPath.replace(/\\/g, '/') + '"', {
          stdio: 'pipe', timeout: 5000
        });
      } catch {
        syntaxErrors.push(hookFile);
      }
    }
    if (syntaxErrors.length > 0) {
      warnings.push(
        'SYNTAX ERROR in hooks: ' + syntaxErrors.join(', ') + '!\n' +
        '    → These hooks will CRASH (exit 1) = SDK fail-open = enforcement DISABLED\n' +
        '    → Fix syntax errors immediately to restore enforcement'
      );
    }
  } catch { /* execSync unavailable — skip */ }

  // 1e. TEST COVERAGE: check that each hook is mentioned in test-all-hooks.cjs
  try {
    const testFile = fs.readFileSync(path.join(HOOKS_DIR, 'test-all-hooks.cjs'), 'utf8');
    const untestedHooks = EXPECTED_HOOKS.filter(h => !testFile.includes(h));
    if (untestedHooks.length > 0) {
      warnings.push(
        'UNTESTED HOOKS: ' + untestedHooks.join(', ') + ' not found in test-all-hooks.cjs!\n' +
        '    → Add tests for each hook before committing'
      );
    }
  } catch { /* test file not found — skip */ }

  // 2. Clean stale tokens (>4 hours old = abandoned session)
  for (const token of STALE_TOKENS) {
    const tokenPath = path.join(ROOT, token);
    try {
      if (fs.existsSync(tokenPath)) {
        const stat = fs.statSync(tokenPath);
        const ageMs = Date.now() - stat.mtimeMs;
        if (ageMs > STALE_THRESHOLD_MS) {
          fs.unlinkSync(tokenPath);
          warnings.push('CLEANED stale token: ' + token + ' (age: ' + Math.round(ageMs / 3600000) + 'h)');
        }
      }
    } catch { /* ignore cleanup errors */ }
  }

  // 3. Build context — ALWAYS inject enforcement reminder (survives compaction via source="compact")
  // Dynamic counts — future-proof: adding hooks auto-updates the numbers
  // Uses JS file reading (not grep) to avoid self-matching meta-bug
  let hookCount = EXPECTED_HOOKS.length;
  let blockingCount = 0;
  const EXIT_PATTERN = 'process.exit' + '(2)'; // split to avoid self-match in grep
  try {
    for (const hook of EXPECTED_HOOKS) {
      const content = fs.readFileSync(path.join(HOOKS_DIR, hook), 'utf8');
      if (content.includes(EXIT_PATTERN)) blockingCount++;
    }
  } catch { blockingCount = 5; /* fallback */ }
  const advisoryCount = hookCount - blockingCount;

  const enforcementReminder = [
    'ENFORCEMENT: Hooks enforce rules automatically.',
    'preflight-gate blocks edits without token.',
    'commit-gate blocks commits without .verification-done.',
    'PostToolUse A6-A10 warnings fire after every edit.',
    'Agent hook on Stop runs verifier automatically.',
  ].join('\n');

  let context = enforcementReminder;
  if (warnings.length > 0) {
    context += '\n\nSESSION INTEGRITY WARNINGS:\n' + warnings.map(w => '  - ' + w).join('\n');
  }

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context,
    },
  }));

  process.exit(0);
});
