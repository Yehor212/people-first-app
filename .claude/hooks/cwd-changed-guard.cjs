#!/usr/bin/env node
/**
 * CwdChanged hook — escape-directory prevention.
 *
 * Warns if the working directory changes outside the project root.
 * Production incident: agents can `cd /` and operate on system files.
 * Advisory only — CwdChanged cannot block (per SDK docs).
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
    const newCwd = data.new_cwd || '';
    const oldCwd = data.old_cwd || '';

    // Log directory change
    const entry = JSON.stringify({
      ts: Date.now(),
      hook: 'cwd-changed-guard',
      event: 'cwd-change',
      from: oldCwd.slice(-50),
      to: newCwd.slice(-50),
    }) + '\n';
    try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}

    // Warn if leaving project root
    const projectRoot = oldCwd || process.cwd();
    if (newCwd && !newCwd.startsWith(projectRoot)) {
      process.stderr.write(
        `\n⚠️ DIRECTORY ESCAPE DETECTED!\n` +
        `  From: ${oldCwd}\n` +
        `  To:   ${newCwd}\n` +
        `  This may indicate the agent is operating outside the project.\n\n`
      );
    }
  } catch {}

  process.exit(0);
});
