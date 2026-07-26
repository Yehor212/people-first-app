import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

import { AuditBundleSchema, SUBJECT_IDS } from "./schemas.mjs";
import { readJsonl } from "./jsonl.mjs";

const MAX_LOCAL_ARTIFACT_BYTES = 16 * 1024 * 1024;
const FORBIDDEN_KEYS = new Set([
  "journal",
  "journalcontent",
  "journalentry",
  "journalpayload",
  "mood",
  "moodentry",
  "moodpayload",
  "habit",
  "habitentry",
  "habitpayload",
  "deviceid",
  "deviceidentifier",
  "devicefingerprint",
  "phone",
  "phonenumber",
  "accountid",
  "accountidentifier",
  "token",
  "accesstoken",
  "refreshtoken",
  "credential",
  "credentials",
  "password",
  "secret",
  "email",
  "contactid",
]);
const FORBIDDEN_VALUE_PATTERNS = [
  /\bBearer\s+[\w.-]+/i,
  /\bsk-[\w-]{8,}/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?<!\d)(?:\+\d[\d ()-]{7,14}\d|\d{3}[ ()-]\d{3}[ -]\d{4})(?!\d)/,
];
const ALLOWED_HISTORY_TRANSITIONS = new Map([
  ["DISCOVERED", new Set(["TRIAGED"])],
  ["TRIAGED", new Set(["DECIDED"])],
  ["DECIDED", new Set(["IMPLEMENTING"])],
  ["IMPLEMENTING", new Set(["VERIFIED", "REJECTED", "BLOCKED", "ROLLED_BACK"])],
  ["BLOCKED", new Set()],
  ["VERIFIED", new Set()],
  ["REJECTED", new Set()],
  ["ROLLED_BACK", new Set()],
]);

export function validateAuditBundle(bundle) {
  const privacyErrors = findSensitivePayloads(bundle);
  if (privacyErrors.length > 0) return { ok: false, errors: privacyErrors };

  const parsed = AuditBundleSchema.safeParse(bundle);
  if (!parsed.success) return { ok: false, errors: formatZodErrors(parsed.error.issues) };

  const errors = [];
  const subjects = uniqueBy(parsed.data.manifest.subjects, "subjectId", "subject", errors);
  for (const requiredSubject of SUBJECT_IDS) {
    if (!subjects.has(requiredSubject)) errors.push(`missing ${requiredSubject} subject provenance`);
  }

  const evidence = uniqueBy(parsed.data.evidence, "evidenceId", "evidence", errors);
  const capabilities = uniqueBy(parsed.data.capabilities, "capabilityId", "capability", errors);
  const decisions = uniqueBy(parsed.data.decisions, "decisionId", "decision", errors);
  uniqueBy(parsed.data.findingHistory, "findingId", "finding history", errors);

  validateRoleReceipts(parsed.data.manifest.roleReceipts, subjects, errors);
  for (const row of parsed.data.evidence) {
    if (!subjects.has(row.subjectId)) errors.push(`evidence ${row.evidenceId} references missing subject ${row.subjectId}`);
  }
  for (const capability of parsed.data.capabilities) {
    validateCapabilityEvidence(capability, evidence, errors);
  }
  for (const decision of parsed.data.decisions) {
    validateDecision(decision, capabilities, evidence, errors);
  }
  for (const history of parsed.data.findingHistory) {
    validateFindingHistory(history, capabilities, decisions, evidence, errors);
  }
  return { ok: errors.length === 0, errors };
}

export async function validateAuditBundleWithLocalArtifacts(bundle, inputDirectory) {
  const result = validateAuditBundle(bundle);
  if (!result.ok) return result;
  const artifactErrors = await validateLocalArtifacts(bundle.evidence, inputDirectory);
  return { ok: artifactErrors.length === 0, errors: artifactErrors };
}

