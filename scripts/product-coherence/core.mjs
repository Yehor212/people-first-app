import { readdir } from "node:fs/promises";
import path from "node:path";

import { AuditBundleSchema, SUBJECT_IDS } from "./schemas.mjs";
import { readJsonl } from "./jsonl.mjs";

const FORBIDDEN_FIELD = /(?:journal(?:payload|content|entry)?|mood(?:payload|entry)?|habit(?:payload|entry)?|account(?:payload|identifier)?|token|credential|secret|password)/i;
const FORBIDDEN_VALUE = /(?:\bBearer\s+[\w.-]+|\bsk-[\w-]{8,}|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/i;
const ALLOWED_TRANSITIONS = new Map([
  ["START", new Set(["DISCOVERED"])],
  ["DISCOVERED", new Set(["TRIAGED"])],
  ["TRIAGED", new Set(["DECIDED"])],
  ["DECIDED", new Set(["IMPLEMENTING", "REJECTED", "BLOCKED"])],
  ["IMPLEMENTING", new Set(["VERIFIED", "REJECTED", "BLOCKED", "ROLLED_BACK"])],
  ["BLOCKED", new Set(["TRIAGED"])],
  ["VERIFIED", new Set()],
  ["REJECTED", new Set()],
  ["ROLLED_BACK", new Set()],
]);

export function validateAuditBundle(bundle) {
  const privacyErrors = findSensitivePayloads(bundle);
  if (privacyErrors.length > 0) return { ok: false, errors: privacyErrors };

  const parsed = AuditBundleSchema.safeParse(bundle);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  }

  const errors = [];
  const subjects = new Map(parsed.data.manifest.subjects.map((subject) => [subject.subjectId, subject]));
  for (const requiredSubject of SUBJECT_IDS) {
    if (!subjects.has(requiredSubject)) errors.push(`missing ${requiredSubject} subject provenance`);
  }
  if (subjects.size !== SUBJECT_IDS.length) errors.push("manifest subjects must be unique");

  const evidence = uniqueBy(parsed.data.evidence, "evidenceId", "evidence", errors);
  const capabilities = uniqueBy(parsed.data.capabilities, "capabilityId", "capability", errors);
  uniqueBy(parsed.data.decisions, "decisionId", "decision", errors);
  uniqueBy(parsed.data.findingHistory, "findingId", "finding history", errors);

  for (const row of parsed.data.evidence) {
    if (!subjects.has(row.subjectId)) errors.push(`evidence ${row.evidenceId} references missing subject ${row.subjectId}`);
  }
  for (const capability of parsed.data.capabilities) {
    const source = evidence.get(capability.evidenceId);
    if (!source) errors.push(`capability ${capability.capabilityId} references missing evidence ${capability.evidenceId}`);
    else if (source.subjectId !== capability.subjectId) errors.push(`capability ${capability.capabilityId} has subject mismatch with evidence ${capability.evidenceId}`);
    if (capability.subjectId === "candidate" && capability.disposition === "UNRESOLVED_CANDIDATE") {
      errors.push(`candidate capability ${capability.capabilityId} remains UNRESOLVED_CANDIDATE`);
    }
  }
  for (const decision of parsed.data.decisions) {
    validateReference(decision, "decision", capabilities, evidence, errors);
  }
  for (const finding of parsed.data.findingHistory) {
    const capability = capabilities.get(finding.capabilityId);
    if (!capability) errors.push(`finding history ${finding.findingId} references missing capability ${finding.capabilityId}`);
    else if (capability.subjectId !== finding.subjectId) errors.push(`finding history ${finding.findingId} has subject mismatch with capability ${finding.capabilityId}`);
    for (const transition of finding.transitions) {
      if (!ALLOWED_TRANSITIONS.get(transition.from)?.has(transition.to)) {
        errors.push(`finding history ${finding.findingId} has invalid finding transition ${transition.from}->${transition.to}`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function renderAuditMarkdown(bundle) {
  const validation = validateAuditBundle(bundle);
  if (!validation.ok) throw new Error(`cannot render invalid audit ledger: ${validation.errors.join("; ")}`);

  const lines = ["# Product Coherence Audit", "", "## Subjects", ""];
  for (const subject of [...bundle.manifest.subjects].sort(by("subjectId"))) lines.push(`- ${subject.subjectId}: ${subject.repository.treeSha256}`);
  lines.push("", "## Decisions", "");
  for (const decision of [...bundle.decisions].sort(by("decisionId"))) lines.push(`- ${decision.subjectId} / ${decision.decisionId}: ${decision.disposition}`);
  lines.push("", "## Finding history", "");
  for (const finding of [...bundle.findingHistory].sort(by("findingId"))) lines.push(`- ${finding.subjectId} / ${finding.findingId}: ${finding.transitions.at(-1).to}`);
  return `${lines.join("\n")}\n`;
}

export async function loadAuditBundle(inputDirectory) {
  const directory = path.resolve(inputDirectory);
  const entries = new Set(await readdir(directory));
  const expected = ["manifest", "evidence", "capabilities", "decisions", "findingHistory"];
  for (const name of expected) if (!entries.has(`${name}.jsonl`)) throw new Error(`missing required ledger ${name}.jsonl`);
  const [manifestRows, evidence, capabilities, decisions, findingHistory] = await Promise.all(expected.map((name) => readJsonl(path.join(directory, `${name}.jsonl`))));
  if (manifestRows.length !== 1) throw new Error("manifest.jsonl must contain exactly one AuditManifest");
  return { manifest: manifestRows[0], evidence, capabilities, decisions, findingHistory };
}

function validateReference(row, label, capabilities, evidence, errors) {
  const capability = capabilities.get(row.capabilityId);
  const source = evidence.get(row.evidenceId);
  if (!capability) errors.push(`${label} ${row.decisionId} references missing capability ${row.capabilityId}`);
  else if (capability.subjectId !== row.subjectId) errors.push(`${label} ${row.decisionId} has subject mismatch with capability ${row.capabilityId}`);
  if (!source) errors.push(`${label} ${row.decisionId} references missing evidence ${row.evidenceId}`);
  else if (source.subjectId !== row.subjectId) errors.push(`${label} ${row.decisionId} has subject mismatch with evidence ${row.evidenceId}`);
}

function uniqueBy(rows, key, label, errors) {
  const records = new Map();
  for (const row of rows) {
    if (records.has(row[key])) errors.push(`duplicate ${label} id ${row[key]}`);
    records.set(row[key], row);
  }
  return records;
}

function findSensitivePayloads(value, pathPrefix = "") {
  if (typeof value === "string") return FORBIDDEN_VALUE.test(value) ? [`${pathPrefix}: sensitive value is forbidden`] : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => findSensitivePayloads(item, `${pathPrefix}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    return [...(FORBIDDEN_FIELD.test(key) ? [`${childPath}: sensitive field is forbidden`] : []), ...findSensitivePayloads(child, childPath)];
  });
}

function by(key) {
  return (left, right) => left[key].localeCompare(right[key]);
}
