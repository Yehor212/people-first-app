#!/usr/bin/env node
/**
 * PreToolUse hook (Bash) — Anti-Pattern #18: Tool Blindness
 *
 * BLOCKS Bash commands that duplicate MCP tool functionality.
 * Redirects agent to use proper MCP tools instead.
 *
 * Blocking (exit 2): psql, curl supabase, npx playwright
 * Advisory (stderr): npm audit, grep -r
 * Fail-open: parse errors → exit 0 (don't break Bash)
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

function audit(action) {
  try {
    const line = new Date().toISOString() + ' [tool-guard] ' + action + '\n';
    fs.appendFileSync(AUDIT_LOG, line);
  } catch { /* best-effort */ }
}

// Blocking rules — exit(2), agent MUST use MCP instead
const BLOCKING_RULES = [
  {
    pattern: /\bpsql\b|\bpg_dump\b|\bpg_restore\b/,
    redirect: 'mcp__supabase-db__execute_sql',
    reason: 'Direct DB access bypasses RLS. Use Supabase MCP tool instead.',
  },
  {
    pattern: /\bcurl\b.*supabase\.(co|in|com)/,
    redirect: 'Supabase MCP tools (execute_sql, get_logs, list_tables)',
    reason: 'Supabase API calls should use typed MCP tools for safety.',
  },
  {
    pattern: /\bnpx\s+playwright\b|\bnpx\s+pw\b/,
    redirect: 'mcp__playwright__* tools (browser_navigate, browser_snapshot, etc.)',
    reason: 'Playwright MCP provides structured browser automation.',
  },
  {
    pattern: /\bwget\b.*supabase\.(co|in|com)/,
    redirect: 'Supabase MCP tools (execute_sql, get_logs, list_tables)',
    reason: 'Supabase API calls should use typed MCP tools. wget bypass blocked.',
  },
];

// Advisory rules — stderr warning, not blocking
const ADVISORY_RULES = [
  {
    pattern: /\bnpm\s+audit\b/,
    suggestion: 'Consider using Snyk MCP (snyk_sca_scan) for better vulnerability analysis.',
  },
  {
    pattern: /\bgrep\s+(-r|--recursive)\b/,
    suggestion: 'Consider using the Grep tool instead of bash grep for better UX.',
  },
];

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // Only check Bash tool
    if (data.tool_name !== 'Bash') {
      process.exit(0);
    }

    const command = (data.tool_input && data.tool_input.command) || '';
    if (!command) {
      process.exit(0);
    }

    // Check blocking rules
    for (const rule of BLOCKING_RULES) {
      if (rule.pattern.test(command)) {
        audit('BLOCKED: "' + command.substring(0, 80) + '" → ' + rule.redirect);
        process.stderr.write(
          '\n🚫 TOOL BLINDNESS BLOCKED (Anti-Pattern #18)\n' +
          'Command: ' + command.substring(0, 100) + '\n' +
          'Reason: ' + rule.reason + '\n' +
          'Use instead: ' + rule.redirect + '\n\n'
        );
        process.exit(2);
      }
    }

    // Check advisory rules
    for (const rule of ADVISORY_RULES) {
      if (rule.pattern.test(command)) {
        audit('ADVISORY: "' + command.substring(0, 80) + '" → ' + rule.suggestion);
        process.stderr.write(
          '\n⚠️ TOOL SUGGESTION: ' + rule.suggestion + '\n'
        );
        // Don't exit(2) — advisory only
      }
    }

    process.exit(0);
  } catch (e) {
    // Fail-open — don't break Bash on parse error
    process.stderr.write('HOOK WARNING [tool-guard]: parse error, failing open\n');
    process.exit(0);
  }
});
