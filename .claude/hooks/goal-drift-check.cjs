#!/usr/bin/env node
/**
 * PreToolUse hook for Edit/Write — Goal Drift Detection (ReflAct pattern).
 *
 * ADVISORY (never blocks) — injects goal anchor as additionalContext
 * before every TypeScript edit, so the agent continuously sees its goal.
 *
 * Reads the GOAL line from .preflight-token (line 2) and reminds the agent
 * what it's working toward. This implements continuous goal re-anchoring
 * (ReflAct, EMNLP 2025: +27.7% task success).
 *
 * AgentSpec tuple: (Edit/Write on .ts/.tsx, .preflight-token has GOAL, ADVISORY)
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TOKEN = path.join(ROOT, '.preflight-token');

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = (data.tool_input?.file_path || '').replace(/\\/g, '/');

    // Only fire for TypeScript files
    if (!filePath.match(/\.(ts|tsx)$/)) {
      process.exit(0);
    }

    // Skip if no preflight token (preflight-gate will block anyway)
    if (!fs.existsSync(TOKEN)) {
      process.exit(0);
    }

    // Read goal from token — supports both structured JSON and legacy format
    const content = fs.readFileSync(TOKEN, 'utf8').replace(/^\uFEFF/, '').trim();
    let goal = '';
    let goalFiles = [];

    if (content.startsWith('{')) {
      // Structured JSON format — extract goal and file paths from evidence
      try {
        const parsed = JSON.parse(content);
        goal = (parsed.goal || '').replace(/^GOAL:\s*/i, '').trim();
        // Extract file paths mentioned in goal or evidence.read[]
        if (parsed.evidence && Array.isArray(parsed.evidence.read)) {
          goalFiles = parsed.evidence.read.map(r => r.split(':')[0].split('/').pop()).filter(Boolean);
        }
      } catch { /* parse error — fall through to legacy */ }
    }

    if (!goal) {
      // Legacy format — line 2: "GOAL: ..."
      const lines = content.split('\n');
      const goalLine = lines.find(l => l.trim().startsWith('GOAL:'));
      if (!goalLine) {
        process.exit(0);
      }
      goal = goalLine.replace(/^GOAL:\s*/, '').trim();
    }

    const relPath = filePath.replace(ROOT.replace(/\\/g, '/'), '').replace(/^\//, '');
    const editedFile = relPath.split('/').pop();

    // §G: Enhanced path comparison — check if edited file is in goal's scope
    let driftWarning = '';
    if (goalFiles.length > 0 && editedFile) {
      const inScope = goalFiles.some(gf => editedFile.includes(gf) || gf.includes(editedFile));
      if (!inScope) {
        driftWarning = ` ⚠️ GOAL DRIFT: Editing "${editedFile}" but goal evidence mentions [${goalFiles.slice(0, 5).join(', ')}]. Explain scope expansion.`;
      }
    }

    // Inject goal anchor — advisory context for all edits
    const anchorMsg = `GOAL ANCHOR: Your stated goal is: "${goal.slice(0, 200)}". ` +
      `Current edit: ${relPath}.` +
      (driftWarning || ' If on-track, continue. If unrelated, explain the connection.');

    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: anchorMsg,
      },
    }));
    process.exit(0);
  } catch (e) {
    process.stderr.write('HOOK ERROR [goal-drift-check]: ' + (e.message || e) + '\n');
    process.exit(0); // Don't block on error
  }
});
