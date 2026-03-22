#!/usr/bin/env node
/**
 * PostToolUse hook for Edit/Write on TypeScript files.
 * Injects additionalContext reminding about:
 * 1. IDE diagnostics — read and react to errors NOW
 * 2. Evidence tags — did you READ what you're modifying?
 * 3. Hallucination guard — is your mental model fresh?
 *
 * This is advisory (cannot block Edit retroactively) but fires
 * EVERY time, making it impossible to "forget" diagnostics.
 *
 * Also invalidates .postflight-done token on new TS edits
 * (marker invalidation pattern — anthropics/claude-code#29795).
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const POSTFLIGHT = path.join(ROOT, '.postflight-done');
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = data.tool_input?.file_path || data.tool_input?.path || '';

    // Only fire for TypeScript/TSX files
    if (!filePath.match(/\.(ts|tsx)$/)) {
      process.exit(0);
    }

    // Invalidate POST-FLIGHT token on new TS edits (marker invalidation — issue #29795)
    // If postflight-done exists and we're editing TS, it means new code after POST-FLIGHT → stale token
    try {
      if (fs.existsSync(POSTFLIGHT)) {
        fs.unlinkSync(POSTFLIGHT);
        const entry = JSON.stringify({ ts: Date.now(), hook: 'ide-diagnostic-gate', event: 'invalidate-postflight', file: filePath.slice(-80) }) + '\n';
        try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
      }
    } catch { /* race condition: already deleted by parallel edit — safe to ignore */ }

    // §A: Create .ide-ack-pending token — blocks next Edit until IDE diagnostics acknowledged
    const IDE_ACK_PENDING = path.join(ROOT, '.ide-ack-pending');
    try {
      fs.writeFileSync(IDE_ACK_PENDING, JSON.stringify({ file: filePath.slice(-80), ts: Date.now() }), 'utf8');
    } catch { /* non-critical — advisory enhancement */ }

    const reminder = [
      'IDE DIAGNOSTIC GATE (PostToolUse):',
      '1. READ <ide_diagnostics> in this response RIGHT NOW.',
      '   - If ANY Error exists → FIX before next Edit/Write.',
      '   - "tsc clean" ≠ "IDE clean" — BOTH must be 0 errors.',
      '2. EVIDENCE CHECK: Did you [READ: file:line] the code you just modified,',
      '   or are you editing based on [ASSUMED] knowledge?',
      '   If [ASSUMED] → re-read the file before continuing.',
      '3. If this is your LAST edit → POST-FLIGHT fires NOW.',
      '4. FIND-ONE-SEARCH-ALL: If this edit fixes a bug/pattern, create the token NOW:',
      '   echo "pattern: [describe bug]" > .bugfix-pending',
      '   Next Edit will be BLOCKED until you Grep project-wide (search-gate.cjs).',
    ].join('\n');

    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: reminder,
      },
    }));
  } catch (e) {
    process.stderr.write('HOOK ERROR [ide-diagnostic-gate]: ' + (e.message || e) + '\n');
    // Advisory hook — don't block on error
  }
});
