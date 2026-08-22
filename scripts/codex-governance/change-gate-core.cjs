"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MAX_TOKEN_AGE_MS = 4 * 60 * 60 * 1000;

const UNGUARDED_PREFIXES = ["docs/superpowers/plans/", "output/", "scripts/__tests__/"];

const UNGUARDED_EXACT = new Set([
  ".Codex-md-unlock",
  ".preflight-token",
  ".skill-routing-token",
  ".test-first-token",
]);

const L4_PREFIXES = [
  ".codex/",
  ".github/",
  "config/persistent-agent-orchestra",
  "docs/ai/",
  "scripts/codex-governance/",
  "scripts/persistent-agent-orchestra/",
];

const L4_EXACT = new Set(["AGENTS.md", "ARCHITECTURE.md", "CLAUDE.md", "package.json"]);

function evaluateGuard({ rootDir, targetPath, now = new Date() }) {
  const reasons = [];
  const evidence = [];
  let identity;
  try {
    identity = resolveTargetIdentity(rootDir, targetPath);
  } catch {
    return { allowed: false, reasons: ["target path identity is unavailable"], evidence };
  }
  const { absoluteRoot, absoluteTarget } = identity;
  const relativeValue = normalizeRelative(path.relative(absoluteRoot, absoluteTarget));
  const relative = relativeValue === "" ? "." : relativeValue;

  if (relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) {
    return { allowed: false, reasons: ["target path is outside repository"], evidence };
  }
  if (identity.multipleLinks) {
    return { allowed: false, reasons: ["target path has multiple filesystem links"], evidence };
  }
  if (
    UNGUARDED_EXACT.has(relative) ||
    UNGUARDED_PREFIXES.some((prefix) => relative.startsWith(prefix))
  ) {
    return { allowed: true, reasons, evidence: ["pre-code evidence or plan path"] };
  }
  if (!requiresGuard(relative)) {
    return { allowed: true, reasons, evidence: ["target is outside guarded change surfaces"] };
  }

  const tokenPath = path.join(absoluteRoot, ".preflight-token");
  const token = readJson(tokenPath, reasons, "preflight token");
  if (token) {
    validatePreflightToken(token, now, reasons, requiresL4(relative));
  }

  if (relative === "AGENTS.md") {
    const unlockPath = path.join(absoluteRoot, ".Codex-md-unlock");
    if (!isNonEmptyFile(unlockPath))
      reasons.push("AGENTS.md requires a non-empty .Codex-md-unlock authorization file");
    else evidence.push("AGENTS.md unlock present");
  }

  if (reasons.length === 0) {
    evidence.push("fresh structured preflight token");
    evidence.push("test-first evidence present");
    evidence.push("skill-routing evidence present");
  }
  return { allowed: reasons.length === 0, reasons, evidence };
}

function resolveTargetIdentity(rootDir, targetPath) {
  const rootInput = path.resolve(String(rootDir || ""));
  const absoluteRoot = fs.realpathSync.native(rootInput);
  if (!fs.statSync(absoluteRoot).isDirectory()) {
    throw new Error("repository root is not a directory");
  }

  const lexicalTarget = path.resolve(absoluteRoot, String(targetPath || ""));
  const resolvedTarget = resolvePotentialPath(lexicalTarget);
  return {
    absoluteRoot,
    absoluteTarget: resolvedTarget.path,
    multipleLinks: resolvedTarget.multipleLinks,
  };
}

function resolvePotentialPath(absolutePath) {
  let cursor = path.resolve(absolutePath);
  const missingSegments = [];
  let stats;

  while (true) {
    try {
      stats = fs.lstatSync(cursor);
      break;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      missingSegments.unshift(path.basename(cursor));
      cursor = parent;
    }
  }

  const canonicalExistingPath = fs.realpathSync.native(cursor);
  const canonicalStats = fs.statSync(canonicalExistingPath);
  if (missingSegments.length > 0 && !canonicalStats.isDirectory()) {
    throw new Error("target ancestor is not a directory");
  }
  return {
    path: path.join(canonicalExistingPath, ...missingSegments),
    multipleLinks: missingSegments.length === 0 && stats.isFile() && stats.nlink > 1,
  };
}

