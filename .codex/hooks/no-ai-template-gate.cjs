#!/usr/bin/env node
/**
 * Codex UserPromptSubmit + Stop hook for no-AI-template enforcement.
 *
 * UserPromptSubmit injects the ZenFlow no-template proposal contract.
 * Stop forces a continuation when output contains obvious template markers or
 * best-practices claims without evidence.
 */
'use strict';

const fs = require('node:fs');

const HOOK_NAME = 'no-ai-template-gate';

const TEMPLATE_MARKERS = [
  { label: 'lorem ipsum placeholder', pattern: /\blorem ipsum\b/i },
  { label: 'copy goes here placeholder', pattern: /\bcopy goes here\b/i },
  { label: 'as an AI language model marker', pattern: /\bas an ai language model\b/i },
  { label: 'AI-generated placeholder marker', pattern: /\bAI-generated (?:placeholder|template|content)\b/i },
  { label: 'TODO/TBD final content marker', pattern: /\b(?:TODO|TBD)(?:-as-deliverable|\s*[:：-]\s*(?:replace|fill|add|write|finalize|actual|real))\b/i },
  { label: 'your app name placeholder', pattern: /\byour app name\b/i },
  { label: 'insert real copy placeholder', pattern: /\binsert (?:real|actual) copy here\b/i },
  { label: 'generic wellness app marker', pattern: /\bgeneric wellness app\b/i },
];

const BEST_PRACTICE_CLAIM = /\b(?:best[- ]practices?|industry standard|recommended|obvious improvement|we should|recommendation:)\b/i;
const BEST_PRACTICE_EVIDENCE = [
  /source-backed applicability/i,
  /local evidence/i,
  /verification path/i,
  /tradeoffs? and rejection criteria/i,
  /\bUNVERIFIED\b/,
  /\bPASS\b|\bFAIL\b/,
  /https?:\/\//i,
  /(?:^|\s)(?:AGENTS\.md|docs\/|scripts\/|src\/|\.codex\/)/i,
];

function readInput() {
  const raw = fs.readFileSync(0, 'utf8');
  return JSON.parse(raw);
}

function noTemplateContext() {
  return [
    'NO AI TEMPLATE GATE:',
    '- Follow docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md before durable ideas, recommendations, plans, copy, UI, docs, prompts, assets, or agent-governance output.',
    '- AI-template output is forbidden: no generic filler, fake completeness, placeholder copy, unadapted starter-kit output, standalone feature-name lists, or subagent summaries treated as proof.',
    '- ZenFlow Idea Quality Gate: every idea needs user failure mode, local ZenFlow evidence, affected surface/platform, constraints, acceptance or kill criteria, and non-goal.',
    '- Best-Practices-Only Proposal Gate: every recommendation presented as best practice needs source-backed applicability, local evidence, affected surface/platform, tradeoffs and rejection criteria, and a verification path.',
    '- Missing proof is UNVERIFIED or STOP; do not polish uncertainty into confident advice.',
    '- Route every additional out-of-scope finding only to docs/ai/DEFERRED_FINDINGS_LEDGER.md with evidence, impact, verification path, risk, and disposition; logging never authorizes implementation.',
  ].join('\n');
}

function outputContext(eventName, additionalContext) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext,
    },
  }));
}

function detectViolations(message) {
  const text = String(message || '');
  const violations = [];

  for (const marker of TEMPLATE_MARKERS) {
    if (marker.pattern.test(text)) {
      violations.push(marker.label);
    }
  }

  if (BEST_PRACTICE_CLAIM.test(text)) {
    const hasEvidence = BEST_PRACTICE_EVIDENCE.some((pattern) => pattern.test(text));
    if (!hasEvidence) {
      violations.push('best-practices laundering: recommendation lacks source-backed applicability, local evidence, tradeoffs, and verification path');
    }
  }

  return [...new Set(violations)];
}

function block(violations) {
  process.stderr.write([
    'NO AI TEMPLATE GATE BLOCKED',
    'Detected: ' + violations.join('; '),
    'Continue by rewriting the final answer so it is ZenFlow-specific and evidence-backed.',
    'Required for ideas/recommendations: user failure mode or source-backed applicability, local evidence, affected surface/platform, tradeoffs and rejection criteria, verification path, and explicit UNVERIFIED rows for missing proof.',
  ].join('\n') + '\n');
  process.exit(2);
}

function handleStop(data) {
  if (data.stop_hook_active) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  const violations = detectViolations(data.last_assistant_message || '');
  if (violations.length > 0) {
    block(violations);
    return;
  }

  console.log(JSON.stringify({ continue: true }));
}

try {
  const data = readInput();
  const eventName = data.hook_event_name || data.event || 'UserPromptSubmit';

  if (eventName === 'UserPromptSubmit') {
    outputContext('UserPromptSubmit', noTemplateContext());
    process.exit(0);
  }

  if (eventName === 'Stop') {
    handleStop(data);
    process.exit(0);
  }

  console.log(JSON.stringify({ continue: true }));
} catch (error) {
  process.stderr.write('HOOK ERROR [' + HOOK_NAME + ']: ' + (error.message || error) + '\n');
  process.exit(2);
}

module.exports = { detectViolations, noTemplateContext };
