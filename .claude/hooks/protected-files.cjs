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
const HOOK_NAME = "protected-files";
function audit(event, detail) {
  try { var e = JSON.stringify({ ts: Date.now(), hook: HOOK_NAME, event, detail });
    require("fs").appendFileSync(require("path").join(ROOT, ".claude-audit.log"), e + String.fromCharCode(10));
  } catch {}
}


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
    // Tier 3: Hook Integrity Ratchet (Law of Irrationality — system assumes agent WILL try to weaken rules)
    // Edits to .claude/hooks/*.cjs are ALLOWED only if they don't weaken enforcement.
    // Weakening = decreasing count of: process.exit(2), errors.push(, regex patterns (/.../)
    // Research: GAI framework, ratchet monotonicity, behavioral economics nudge theory
    const relPath = filePath.replace(ROOT.replace(/\\/g, '/'), '').replace(/^\//, '');
    if (relPath.startsWith('.claude/hooks/') && relPath.endsWith('.cjs') && !relPath.includes('test-all-hooks')) {
      const newCode = data.tool_input?.new_string || data.tool_input?.content || '';
      if (newCode.length > 0) {
        try {
          const { execSync } = require('child_process');
          // Get the git HEAD version of this file
          const gitPath = relPath.replace(/\\/g, '/');
          const oldCode = execSync('git show HEAD:' + gitPath, {
            cwd: ROOT, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe']
          });

          // Count enforcement markers in old vs new
          const countMarkers = (code) => ({
            exit2: (code.match(/process\.exit\(2\)/g) || []).length,
            errorsPush: (code.match(/errors\.push\(/g) || []).length,
            regexPatterns: (code.match(/regex:\s*\//g) || []).length + (code.match(/pattern:\s*\//g) || []).length,
            blockCalls: (code.match(/block\(/g) || []).length,
          });

          const oldMarkers = countMarkers(oldCode);
          const newMarkers = countMarkers(newCode);

          // For Edit tool: new_string is only the replacement, not the full file.
          // Only flag if the new_string EXPLICITLY removes markers (contains fewer than it replaces)
          // For Write tool: content is the full file — compare totals
          const isWriteTool = !!data.tool_input?.content;

          if (isWriteTool) {
            // Full file comparison — any decrease in markers = weakening
            const weakened = [];
            if (newMarkers.exit2 < oldMarkers.exit2) weakened.push('process.exit(2): ' + oldMarkers.exit2 + ' → ' + newMarkers.exit2);
            if (newMarkers.errorsPush < oldMarkers.errorsPush) weakened.push('errors.push(: ' + oldMarkers.errorsPush + ' → ' + newMarkers.errorsPush);
            if (newMarkers.blockCalls < oldMarkers.blockCalls) weakened.push('block(: ' + oldMarkers.blockCalls + ' → ' + newMarkers.blockCalls);

            if (weakened.length > 0) {
              block('HOOK INTEGRITY RATCHET: Cannot weaken enforcement in ' + basename + '.\n' +
                'Weakened markers: ' + weakened.join(', ') + '\n' +
                'Hooks can only be STRENGTHENED (add checks), never WEAKENED (remove checks).\n' +
                'Law of Irrationality: the system assumes you WILL try to simplify.');
            }
          }
          // For Edit tool: we check if old_string contained markers that new_string removes
          else {
            const oldStr = data.tool_input?.old_string || '';
            const oldStrMarkers = countMarkers(oldStr);
            const newStrMarkers = countMarkers(newCode);

            const weakened = [];
            if (oldStrMarkers.exit2 > newStrMarkers.exit2) weakened.push('process.exit(2) removed');
            if (oldStrMarkers.errorsPush > newStrMarkers.errorsPush) weakened.push('errors.push( removed');
            if (oldStrMarkers.blockCalls > newStrMarkers.blockCalls) weakened.push('block( call removed');

            if (weakened.length > 0) {
              block('HOOK INTEGRITY RATCHET: Cannot weaken enforcement in ' + basename + '.\n' +
                'Removed markers: ' + weakened.join(', ') + '\n' +
                'Hooks can only be STRENGTHENED (add checks), never WEAKENED (remove checks).\n' +
                'Law of Irrationality: the system assumes you WILL try to simplify.');
            }
          }
        } catch (gitErr) {
          // If git show fails (file not yet committed), allow the edit
          // New files can't weaken what doesn't exist
          if (!gitErr.message?.includes('exists on disk')) {
            // Legitimate git error — allow (don't block new hook creation)
          }
        }
      }
    }
  } catch (e) {
    process.stderr.write('HOOK ERROR [protected-files]: ' + (e.message || e) + '\n');
    process.exit(2); // Fail-closed — block on error
  }
  audit("allow", "passed all checks");
  process.exit(0);
});
