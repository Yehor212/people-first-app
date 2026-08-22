#!/usr/bin/env node
/**
 * Codex UserPromptSubmit + Stop + SubagentStart + SubagentStop hook for
 * no-AI-template enforcement.
 *
 * UserPromptSubmit injects the ZenFlow no-template proposal contract.
 * SubagentStart injects the same contract plus the subagent evidence contract.
 * Stop and SubagentStop force a continuation when output contains obvious
 * template markers, best-practices claims without evidence, or subagent proof
 * laundering.
 */
"use strict";

const fs = require("node:fs");
const HOOK_NAME = "no-ai-template-gate";
let REQUIRED_CONTEXT_LINES;
let evaluateSubagentEvidence;
let evaluatePdiStop;
let productionDataIntegrityContext;
let productionDataSubagentContext;

try {
  ({
    REQUIRED_CONTEXT_LINES,
    evaluateSubagentEvidence,
  } = require("../../scripts/codex-governance/subagent-evidence.cjs"));
  ({
    evaluatePdiStop,
    productionDataIntegrityContext,
    productionDataSubagentContext,
  } = require("./production-data-integrity-gate.cjs"));
} catch (error) {
  failBootstrap(error);
}
// SUBAGENT EVIDENCE CONTRACT content and semantics are owned by the shared module above.

const NO_TEMPLATE_PROMPT_RELEVANCE =
  /\b(?:agent|asset|audit|best[- ]practice|build|change|code|copy|design|doc(?:umentation)?|edit|fix|governance|idea|implement|plan|policy|prompt|recommend|release|review|security|template|ui)\b|(?:иде|лучш|практик|план|реализ|исправ|ревью|аудит|шаблон|документ|политик)/i;

const TEMPLATE_MARKERS = [
  { label: "lorem ipsum placeholder", pattern: /\blorem ipsum\b/i },
  { label: "copy goes here placeholder", pattern: /\bcopy goes here\b/i },
  { label: "as an AI language model marker", pattern: /\bas an ai language model\b/i },
  {
    label: "AI-generated placeholder marker",
    pattern: /\bAI-generated (?:placeholder|template|content)\b/i,
  },
  {
    label: "TODO/TBD final content marker",
    pattern:
      /\b(?:TODO|TBD)(?:-as-deliverable|\s*[:：-]\s*(?:replace|fill|add|write|finalize|actual|real))\b/i,
  },
  { label: "your app name placeholder", pattern: /\byour app name\b/i },
  { label: "insert real copy placeholder", pattern: /\binsert (?:real|actual) copy here\b/i },
  { label: "generic wellness app marker", pattern: /\bgeneric wellness app\b/i },
];

const BEST_PRACTICE_CLAIM =
  /\b(?:best[- ]practices?|industry standard|recommended|obvious improvement|we should|recommendation:)\b/i;
