/**
 * TOOL AUDIT TRAIL (Anti-Fabrication Hook)
 * Event: PostToolUse (Read, Grep, Bash, Edit, Write)
 * Purpose: Logs every tool call to .tool-audit-trail so evidence can be cross-referenced.
 *
 * The agent cannot fabricate "READ: src/file.tsx" in evidence if this hook
 * never logged a Read call for that file. Commit-gate or plan-completion-gate
 * can cross-reference claims vs actual trail.
 *
 * Format: append-only JSON lines (one per tool call)
 * { tool, file, timestamp, args }
 *
 * PROTECTED: Agent cannot write to .tool-audit-trail directly (Bash redirect blocked).
 * Only this hook appends to it.
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const trailPath = path.join(root, '.tool-audit-trail');

try {
  const input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8').toString() || '{}');
  const tool = input.tool || 'unknown';
  const now = new Date().toISOString();

  let entry = null;

  if (tool === 'Read') {
    entry = {
      tool: 'Read',
      file: input.input?.file_path || input.input?.path || '',
      timestamp: now,
    };
  } else if (tool === 'Grep') {
    entry = {
      tool: 'Grep',
      pattern: (input.input?.pattern || '').slice(0, 80),
      path: input.input?.path || '',
      timestamp: now,
    };
  } else if (tool === 'Edit' || tool === 'Write') {
    entry = {
      tool,
      file: input.input?.file_path || '',
      timestamp: now,
    };
  } else if (tool === 'Bash') {
    const cmd = (input.input?.command || '').slice(0, 120);
    // Only log meaningful commands, skip short ones
    if (cmd.length > 5) {
      entry = {
        tool: 'Bash',
        command: cmd,
        timestamp: now,
      };
    }
  }

  if (entry) {
    // Append-only: never truncate, always add
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(trailPath, line, 'utf8');
  }

} catch (_) {
  // Silent — audit trail is observability, not blocking
}

// Always exit 0 — this hook is observability, not a gate
process.exit(0);
