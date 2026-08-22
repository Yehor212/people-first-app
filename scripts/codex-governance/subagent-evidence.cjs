"use strict";

const FIELD_LABELS = new Map([
  ["findings", "findings"],
  ["finding", "findings"],
  ["file/source evidence", "sourceEvidence"],
  ["platform/domain impact", "platformImpact"],
  ["verification run or skipped checks", "combinedVerification"],
  ["verification run", "verificationRun"],
  ["verification skipped", "verificationSkipped"],
  ["remaining risk", "remainingRisk"],
  ["verdict", "verdict"],
]);

const REQUIRED_CONTEXT_LINES = [
  "SUBAGENT EVIDENCE CONTRACT:",
  "- Return Findings; File/source evidence; Platform/domain impact; Verification run and/or Verification skipped; Remaining risk; and Verdict: GO / STOP / ASK.",
  "- Fields may use exact colon labels or Markdown headings. Every section needs substantive body text; a heading alone is not evidence.",
  "- File/source evidence needs a concrete file, URL, command-bound artifact, commit, or hash locator.",
  "- Verification run needs a concrete command or bound artifact. Verification skipped needs an explicit reason and UNVERIFIED/SKIP status.",
  "- Verdict is the overall disposition. A PASS inside verification does not override Verdict: STOP or Verdict: ASK.",
  "- Verdict: GO is invalid when the recorded verification says a command or check failed.",
  "- Verdict: GO is invalid when Findings or Remaining risk explicitly retains an unresolved blocker.",
];

const EVIDENCE_BLOCK_REASON =
  "Subagent success claim lacks the required Findings, file/source evidence, platform/domain impact, verification/skips, remaining risk, and GO/STOP/ASK verdict packet.";

function evaluateSubagentEvidence(message) {
  const parsed = parseEvidenceSections(message);
  const errors = [...parsed.errors];
  const sections = Object.fromEntries(
    Object.entries(parsed.sections).map(([key, lines]) => [key, normalizeBody(lines)])
  );
  const verdict = parseVerdict(sections.verdict);

  requireSubstantive(sections.findings, "findings", errors);
  requireSubstantive(sections.sourceEvidence, "source_evidence", errors);
  if (
    substantiveEvidence(sections.sourceEvidence) &&
    !sourceLocatorPresent(sections.sourceEvidence)
  ) {
    errors.push("source_evidence_missing_locator");
  }
  requireSubstantive(sections.platformImpact, "platform_impact", errors);
  requireSubstantive(sections.remainingRisk, "remaining_risk", errors);
  if (!verdict) errors.push("verdict_missing_or_invalid");

  const combinedRunValid =
    substantiveEvidence(sections.combinedVerification) &&
    verificationRunEvidence(sections.combinedVerification);
  const combinedSkipValid =
    substantiveEvidence(sections.combinedVerification) &&
    verificationSkipEvidence(sections.combinedVerification);
  const combinedValid = combinedRunValid || combinedSkipValid;
  const runValid =
    substantiveEvidence(sections.verificationRun) &&
    verificationRunEvidence(sections.verificationRun);
  const skippedValid =
    substantiveEvidence(sections.verificationSkipped) &&
    verificationSkipEvidence(sections.verificationSkipped);
  if (!combinedValid && !runValid && !skippedValid) {
    errors.push("verification_missing_or_content_free");
  }
  if (verdict === "GO" && !combinedRunValid && !runValid) {
    errors.push("go_verdict_requires_successful_verification");
  }

  const verificationText = [sections.combinedVerification, sections.verificationRun]
    .filter(Boolean)
    .join("\n");
  if (verdict === "GO" && verificationFailurePresent(verificationText)) {
    errors.push("go_verdict_contradicts_failed_verification");
  }
  if (
    verdict === "GO" &&
    blockingClaimPresent([sections.findings, sections.remainingRisk].filter(Boolean).join("\n"))
  ) {
    errors.push("go_verdict_contradicts_blocking_finding");
  }

  return {
    claimsSuccess: verdict === "GO",
    complete: errors.length === 0,
    errors: [...new Set(errors)],
    sections,
    verdict,
  };
}

function parseEvidenceSections(message) {
  const normalized = String(message || "").replace(/\r\n?/g, "\n");
  const sections = {};
  const counts = new Map();
  const errors = [];
  let activeField = "";

  for (const line of normalized.split("\n")) {
    const marker = parseFieldMarker(line);
    if (marker) {
      activeField = marker.field;
      if (!activeField) continue;
      counts.set(activeField, (counts.get(activeField) || 0) + 1);
      if (!sections[activeField]) sections[activeField] = [];
      if (marker.inlineBody) sections[activeField].push(marker.inlineBody);
      continue;
    }
    if (activeField) sections[activeField].push(line);
  }

  for (const [field, count] of counts) {
    if (count > 1) errors.push(`duplicate_${field}`);
  }
  return { errors, sections };
}

function parseFieldMarker(line) {
  const trimmed = String(line || "").trim();
  const heading = /^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(trimmed);
  if (heading) {
    const label = stripMarkdownLabel(heading[1]).replace(/[ \t]*:[ \t]*$/, "");
    const field = FIELD_LABELS.get(label.toLowerCase());
    return { field: field || "", inlineBody: "" };
  }

  const colon = /^(?:[-*+][ \t]+)?(.+?)[ \t]*:[ \t]*(.*)$/.exec(trimmed);
  if (!colon) return null;
  const label = stripMarkdownLabel(colon[1]).toLowerCase();
  const field = FIELD_LABELS.get(label);
  return field ? { field, inlineBody: colon[2].trim() } : null;
}

