#!/usr/bin/env node
/**
 * ZenFlow auto-context hook wrapper.
 *
 * Keeps Claude hook registration in the existing .cjs convention while the
 * implementation lives in tools/zenflow-context/auto-context.mjs.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const script = path.join(root, 'tools', 'zenflow-context', 'auto-context.mjs');
const args = [script, '--hook', ...process.argv.slice(2)];

let input = '';
try {
  input = fs.readFileSync(0, 'utf8');
} catch {}

const result = spawnSync(process.execPath, args, {
  cwd: root,
  input,
  encoding: 'utf8',
  timeout: 8000,
  windowsHide: true,
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}

process.exit(result.status || 0);
