#!/usr/bin/env node
/**
 * FileChanged hook — tamper detection for critical files.
 *
 * Watches .claude/settings.json and .claude/hooks/*.cjs for
 * unauthorized modifications. Based on CVE-2025-59536 research:
 * hooks in settings.json can be weaponized for RCE.
 *
 * Advisory only — FileChanged cannot block (per SDK docs).
 * Logs all changes to audit trail for forensic analysis.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const AUDIT_LOG = path.join(process.cwd(), '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = data.file_path || '';
    const eventType = data.event_type || 'unknown';

    const isCritical =
      filePath.includes('.claude/settings.json') ||
      filePath.includes('.claude/hooks/') ||
      filePath.includes('CLAUDE.md') ||
      filePath.includes('.env');

    // Log all watched file changes
    const entry = JSON.stringify({
      ts: Date.now(),
      hook: 'file-changed-guard',
      event: 'file-change',
      file: filePath.slice(-80),
      type: eventType,
      critical: isCritical,
    }) + '\n';
    try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}

    if (isCritical) {
      process.stderr.write(
        `\n🚨 CRITICAL FILE CHANGED EXTERNALLY!\n` +
        `  File: ${filePath}\n` +
        `  Event: ${eventType}\n` +
        `  This could indicate: hook tampering (CVE-2025-59536), settings override, or .env exposure.\n` +
        `  Review the change immediately before continuing.\n\n`
      );
    }
  } catch {}

  process.exit(0);
});