export function renderAuditMarkdown(bundle) {
  const validation = validateAuditBundle(bundle);
  if (!validation.ok) throw new Error(`cannot render invalid audit ledger: ${validation.errors.join("; ")}`);

  const lines = ["# Product Coherence Audit", "", "## Subjects", ""];
  for (const subject of [...bundle.manifest.subjects].sort(by("subjectId"))) {
    lines.push(`- ${subject.subjectId}: git-${subject.repository.oidAlgorithm}:${subject.repository.commitOid}`);
  }
  lines.push("", "## Decisions", "");
  for (const decision of [...bundle.decisions].sort(by("decisionId"))) {
    lines.push(`- ${decision.subjectId} / ${decision.decisionId}: ${decision.selectedDecision.disposition}`);
  }
  lines.push("", "## Finding history", "");
  for (const history of [...bundle.findingHistory].sort(by("findingId"))) {
    lines.push(`### ${history.findingId} → ${history.decisionId}`, "");
    for (const event of history.events) {
      lines.push(`- ${event.sequence}. ${event.observedAt} — ${event.state}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export async function loadAuditBundle(inputDirectory) {
  const requestedRoot = path.resolve(inputDirectory);
  const rootStat = await lstat(requestedRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("audit input directory must be a real directory, not a symlink");
  }
  const root = await realpath(requestedRoot);
  const entries = new Set(await readdir(root));
  const expected = ["manifest", "evidence", "capabilities", "decisions", "findingHistory"];
  for (const name of expected) {
    if (!entries.has(`${name}.jsonl`)) throw new Error(`missing required ledger ${name}.jsonl`);
  }
  const ledgerPaths = expected.map((name) => path.join(root, `${name}.jsonl`));
  await Promise.all(ledgerPaths.map((filePath) => assertRegularFileInsideRoot(root, filePath, "ledger")));
  const [manifestRows, evidence, capabilities, decisions, findingHistory] = await Promise.all(
    ledgerPaths.map((filePath) => readJsonl(filePath)),
  );
  if (manifestRows.length !== 1) throw new Error("manifest.jsonl must contain exactly one AuditManifest");
  return { manifest: manifestRows[0], evidence, capabilities, decisions, findingHistory };
}

function validateRoleReceipts(receipts, subjects, errors) {
  for (const receipt of receipts) {
    if (!subjects.has(receipt.subjectId)) {
      errors.push(`role receipt ${receipt.roleId} references missing subject ${receipt.subjectId}`);
    }
  }
}

function validateCapabilityEvidence(capability, evidence, errors) {
  for (const evidenceId of capability.evidenceIds) {
    validateSubjectEvidence("capability", capability.capabilityId, capability.subjectId, evidenceId, evidence, errors);
  }
  for (const node of capability.trace) {
    validateSubjectEvidence("capability trace", capability.capabilityId, capability.subjectId, node.evidenceId, evidence, errors);
  }
}

function validateDecision(decision, capabilities, evidence, errors) {
  const capability = capabilities.get(decision.capabilityId);
  if (!capability) errors.push(`decision ${decision.decisionId} references missing capability ${decision.capabilityId}`);
  else if (capability.subjectId !== decision.subjectId) {
    errors.push(`decision ${decision.decisionId} has subject mismatch with capability ${decision.capabilityId}`);
  } else if (capability.productDisposition !== decision.selectedDecision.disposition) {
    errors.push(`decision ${decision.decisionId} selected disposition contradicts capability disposition`);
  }
  for (const evidenceId of decision.evidenceIds) {
    validateSubjectEvidence("decision", decision.decisionId, decision.subjectId, evidenceId, evidence, errors);
  }
  const options = new Map(decision.options.map((option) => [option.optionId, option]));
  const selected = options.get(decision.selectedDecision.optionId);
  if (!selected) errors.push(`decision ${decision.decisionId} selected option is missing from options`);
  else if (selected.disposition !== decision.selectedDecision.disposition) {
    errors.push(`decision ${decision.decisionId} selected disposition does not match its option`);
  }
  for (const rejected of decision.rejectedAlternatives) {
    if (!options.has(rejected.optionId)) {
      errors.push(`decision ${decision.decisionId} rejected alternative ${rejected.optionId} is missing from options`);
    }
    if (rejected.optionId === decision.selectedDecision.optionId) {
      errors.push(`decision ${decision.decisionId} cannot reject the selected option`);
    }
  }
}

function validateFindingHistory(history, capabilities, decisions, evidence, errors) {
  const capability = capabilities.get(history.capabilityId);
  if (!capability) errors.push(`finding history ${history.findingId} references missing capability ${history.capabilityId}`);
  else if (capability.subjectId !== history.subjectId) {
    errors.push(`finding history ${history.findingId} has subject mismatch with capability ${history.capabilityId}`);
  }
  const decision = decisions.get(history.decisionId);
  if (!decision) errors.push(`finding history ${history.findingId} references missing-decision ${history.decisionId}`);
  else if (decision.subjectId !== history.subjectId || decision.capabilityId !== history.capabilityId) {
    errors.push(`finding history ${history.findingId} decision reference has subject or capability mismatch`);
  }

  if (history.events[0]?.state !== "DISCOVERED") {
    errors.push(`finding history ${history.findingId} must begin with DISCOVERED`);
  }
  for (let index = 0; index < history.events.length; index += 1) {
    const event = history.events[index];
    if (event.sequence !== index) errors.push(`finding history ${history.findingId} sequence must be continuous at ${index}`);
    for (const evidenceId of event.evidenceIds) {
      validateSubjectEvidence("finding history", history.findingId, history.subjectId, evidenceId, evidence, errors);
    }
    if (index === 0) continue;
    const previous = history.events[index - 1];
    if (!ALLOWED_HISTORY_TRANSITIONS.get(previous.state)?.has(event.state)) {
      errors.push(`finding history ${history.findingId} has invalid transition ${previous.state}->${event.state}`);
    }
    if (Date.parse(event.observedAt) < Date.parse(previous.observedAt)) {
      errors.push(`finding history ${history.findingId} is not chronological at sequence ${index}`);
    }
  }
}

function validateSubjectEvidence(label, recordId, subjectId, evidenceId, evidence, errors) {
  const source = evidence.get(evidenceId);
  if (!source) errors.push(`${label} ${recordId} references missing evidence ${evidenceId}`);
  else if (source.subjectId !== subjectId) errors.push(`${label} ${recordId} has subject mismatch with evidence ${evidenceId}`);
}

async function validateLocalArtifacts(evidenceRows, inputDirectory) {
  const root = await realpath(path.resolve(inputDirectory));
  const errors = [];
  for (const evidence of evidenceRows) {
    if (evidence.locator.kind !== "LOCAL_ARTIFACT") continue;
    const locatorPath = evidence.locator.path;
    if (path.isAbsolute(locatorPath) || locatorPath.split(/[\\/]/).includes("..")) {
      errors.push(`evidence ${evidence.evidenceId} local artifact locator escapes input directory`);
      continue;
    }
    const target = path.resolve(root, locatorPath);
    try {
      await assertRegularFileInsideRoot(root, target, "local artifact");
      const before = await lstat(target);
      if (before.size > MAX_LOCAL_ARTIFACT_BYTES) throw new Error("local artifact byte limit exceeded");
      const bytes = await readFile(target);
      const after = await lstat(target);
      if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
        throw new Error("local artifact changed while being hashed");
      }
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (actual !== evidence.artifactSha256) {
        errors.push(`evidence ${evidence.evidenceId} local artifact hash mismatch`);
      }
    } catch (error) {
      errors.push(`evidence ${evidence.evidenceId} local artifact validation failed: ${error.message}`);
    }
  }
  return errors;
}

async function assertRegularFileInsideRoot(root, filePath, label) {
  const normalizedRoot = `${root}${path.sep}`;
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(normalizedRoot)) throw new Error(`${label} path escapes input directory`);
  const stat = await lstat(resolved);
  if (stat.isSymbolicLink()) throw new Error(`${label} symlink is forbidden: ${path.basename(resolved)}`);
  if (!stat.isFile()) throw new Error(`${label} must be a regular file: ${path.basename(resolved)}`);
  const canonical = await realpath(resolved);
  if (!canonical.startsWith(normalizedRoot)) throw new Error(`${label} realpath escapes input directory`);
}

function findSensitivePayloads(value, pathPrefix = "") {
  if (typeof value === "string") {
    return FORBIDDEN_VALUE_PATTERNS.some((pattern) => pattern.test(value))
      ? [`${pathPrefix}: sensitive value is forbidden`]
      : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findSensitivePayloads(item, `${pathPrefix}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    return [
      ...(FORBIDDEN_KEYS.has(normalizedKey) ? [`${childPath}: sensitive field is forbidden`] : []),
      ...findSensitivePayloads(child, childPath),
    ];
  });
}

function uniqueBy(rows, key, label, errors) {
  const records = new Map();
  for (const row of rows) {
    if (records.has(row[key])) errors.push(`duplicate ${label} id ${row[key]}`);
    records.set(row[key], row);
  }
  return records;
}

function formatZodErrors(issues) {
  return issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

function by(key) {
  return (left, right) => left[key].localeCompare(right[key]);
}
