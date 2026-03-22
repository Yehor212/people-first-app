#!/usr/bin/env node
/**
 * ConfigChange hook — logs and monitors configuration changes.
 *
 * Fires when configuration files change (settings, policies).
 * Logs all config mutations for audit trail.
 * BLOCKS changes to project settings that could weaken enforcement.
 * Advisory for user/local settings, BLOCKING for project settings.
 *
 * Source: SDK ConfigChange event.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let configSource = 'unknown';
  try {
    const inp = JSON.parse(input);
    configSource = inp.config_source || inp.source || 'unknown';
  } catch {}

  // Log config change to audit trail
  const entry = JSON.stringify({
    ts: Date.now(),
    hook: 'config-change-log',
    event: 'config-change',
    source: configSource,
  }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}

  // Block project_settings changes (could weaken enforcement)
  if (configSource === 'project_settings') {
    console.log(JSON.stringify({
      decision: 'block',
      reason: 'PROJECT SETTINGS CHANGE BLOCKED: .claude/settings.json is protected. Create .claude-md-unlock token to allow one edit.',
    }));
    process.exit(0);
  }

  // Allow user_settings, local_settings, policy_settings, skills
  process.exit(0);
});