const SUBAGENT_PROOF_CLAIM =
  /\b(?:all clear|no issues found|looks good|approved|ready to merge|PASS|GO)\b/i;
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
const QUOTED_SPAN = /`[^`\n]+`|"[^"\n]+"|'[^'\n]+'|“[^”\n]+”|‘[^’\n]+’/g;
const HISTORICAL_QUOTE_PREFIX =
  /^(?:removed|replaced|deleted) the (?:historical|previous|prior|earlier|former|legacy|old) (?:marker|placeholder|copy|text)\s*[:—-]?\s*$/i;
const HISTORICAL_QUOTE_SUFFIX = /^\s+from the reviewed (?:policy|file|document)\s*[.!]?\s*$/i;
const HISTORICAL_QUOTE_REFERENCE =
  /\b(?:quoted[ \t]+(?:marker|value|placeholder|copy)|(?:that|this)[ \t]+(?:marker|value|placeholder|copy)|the[ \t]+(?:marker|value|placeholder|copy)[ \t]+above|the[ \t]+above[ \t]+(?:marker|value|placeholder|copy))\b/i;
const HISTORICAL_GENERIC_REFERENCE =
  /\b(?:it|that[ \t]+text|this[ \t]+text|the[ \t]+same[ \t]+text|that[ \t]+copy|this[ \t]+copy)\b/i;
const HISTORICAL_REUSE_ACTION =
  /\b(?:adopt|deploy|insert|keep|make|paste|publish|put|release|restore|retain|reuse|set|ship|use)\b/i;
const HISTORICAL_QUOTE_NEGATION = /^(?:(?:we[ \t]+)?(?:do[ \t]+not|don't)|never)\b/i;
const HISTORICAL_QUOTE_EVIDENCE_ONLY =
  /^(?:(?:the[ \t]+)?quoted[ \t]+(?:marker|value|placeholder|copy)(?:[ \t]+above)?|the[ \t]+(?:marker|value|placeholder|copy)[ \t]+above|the[ \t]+above[ \t]+(?:marker|value|placeholder|copy))[ \t]+(?:remains?|is|was)[ \t]+(?:deleted|removed|historical|evidence(?:[ \t]+only)?)(?:[ \t]+and[ \t]+(?:remains?|is|was)[ \t]+(?:deleted|removed|historical|evidence(?:[ \t]+only)?))*$/i;

function failBootstrap(error) {
  if (require.main !== module) throw error;
  process.stderr.write(`HOOK ERROR [${HOOK_NAME}]: bootstrap_failure\n`);
  process.exit(2);
}

function readInput() {
  const raw = fs.readFileSync(0, "utf8");
  return JSON.parse(raw);
}

function noTemplateContext() {
  return [
    "NO AI TEMPLATE GATE:",
    "- Follow docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md before durable ideas, recommendations, plans, copy, UI, docs, prompts, assets, or agent-governance output.",
    "- AI-template output is forbidden: no generic filler, fake completeness, placeholder copy, unadapted starter-kit output, standalone feature-name lists, or subagent summaries treated as proof.",
    "- ZenFlow Idea Quality Gate: every idea needs user failure mode, local ZenFlow evidence, affected surface/platform, constraints, acceptance or kill criteria, and non-goal.",
    "- Best-Practices-Only Proposal Gate: every recommendation presented as best practice needs source-backed applicability, local evidence, affected surface/platform, tradeoffs and rejection criteria, and a verification path.",
    "- Missing proof is UNVERIFIED or STOP; do not polish uncertainty into confident advice.",
  ].join("\n");
}

function isNoTemplatePromptRelevant(prompt) {
  return NO_TEMPLATE_PROMPT_RELEVANCE.test(String(prompt || ""));
}

function combinedPromptContext() {
  return [noTemplateContext(), "", productionDataIntegrityContext()].join("\n");
}

function subagentEvidenceContext() {
  return [
    noTemplateContext(),
    "",
    productionDataSubagentContext(),
    "",
    ...REQUIRED_CONTEXT_LINES,
    "- Stay scoped to the delegated evidence question; do not broaden the task or invent product decisions.",
    "- For ideas or recommendations, apply the ZenFlow Idea Quality Gate and Best-Practices-Only Proposal Gate inside the subagent result.",
    "- The coordinator must verify your result against local files, command output, screenshots, or authoritative sources before treating it as proof.",
  ].join("\n");
}

function outputContext(eventName, additionalContext) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: eventName,
        additionalContext,
      },
    })
  );
}

function withoutHistoricalQuotedMarkers(text) {
  return text.replace(QUOTED_SPAN, (span, offset) => {
    const containsMarker = TEMPLATE_MARKERS.some((marker) => marker.pattern.test(span));
    if (!containsMarker) return span;
    const beforeSpan = text.slice(0, offset);
    const clauseBoundary = Math.max(
      beforeSpan.lastIndexOf("\n"),
      beforeSpan.lastIndexOf("."),
      beforeSpan.lastIndexOf("!"),
      beforeSpan.lastIndexOf("?"),
      beforeSpan.lastIndexOf(";")
    );
    const localPrefix = beforeSpan.slice(clauseBoundary + 1).slice(-120);
    const followingText = text.slice(offset + span.length);
    const localSuffix = followingText.split("\n", 1)[0];
    return HISTORICAL_QUOTE_PREFIX.test(localPrefix) &&
      HISTORICAL_QUOTE_SUFFIX.test(localSuffix) &&
      !reusesHistoricalQuote(followingText, localSuffix.length)
      ? " ".repeat(span.length)
      : span;
  });
}

function reusesHistoricalQuote(followingText, suffixLength) {
  const boundedRemainder = followingText.slice(suffixLength);
  const clauses = boundedRemainder
    .split(/[;\r\n.!?]+/)
    .map((clause) => clause.trim())
    .filter(Boolean);

  return clauses.some((clause) => {
    const explicitReference = HISTORICAL_QUOTE_REFERENCE.test(clause);
    const genericReuse =
      HISTORICAL_GENERIC_REFERENCE.test(clause) && HISTORICAL_REUSE_ACTION.test(clause);
    if (!explicitReference && !genericReuse) return false;
    if (
      HISTORICAL_QUOTE_NEGATION.test(clause) &&
      !/\b(?:but|however|instead|then)\b/i.test(clause)
    ) {
      return false;
    }
    return !HISTORICAL_QUOTE_EVIDENCE_ONLY.test(clause);
  });
}

function detectViolations(message) {
  const text = String(message || "");
  const markerText = withoutHistoricalQuotedMarkers(text);
  const violations = [];

  for (const marker of TEMPLATE_MARKERS) {
    if (marker.pattern.test(markerText)) {
      violations.push(marker.label);
    }
  }

  if (BEST_PRACTICE_CLAIM.test(text)) {
    const hasEvidence = BEST_PRACTICE_EVIDENCE.some((pattern) => pattern.test(text));
    if (!hasEvidence) {
      violations.push(
        "best-practices laundering: recommendation lacks source-backed applicability, local evidence, tradeoffs, and verification path"
      );
    }
  }

  return [...new Set(violations)];
}

function detectSubagentViolations(message) {
  const violations = detectViolations(message);
  const evidence = evaluateSubagentEvidence(message);

  if (!evidence.complete) {
    const text = String(message || "");
    const implicitSuccessClaim = !evidence.verdict && SUBAGENT_PROOF_CLAIM.test(text);
    if (evidence.claimsSuccess || implicitSuccessClaim) {
      violations.push(
        "subagent proof laundering: all-clear, PASS, or GO claim lacks required semantic evidence (" +
          evidence.errors.join(", ") +
          ")"
      );
    } else {
      violations.push("subagent evidence contract incomplete: " + evidence.errors.join(", "));
    }
  }

  return [...new Set(violations)];
}

function block(violations, scope = "final answer") {
  process.stderr.write(
    [
      "NO AI TEMPLATE GATE BLOCKED",
      "Detected: " + violations.join("; "),
      "Continue by rewriting the " + scope + " so it is ZenFlow-specific and evidence-backed.",
      "Required for ideas/recommendations: user failure mode or source-backed applicability, local evidence, affected surface/platform, tradeoffs and rejection criteria, verification path, and explicit UNVERIFIED rows for missing proof.",
      "Required for subagents: findings with file/command/source evidence, platform/domain impact, verification run or skipped checks, remaining risk, and Verdict: GO / STOP / ASK.",
    ].join("\n") + "\n"
  );
  process.exit(2);
}

function handleStop(data) {
  if (data.stop_hook_active) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  const violations = detectViolations(data.last_assistant_message || "");
  const pdi = evaluatePdiStop(data);
  if (!pdi.allowed) violations.push(pdi.reason);
  if (violations.length > 0) {
    block(violations);
    return;
  }

  console.log(JSON.stringify({ continue: true }));
}

function handleSubagentStop(data) {
  if (data.stop_hook_active) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  const violations = detectSubagentViolations(data.last_assistant_message || "");
  if (violations.length > 0) {
    block(violations, "subagent result");
    return;
  }

  console.log(JSON.stringify({ continue: true }));
}

function runCli() {
  try {
    const data = readInput();
    const eventName = data.hook_event_name || data.event || "UserPromptSubmit";

    if (eventName === "UserPromptSubmit") {
      outputContext("UserPromptSubmit", combinedPromptContext());
      return;
    }

    if (eventName === "SubagentStart") {
      outputContext("SubagentStart", subagentEvidenceContext());
      return;
    }

    if (eventName === "Stop") {
      handleStop(data);
      return;
    }

    if (eventName === "SubagentStop") {
      handleSubagentStop(data);
      return;
    }

    console.log(JSON.stringify({ continue: true }));
  } catch (error) {
    process.stderr.write("HOOK ERROR [" + HOOK_NAME + "]: " + (error.message || error) + "\n");
    process.exit(2);
  }
}

if (require.main === module) runCli();

module.exports = {
  combinedPromptContext,
  detectViolations,
  detectSubagentViolations,
  isNoTemplatePromptRelevant,
  noTemplateContext,
  subagentEvidenceContext,
};