function validatePreflightToken(token, now, reasons, l4Required) {
  validateTimestamp(token.timestamp, now, reasons, "preflight token");
  if (token.verdict !== "GO") reasons.push("preflight token verdict must be GO");
  if (l4Required && token.depth !== "L4") {
    reasons.push("preflight token depth L4 required");
  }
  if (typeof token.goal !== "string" || token.goal.trim().length < 12) {
    reasons.push("preflight token goal is missing or too short");
  }
  validateTestFirst(token.test_first, token.timestamp, now, reasons);
  validateSkillRouting(token.skill_routing, token.timestamp, now, reasons);
}

function requiresGuard(relative) {
  if (relative === ".") return true;
  if (requiresL4(relative)) return true;
  if (/\.(?:cjs|js|json|mjs|ts|tsx|toml|ya?ml)$/i.test(relative)) return true;
  return (
    relative.startsWith("scripts/") || relative.startsWith("config/") || relative.startsWith("src/")
  );
}

function requiresL4(relative) {
  if (relative === ".") return true;
  return L4_EXACT.has(relative) || L4_PREFIXES.some((prefix) => relative.startsWith(prefix));
}

function validateTestFirst(value, parentTimestamp, now, reasons) {
  if (!isPlainObject(value)) {
    reasons.push("preflight token requires test_first evidence");
    return;
  }
  validateTimestamp(value.timestamp || parentTimestamp, now, reasons, "test_first evidence");
  requireText(value.behavior, 12, "test_first behavior", reasons);
  requireText(value.risk, 12, "test_first risk", reasons);
  requireText(value.evidence_type, 4, "test_first evidence_type", reasons);
  requireText(value.command, 6, "test_first command", reasons);
  requireText(value.verification_plan, 12, "test_first verification_plan", reasons);
  const hasBaseline = typeof value.baseline === "string" && value.baseline.trim().length >= 8;
  const hasExpectedRed =
    typeof value.expected_red === "string" && value.expected_red.trim().length >= 8;
  if (!hasBaseline && !hasExpectedRed)
    reasons.push("test_first requires baseline or expected_red evidence");
  if (value.verdict !== undefined && value.verdict !== "GO")
    reasons.push("test_first verdict must be GO");
}

function validateSkillRouting(value, parentTimestamp, now, reasons) {
  if (!isPlainObject(value)) {
    reasons.push("preflight token requires skill_routing evidence");
    return;
  }
  validateTimestamp(value.timestamp || parentTimestamp, now, reasons, "skill_routing evidence");
  requireText(value.prompt_summary, 12, "skill_routing prompt_summary", reasons);
  requireText(value.decision, 12, "skill_routing decision", reasons);
  requireText(value.verification_plan, 12, "skill_routing verification_plan", reasons);
  if (!Array.isArray(value.selected_skills) || value.selected_skills.length === 0) {
    reasons.push("skill_routing selected_skills must be non-empty");
  }
  if (!Array.isArray(value.skipped_obvious) || value.skipped_obvious.length === 0) {
    reasons.push("skill_routing skipped_obvious must be non-empty");
  }
  if (value.verdict !== "GO") reasons.push("skill_routing verdict must be GO");
}

function validateTimestamp(value, now, reasons, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    reasons.push(`${label} timestamp is missing or invalid`);
    return;
  }
  const parsed = new Date(value);
  const age = now.getTime() - parsed.getTime();
  if (!Number.isFinite(parsed.getTime()) || age < -60_000 || age > MAX_TOKEN_AGE_MS) {
    reasons.push(`${label} timestamp is stale or in the future`);
  }
}

function readJson(filePath, reasons, label) {
  if (!fs.existsSync(filePath)) {
    reasons.push(`${label} is missing`);
    return null;
  }
  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!isPlainObject(value)) throw new Error("must contain an object");
    return value;
  } catch (error) {
    reasons.push(`${label} is malformed: ${error.message}`);
    return null;
  }
}

function isNonEmptyFile(filePath) {
  try {
    return fs.statSync(filePath).isFile() && fs.readFileSync(filePath, "utf8").trim().length > 0;
  } catch {
    return false;
  }
}

function requireText(value, minimum, label, reasons) {
  if (typeof value !== "string" || value.trim().length < minimum)
    reasons.push(`${label} must be ${minimum}+ characters`);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeRelative(value) {
  return value.split(path.sep).join("/");
}

module.exports = {
  evaluateGuard,
};
