#!/usr/bin/env node
/**
 * TaskCompleted hook — BLOCKING quality gate for Agent Teams.
 *
 * Replaces task-completed-log.cjs (advisory) with enforcement:
 * 1. Implementation tasks: requires Edit/Write + vitest/tsc in transcript
 * 2. Review tasks: requires Read/Grep evidence in transcript
 *
 * exit(2) = reject completion, send feedback to teammate
 * exit(0) = task accepted as done
 * FAIL-CLOSED: any crash → exit(2) (safe default)
 *
 * SDK stdin fields: task_id, task_subject, task_description, teammate_name, team_name, transcript_path
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, '.claude-audit.log');
const HOOK_NAME = 'task-completed-gate';

function audit(event, detail) {
  const entry = JSON.stringify({ ts: Date.now(), hook: HOOK_NAME, event, detail: String(detail).slice(0, 200) }) + '\n';
  try { fs.appendFileSync(AUDIT_LOG, entry); } catch {}
}

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const taskId = (data.task_id || 'unknown').slice(0, 30);
    const taskSubject = (data.task_subject || data.task_description || 'unknown').slice(0, 80);
    const teammateName = (data.teammate_name || 'unknown').slice(0, 40);

    // Always audit (preserve from task-completed-log.cjs)
    audit('task-complete', 'taskId=' + taskId + ' subject=' + taskSubject + ' by=' + teammateName);

    // Determine task type from subject
    const isReviewTask = /review|audit|research|investigate|анализ|ревью|check|inspect|assess/i.test(taskSubject);

    // Read transcript for evidence
    const transcriptPath = data.transcript_path || '';
    let hasWork = false;
    let hasVerification = false;
    let hasReading = false;

    if (transcriptPath && fs.existsSync(transcriptPath)) {
      try {
        const stat = fs.statSync(transcriptPath);
        const readSize = Math.min(stat.size, 15000); // last 15KB
        const buf = Buffer.alloc(readSize);
        const fd = fs.openSync(transcriptPath, 'r');
        fs.readSync(fd, buf, 0, readSize, Math.max(0, stat.size - readSize));
        fs.closeSync(fd);
        const chunk = buf.toString('utf8');

        hasWork = /Edit|Write|Bash/i.test(chunk);
        hasVerification = /vitest|tsc|eslint|test.*pass|PASS|ci:preflight|npm run/i.test(chunk);
        hasReading = /Read|Grep|Glob|WebSearch|WebFetch/i.test(chunk);
      } catch {
        // Transcript read failed — conservative
      }
    }

    // Implementation tasks need code changes + verification
    if (!isReviewTask && !hasWork) {
      process.stderr.write(
        'TASK QUALITY GATE: No code changes found in transcript.\n' +
        'Task "' + taskSubject + '" requires implementation before marking done.\n' +
        'Use Edit/Write tools to make changes, then mark done.\n'
      );
      audit('BLOCKED', 'no-work: task=' + taskId);
      process.exit(2);
    }

    if (!isReviewTask && !hasVerification) {
      process.stderr.write(
        'TASK QUALITY GATE: No verification found in transcript.\n' +
        'Task "' + taskSubject + '" needs tsc + vitest before marking done.\n'
      );
      audit('BLOCKED', 'no-verification: task=' + taskId);
      process.exit(2);
    }

    // Review tasks need at least reading evidence
    if (isReviewTask && !hasReading && !hasWork) {
      process.stderr.write(
        'TASK QUALITY GATE: No reading or analysis evidence in transcript.\n' +
        'Review task "' + taskSubject + '" needs Read/Grep/Search before marking done.\n'
      );
      audit('BLOCKED', 'no-reading: task=' + taskId);
      process.exit(2);
    }

    // Task passes all checks
    audit('allow', 'task=' + taskId + ' completed by=' + teammateName);
    process.exit(0);

  } catch (e) {
    // FAIL-CLOSED: crash → block (safe default)
    process.stderr.write('HOOK CRASH [' + HOOK_NAME + ']: ' + (e.message || e) + ' — BLOCKING (fail-closed)\n');
    audit('CRASH', e.message || String(e));
    process.exit(2);
  }
});
