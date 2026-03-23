#!/usr/bin/env node
/**
 * PostToolUse hook — CI execution tracker + Research tracker.
 *
 * 1. Records CI-related Bash commands to .ci-evidence (tsc, vitest, eslint).
 * 2. Records WebSearch/WebFetch/Agent usage to .research-done (Perplexity-style enforcement).
 *
 * Advisory only — exit(0). Never blocks execution.
 * Proof-of-Execution (PoE): evidence generated DURING execution, not reconstructed.
 *
 * Registered for: Bash|WebSearch|WebFetch|Agent
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CI_EVIDENCE = path.join(ROOT, '.ci-evidence');
const RESEARCH_PENDING = path.join(ROOT, '.research-pending');
const RESEARCH_DONE = path.join(ROOT, '.research-done');

const CI_PATTERNS = [
  { pattern: /npm\s+run\s+ci:preflight/i, label: 'ci:preflight' },
  { pattern: /npm\s+run\s+ratchet:check/i, label: 'ratchet:check' },
  { pattern: /npx\s+eslint/i, label: 'eslint' },
  { pattern: /tsc\s+--noEmit/i, label: 'tsc' },
  { pattern: /npx\s+tsc/i, label: 'tsc' },
  { pattern: /vitest\s+run/i, label: 'vitest' },
];

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cmd = data.tool_input?.command || data.toolInput?.command || '';

    // Only record SUCCESSFUL CI runs — failing commands should NOT create evidence
    // PostToolUse provides tool_result with stdout/stderr. Check for failure indicators.
    const stdout = data.tool_result?.stdout || data.stdout || '';
    const stderr = data.tool_result?.stderr || data.stderr || '';
    const exitCode = data.tool_result?.exit_code ?? data.exit_code ?? null;

    // Skip recording if command clearly failed
    if (exitCode !== null && exitCode !== 0) {
      // Command failed — do NOT record as evidence
      process.exit(0);
    }
    // Also check stderr for common failure patterns
    if (/error|FAIL|failed|ERR!/i.test(stderr) && !/warning/i.test(stderr)) {
      process.exit(0);
    }

    for (const cp of CI_PATTERNS) {
      if (cp.pattern.test(cmd)) {
        const entry = JSON.stringify({
          ts: Date.now(),
          command: cmd.slice(0, 120),
          pattern: cp.label,
          success: true,
        });
        fs.appendFileSync(CI_EVIDENCE, entry + '\n', 'utf8');
        break;
      }
    }
    // --- Research tracking (WebSearch/WebFetch/Agent) ---
    const toolName = data.tool_name || data.toolName || '';
    const isWebSearch = toolName === 'WebSearch' || toolName === 'WebFetch';
    const isResearchAgent = toolName === 'Agent' && /research|web|search|ресерч|исследован|источник/i.test(
      data.tool_input?.prompt || data.toolInput?.prompt || data.tool_input?.description || data.toolInput?.description || ''
    );

    if ((isWebSearch || isResearchAgent) && fs.existsSync(RESEARCH_PENDING)) {
      try {
        const pending = JSON.parse(fs.readFileSync(RESEARCH_PENDING, 'utf8'));
        // Check expiry (30 min)
        if (pending.expires_at && Date.now() > pending.expires_at) {
          fs.unlinkSync(RESEARCH_PENDING);
        } else {
          // Read or create .research-done
          let done = { count: 0, queries: [], timestamp: new Date().toISOString() };
          if (fs.existsSync(RESEARCH_DONE)) {
            try { done = JSON.parse(fs.readFileSync(RESEARCH_DONE, 'utf8')); } catch {}
          }
          // Record this search
          const query = data.tool_input?.query || data.toolInput?.query || data.tool_input?.prompt || data.toolInput?.prompt || '';
          done.count = (done.count || 0) + 1;
          done.queries = done.queries || [];
          done.queries.push({ tool: toolName, query: (query || '').substring(0, 200), ts: Date.now() });
          done.timestamp = new Date().toISOString();
          fs.writeFileSync(RESEARCH_DONE, JSON.stringify(done, null, 2), 'utf8');
        }
      } catch { /* non-critical */ }
    }
  } catch { /* ignore parse errors */ }

  // Advisory — always allow
  process.exit(0);
});