function stripMarkdownLabel(value) {
  return String(value)
    .trim()
    .replace(/^(?:\*\*|__)/, "")
    .replace(/(?:\*\*|__)$/, "")
    .trim();
}

function normalizeBody(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) =>
      String(line)
        .replace(/^[ \t]*(?:>[ \t]*)?[-*+][ \t]+/, "")
        .replace(/^[ \t]*>[ \t]?/, "")
        .trim()
    )
    .filter(Boolean)
    .join("\n")
    .trim();
}

function requireSubstantive(value, label, errors) {
  if (!substantiveEvidence(value)) errors.push(`${label}_missing_or_content_free`);
}

function substantiveEvidence(value) {
  const text = String(value || "").trim();
  if (text.length < 8) return false;
  const plain = text
    .replace(/[`*_~]/g, "")
    .replace(/[.\-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return !/^(?:x+|none|n\/?a|not applicable|pass|unknown|tbd|todo)$/.test(plain);
}

function sourceLocatorPresent(value) {
  return (
    /https?:\/\/\S+/i.test(value) ||
    /[A-Za-z]:\\\S+/.test(value) ||
    /(?:^|[\s`"'(])(?:\.{0,2}\/)?(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.(?:ts|tsx|js|jsx|cjs|mjs|json|md|toml|yml|yaml|rs|java|kt|swift|html|sql)(?:[:#]\d+)?\b/i.test(
      value
    ) ||
    /(?:^|[\s`"'(])[A-Za-z0-9_.-]+\.(?:ts|tsx|js|jsx|cjs|mjs|json|md|toml|yml|yaml|rs|java|kt|swift|html|sql)(?:[:#]\d+)?\b/i.test(
      value
    ) ||
    /\b(?:commit|hash)(?:\s+sha(?:-?256)?|\s*[:=#])?\s+[0-9a-f]{7,64}\b/i.test(value) ||
    /\bcommand\s*:\s*(?:npm|npx|node|git|rg|vitest|tsc|eslint|cargo|gradle|xcodebuild|snyk)\s+\S+/i.test(
      value
    )
  );
}

function verificationRunEvidence(value) {
  return String(value || "")
    .split(/[;\n]+/)
    .some((segment) => {
      if (verificationNotRun(segment)) return false;
      const commandRun =
        /(?:^|[\s`])(?:npm|npx|node|git|rg|vitest|tsc|eslint|cargo|gradle|xcodebuild|snyk)\s+\S+/i.test(
          segment
        );
      const boundArtifact =
        /\b(?:artifact|report|screenshot|hash)\b/i.test(segment) && sourceLocatorPresent(segment);
      return commandRun || boundArtifact;
    });
}

function verificationSkipEvidence(value) {
  return /\b(?:UNVERIFIED|SKIP(?:PED)?|not run|unavailable|blocked|no access|no credentials|no device|no runner|no tool|because)\b/i.test(
    value
  );
}

function verificationFailurePresent(value) {
  const withoutZeroFailures = String(value || "").replace(
    /\b(?:no|0|zero)\s+(?:(?:checks?|tests?|commands?|suites?)\s+)?failed\b/gi,
    ""
  );
  return (
    /\bfailed\b/i.test(withoutZeroFailures) ||
    /\bFAIL\b/.test(withoutZeroFailures) ||
    /\bexit(?:ed)?(?:[ \t]+code)?[ \t]*[:=]?[ \t]*[1-9]\d*\b/i.test(withoutZeroFailures) ||
    /\bnon[- ]zero(?:[ \t]+exit)?\b/i.test(withoutZeroFailures)
  );
}

function verificationNotRun(value) {
  return /\b(?:was|were|is|are|has|have|had)?[ \t]*(?:not run|not executed)|\bdid not run\b|\bskipped\b|\bunavailable\b/i.test(
    String(value || "")
  );
}

function blockingClaimPresent(value) {
  return String(value || "")
    .split(/[\n.;]+/)
    .some((segment) => {
      const text = segment.trim();
      if (!text) return false;
      return (
        /\bblocking(?:\s+[a-z][\w-]*){0,4}\s+(?:defect|issue|finding|risk|concern|decision)\b[^.!?\n;]{0,120}\b(?:remains?|is|are)\s+(?:unresolved|open|active|blocking)\b/i.test(
          text
        ) ||
        /\b(?:defect|issue|finding|risk|concern|decision|blocker)\b[^.!?\n;]{0,120}\b(?:remains?|is|are)\s+(?:unresolved|open|active|blocking)\b/i.test(
          text
        ) ||
        /\b(?:release|rollout|closure|handoff|deployment|merge)\b[^.!?\n;]{0,100}\b(?:remains?|is|are)\s+(?:explicitly\s+)?blocked\b/i.test(
          text
        ) ||
        /\b(?:cannot|can't|must not|should not|may not)\s+(?:be\s+)?(?:ship|shipped|release|released|deploy|deployed|merge|merged|proceed|roll out)\b/i.test(
          text
        )
      );
    });
}

function parseVerdict(value) {
  const lines = String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const match = /^(GO|STOP|ASK)[.!]?$/i.exec(lines[0] || "");
  if (lines.slice(1).some((line) => /\b(?:GO|STOP|ASK)\b/i.test(line))) return "";
  return match ? match[1].toUpperCase() : "";
}

module.exports = {
  EVIDENCE_BLOCK_REASON,
  REQUIRED_CONTEXT_LINES,
  evaluateSubagentEvidence,
  parseEvidenceSections,
};
