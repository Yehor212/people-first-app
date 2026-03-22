#!/usr/bin/env node
/**
 * PreToolUse hook for Edit|Write — Protected file gate.
 *
 * BLOCKS edits to sensitive files that should never be modified by the agent.
 * Uses stdin JSON (tool_input.file_path), NOT env vars.
 *
 * Two protection tiers:
 * - BLOCKED: always blocked (secrets, audit log)
 * - UNLOCK_PROTECTED: blocked unless .claude-md-unlock token exists (project config)
 *   User creates token manually: echo 1 > .claude-md-unlock
 *   Token is one-time — consumed after single allowed edit.
 *
 * Note: CLAUDE_FILE_PATH env var does NOT exist in Claude Code SDK
 * (GitHub issues #9567, #23742). Always parse stdin JSON.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const BLOCKED = [
  '.env',
  '.env.local',
  '.env.production',
  'android/keystore',
  'supabase/functions/_shared/auth.ts',
  '.claude-audit.log',
];

// Protected but unlockable — prevents self-tampering (AAI006)
// User can create .claude-md-unlock to allow one edit
const UNLOCK_PROTECTED = ['CLAUDE.md', '.claude/settings.json'];
const UNLOCK_TOKEN = path.join(ROOT, '.claude-md-unlock');

function block(reason) {
  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = (data.tool_input?.file_path || '').replace(/\\/g, '/');

    if (!filePath) {
      process.exit(0); // No file path — not our concern
    }

    const basename = filePath.split('/').pop();

    const isBlocked = BLOCKED.some(b => {
      // For .env files, match exact basename to avoid blocking .env-example, .env.sample
      if (b.startsWith('.env')) return basename === b;
      // For path-based patterns, match substring
      return filePath.includes(b);
    });

    if (isBlocked) {
      block('PROTECTED FILE: ' + filePath + '. This file must not be modified by the agent.');
    }

    // Tier 2: Unlock-protected files (CLAUDE.md, settings.json) — AAI006 self-tampering prevention
    const isUnlockProtected = UNLOCK_PROTECTED.some(b => {
      if (b === 'CLAUDE.md') return basename === b;
      return filePath.includes(b);
    });
    if (isUnlockProtected) {
      try {
        if (fs.existsSync(UNLOCK_TOKEN)) {
          fs.unlinkSync(UNLOCK_TOKEN); // One-time token consumed
          // Allow this edit — fall through
        } else {
          block('PROTECTED FILE: ' + filePath + '. Create .claude-md-unlock to allow one edit: echo 1 > .claude-md-unlock');
        }
      } catch {
        // Race condition on token — fail-closed
        block('PROTECTED FILE: ' + filePath + ' (token check failed). Create .claude-md-unlock to allow one edit.');
      }
    }
  } catch (e) {
    process.stderr.write('HOOK ERROR [protected-files]: ' + (e.message || e) + '\n');
    process.exit(2); // Fail-closed — block on error
  }
  process.exit(0);
});
