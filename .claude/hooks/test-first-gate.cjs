#!/usr/bin/env node
/**
 * PreToolUse hook for Edit|Write|MultiEdit — Test-first enforcement gate.
 *
 * Blocks guarded first-party production/enforcement/config code edits unless the
 * agent has recorded fresh test-first evidence before touching implementation.
 *
 * Hook input: stdin JSON required.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const HOOK_NAME = 'test-first-gate';
const TEST_FIRST_TOKEN = path.join(ROOT, '.test-first-token');
const PREFLIGHT_TOKEN = path.join(ROOT, '.preflight-token');
const MAX_TOKEN_AGE_MS = 4 * 60 * 60 * 1000;

const ALWAYS_ALLOW_PATTERNS = [
  '.test-first-token',
  '.preflight-token',
  '.postflight-done',
  '.verification-done',
  '.ci-evidence',
  '.ide-ack-pending',
  '.ide-ack-done',
  'memory/',
];

const GUARDED_PREFIXES = [
  '.claude/hooks/',
  '.claude/agents/',
  '.claude/rules/',
  '.Codex/',
  '.agents/',
  'src/',
  'scripts/',
  'supabase/',
  'android/',
  'ios/',
  'tools/ruflow-plus/',
  'tools/zenflow-context/',
];

const GUARDED_EXACT_FILES = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'ARCHITECTURE.md',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
]);

const TEST_OR_DOC_PATTERN = /(^|\/)(__tests__|test|tests|e2e|docs)(\/|$)|\.(test|spec)\.(ts|tsx|js|jsx|cjs|mjs)$/i;
const CODE_EXT_PATTERN = /\.(ts|tsx|js|jsx|cjs|mjs|cts|mts)$/i;
const CONFIG_PATTERN = /(^|\/)(tsconfig(\..+)?\.json|playwright|vite|vitest|tailwind|capacitor|eslint|postcss|knip|vercel)\b|\.toml$/i;

function audit(event, detail) {
  try {
    const line = JSON.stringify({ ts: Date.now(), hook: HOOK_NAME, event, detail }) + '\n';
    fs.appendFileSync(path.join(ROOT, '.claude-audit.log'), line);
  } catch {}
}

function normalizeRel(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const root = ROOT.replace(/\\/g, '/');
  return normalized.replace(root, '').replace(/^\/+/, '');
}

function isAllowedWithoutEvidence(relPath) {
  if (!relPath) return false;
  if (ALWAYS_ALLOW_PATTERNS.some((pattern) => relPath.startsWith(pattern))) return true;
  if (TEST_OR_DOC_PATTERN.test(relPath)) return true;
  if (/\.md$/i.test(relPath) && !GUARDED_EXACT_FILES.has(relPath)) return true;
  return false;
}

function requiresTestFirst(relPath) {
  if (!relPath || isAllowedWithoutEvidence(relPath)) return false;
  if (GUARDED_EXACT_FILES.has(relPath)) return true;
  if (GUARDED_PREFIXES.some((pattern) => relPath.startsWith(pattern))) return true;
  if (CODE_EXT_PATTERN.test(relPath)) return true;
  return CONFIG_PATTERN.test(relPath);
}

function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
    if (!raw) return { ok: false, errors: ['empty token'], parsed: null };
    return { ok: true, errors: [], parsed: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, errors: [error.message || String(error)], parsed: null };
  }
}

function extractEvidence(token) {
  if (!token || typeof token !== 'object') return null;
  if (token.test_first && typeof token.test_first === 'object') {
    return { ...token.test_first, timestamp: token.test_first.timestamp || token.timestamp, verdict: token.test_first.verdict || token.verdict };
  }
  return token;
}

function validateEvidence(evidence, source) {
  const errors = [];
  if (!evidence || typeof evidence !== 'object') {
    return [`${source}: missing test-first evidence object`];
  }

  const timestamp = evidence.timestamp;
  if (!timestamp || !/^\d{4}-\d{2}-\d{2}T/.test(String(timestamp))) {
    errors.push(`${source}: missing ISO timestamp`);
  } else {
    const age = Date.now() - new Date(timestamp).getTime();
    if (!Number.isFinite(age) || age > MAX_TOKEN_AGE_MS || age < -60000) {
      errors.push(`${source}: stale timestamp (>4h old or in the future)`);
    }
  }

  const requiredText = [
    ['behavior', 12],
    ['risk', 12],
    ['evidence_type', 4],
    ['command', 6],
    ['verification_plan', 12],
  ];
  for (const [field, minLength] of requiredText) {
    if (typeof evidence[field] !== 'string' || evidence[field].trim().length < minLength) {
      errors.push(`${source}: ${field} must be ${minLength}+ chars`);
    }
  }

  const hasRedOrBaseline =
    (typeof evidence.expected_red === 'string' && evidence.expected_red.trim().length >= 8) ||
    (typeof evidence.baseline === 'string' && evidence.baseline.trim().length >= 8);
  if (!hasRedOrBaseline) {
    errors.push(`${source}: expected_red or baseline must describe the pre-code evidence`);
  }

  if (evidence.verdict && evidence.verdict !== 'GO') {
    errors.push(`${source}: verdict must be GO when present`);
  }

  return errors;
}

function getValidEvidence() {
  const candidates = [
    { path: TEST_FIRST_TOKEN, source: '.test-first-token' },
    { path: PREFLIGHT_TOKEN, source: '.preflight-token test_first' },
  ];

  const errors = [];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate.path)) continue;
    const read = readJson(candidate.path);
    if (!read.ok) {
      errors.push(`${candidate.source}: ${read.errors.join(', ')}`);
      continue;
    }
    const evidence = extractEvidence(read.parsed);
    const validationErrors = validateEvidence(evidence, candidate.source);
    if (validationErrors.length === 0) {
      return { valid: true, source: candidate.source, errors: [] };
    }
    errors.push(...validationErrors);
  }

  return { valid: false, source: null, errors };
}

function block(reason) {
  audit('block', reason);
  process.stderr.write(
    'TEST-FIRST GATE BLOCKED!\n\n' +
    reason + '\n\n' +
    'Before editing guarded production/enforcement/config code, write fresh test-first evidence to .test-first-token\n' +
    'or add a test_first object inside structured .preflight-token:\n\n' +
    '{ "timestamp": "...", "behavior": "...", "risk": "...", "evidence_type": "red-test|characterization|visual-baseline",\n' +
    '  "command": "npm test ...", "expected_red": "...", "verification_plan": "...", "verdict": "GO" }\n\n' +
    'Allowed before this gate: tests, docs-only proof, discovery, and token files.\n'
  );
  process.exit(2);
}

function readInput() {
  const raw = fs.readFileSync(0, 'utf8');
  return JSON.parse(raw);
}

try {
  const data = readInput();
  const filePath = data.tool_input && data.tool_input.file_path;
  const relPath = normalizeRel(filePath);

  if (!relPath) {
    block('Hook input did not include tool_input.file_path, so the edit target cannot be verified.');
  }

  if (!requiresTestFirst(relPath)) {
    audit('allow', `unguarded:${relPath}`);
    process.exit(0);
  }

  const evidence = getValidEvidence();
  if (!evidence.valid) {
    const details = evidence.errors.length > 0 ? '\n\nToken errors:\n- ' + evidence.errors.join('\n- ') : '';
    block(`Guarded edit requires test-first evidence: ${relPath}.${details}`);
  }

  audit('allow', `guarded:${relPath}; source:${evidence.source}`);
  process.exit(0);
} catch (error) {
  process.stderr.write('HOOK ERROR [test-first-gate]: ' + (error.message || error) + '\n');
  process.exit(2);
}
