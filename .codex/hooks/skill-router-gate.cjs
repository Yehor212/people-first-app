#!/usr/bin/env node
/**
 * Codex UserPromptSubmit + PreToolUse hook for skill routing.
 *
 * UserPromptSubmit injects a short routing checklist. PreToolUse blocks guarded
 * edits until the agent records which skills/plugins were selected and why the
 * rest were skipped.
 *
 * Hook input: stdin JSON required.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const HOOK_NAME = 'skill-router-gate';
const SKILL_ROUTING_TOKEN = path.join(ROOT, '.skill-routing-token');
const PREFLIGHT_TOKEN = path.join(ROOT, '.preflight-token');
const MAX_TOKEN_AGE_MS = 4 * 60 * 60 * 1000;

const ALWAYS_ALLOW_PATTERNS = [
  '.skill-routing-token',
  '.preflight-token',
  '.test-first-token',
  '.postflight-done',
  '.verification-done',
  '.ci-evidence',
  '.Codex-md-unlock',
  '.claude-md-unlock',
  'memory/',
  'output/',
];

const GUARDED_PREFIXES = [
  '.codex/',
  '.Codex/',
  '.claude/hooks/',
  '.claude/agents/',
  '.claude/rules/',
  '.agents/',
  'docs/ai/',
  'scripts/',
  'src/',
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

const TEST_OR_DOC_PATTERN = /(^|\/)(__tests__|test|tests|e2e)(\/|$)|\.(test|spec)\.(ts|tsx|js|jsx|cjs|mjs)$/i;
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractPatchPaths(text) {
  const paths = [];
  const raw = String(text || '');
  const patchPattern = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm;
  let match;
  while ((match = patchPattern.exec(raw)) !== null) {
    paths.push(match[1].trim());
  }
  return paths;
}

function extractTargetPaths(data) {
  const input = data && data.tool_input;
  const paths = [];
  if (input && typeof input === 'object') {
    for (const key of ['file_path', 'path', 'filename']) {
      if (typeof input[key] === 'string') paths.push(input[key]);
    }
    if (typeof input.patch === 'string') paths.push(...extractPatchPaths(input.patch));
    if (typeof input.input === 'string') paths.push(...extractPatchPaths(input.input));
  } else if (typeof input === 'string') {
    paths.push(...extractPatchPaths(input));
  }
  if (typeof data.patch === 'string') paths.push(...extractPatchPaths(data.patch));
  return unique(paths).map(normalizeRel);
}

function isAllowedWithoutRouting(relPath) {
  if (!relPath) return false;
  if (ALWAYS_ALLOW_PATTERNS.some((pattern) => relPath.startsWith(pattern))) return true;
  if (GUARDED_EXACT_FILES.has(relPath)) return false;
  if (GUARDED_PREFIXES.some((pattern) => relPath.startsWith(pattern))) return false;
  if (TEST_OR_DOC_PATTERN.test(relPath)) return true;
  if (/\.md$/i.test(relPath)) return true;
  return false;
}

function requiresSkillRouting(relPath) {
  if (!relPath || isAllowedWithoutRouting(relPath)) return false;
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

function extractRoutingEvidence(token) {
  if (!token || typeof token !== 'object') return null;
  if (token.skill_routing && typeof token.skill_routing === 'object') {
    return {
      ...token.skill_routing,
      timestamp: token.skill_routing.timestamp || token.timestamp,
      verdict: token.skill_routing.verdict || token.verdict,
    };
  }
  return token;
}

function validateTextField(evidence, field, minLength, errors, source) {
  if (typeof evidence[field] !== 'string' || evidence[field].trim().length < minLength) {
    errors.push(`${source}: ${field} must be ${minLength}+ chars`);
  }
}

function validateRoutingEvidence(evidence, source) {
  const errors = [];
  if (!evidence || typeof evidence !== 'object') {
    return [`${source}: missing skill routing evidence object`];
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

  validateTextField(evidence, 'prompt_summary', 12, errors, source);
  validateTextField(evidence, 'decision', 12, errors, source);
  validateTextField(evidence, 'verification_plan', 12, errors, source);

  if (!Array.isArray(evidence.selected_skills) || evidence.selected_skills.length === 0) {
    errors.push(`${source}: selected_skills must list at least one selected skill/workflow`);
  }

  const skipped = evidence.skipped_obvious;
  if (!Array.isArray(skipped) || skipped.length === 0) {
    errors.push(`${source}: skipped_obvious must explain why not every plugin skill was used`);
  } else {
    for (const item of skipped) {
      if (!item || typeof item.name !== 'string' || typeof item.reason !== 'string') {
        errors.push(`${source}: skipped_obvious entries need name and reason`);
        break;
      }
    }
  }

  if (evidence.verdict !== 'GO') {
    errors.push(`${source}: verdict must be GO`);
  }

  return errors;
}

function getValidEvidence() {
  const candidates = [
    { path: SKILL_ROUTING_TOKEN, source: '.skill-routing-token' },
    { path: PREFLIGHT_TOKEN, source: '.preflight-token skill_routing' },
  ];

  const errors = [];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate.path)) continue;
    const read = readJson(candidate.path);
    if (!read.ok) {
      errors.push(`${candidate.source}: ${read.errors.join(', ')}`);
      continue;
    }
    const evidence = extractRoutingEvidence(read.parsed);
    const validationErrors = validateRoutingEvidence(evidence, candidate.source);
    if (validationErrors.length === 0) {
      return { valid: true, source: candidate.source, errors: [] };
    }
    errors.push(...validationErrors);
  }

  return { valid: false, source: null, errors };
}

function buildSkillRoutingContext() {
  return [
    'SKILL ROUTING REQUIRED:',
    '- User-named plugins/skills are routing signals. If the user says @superpowers, @chrome, @browser, @openai-developers, or similar, choose the relevant skill(s), read each selected SKILL.md fully, and state the order used.',
    '- Do not load every skill in a plugin by default. OpenAI Codex skills use progressive disclosure: pick the minimal relevant set, then explain why obvious unused skills were skipped.',
    '- For protected repo edits, record .skill-routing-token or .preflight-token.skill_routing before editing.',
    '- Required evidence shape: { timestamp, prompt_summary, explicit_plugins, selected_skills, skipped_obvious, decision, verification_plan, verdict: "GO" }.',
    '- Superpowers mapping: writing-plans for multi-step work, test-driven-development for code changes, systematic-debugging for bug hunts, verification-before-completion before final, requesting/receiving review when risk warrants. Do not run unrelated Superpowers skills just because the plugin is named.',
    '- Browser/Chrome/Computer Use mapping: Browser for local/public page verification, Chrome for existing user Chrome state, Computer Use only for real desktop-app interaction. Do not automate Codex itself with Computer Use.',
  ].join('\n');
}

function outputPromptContext() {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: buildSkillRoutingContext(),
    },
  }));
}

function block(reason) {
  audit('block', reason);
  process.stderr.write(
    'SKILL ROUTING GATE BLOCKED!\n\n' +
    reason + '\n\n' +
    'Before editing protected repo files, record skill routing evidence in .skill-routing-token\n' +
    'or .preflight-token.skill_routing:\n\n' +
    '{ "timestamp": "...", "prompt_summary": "...", "explicit_plugins": ["Superpowers"],\n' +
    '  "selected_skills": ["superpowers:writing-plans"],\n' +
    '  "skipped_obvious": [{ "name": "all other plugin skills", "reason": "not relevant to this task" }],\n' +
    '  "decision": "...", "verification_plan": "...", "verdict": "GO" }\n\n' +
    'Allowed before this gate: discovery, tests, ordinary docs, and token files.\n'
  );
  process.exit(2);
}

function readInput() {
  const raw = fs.readFileSync(0, 'utf8');
  return JSON.parse(raw);
}

try {
  const data = readInput();
  const eventName = data.hook_event_name || data.event || (data.tool_input ? 'PreToolUse' : 'UserPromptSubmit');

  if (eventName === 'UserPromptSubmit') {
    outputPromptContext();
    process.exit(0);
  }

  if (eventName !== 'PreToolUse') {
    audit('allow', `unsupported-event:${eventName}`);
    process.exit(0);
  }

  const relPaths = extractTargetPaths(data);
  if (relPaths.length === 0) {
    block('Hook input did not include an editable file path, so the target cannot be verified.');
  }

  const guarded = relPaths.filter(requiresSkillRouting);
  if (guarded.length === 0) {
    audit('allow', `unguarded:${relPaths.join(',')}`);
    process.exit(0);
  }

  const evidence = getValidEvidence();
  if (!evidence.valid) {
    const details = evidence.errors.length > 0 ? '\n\nToken errors:\n- ' + evidence.errors.join('\n- ') : '';
    block(`Guarded edit requires skill-routing evidence: ${guarded.join(', ')}.${details}`);
  }

  audit('allow', `guarded:${guarded.join(',')}; source:${evidence.source}`);
  process.exit(0);
} catch (error) {
  process.stderr.write('HOOK ERROR [skill-router-gate]: ' + (error.message || error) + '\n');
  process.exit(2);
}
