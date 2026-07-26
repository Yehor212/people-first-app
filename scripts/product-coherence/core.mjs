import { readdir } from "node:fs/promises";
import path from "node:path";

import { AuditBundleSchema, SUBJECT_IDS } from "./schemas.mjs";
import { readJsonl } from "./jsonl.mjs";

const FORBIDDEN_FIELD = /(?:journal|mood|habit|account|token|credential|secret|password|email|phone|contact|device)/i;
const ALLOWED_TRANSITIONS = new Map([
  ["OPEN", new Set(["VERIFIED", "BLOCKED_UNVERIFIED"])],
  ["VERIFIED", new Set(["RESOLVED", "REJECTED", "BLOCKED_UNVERIFIED"])],
  ["BLOCKED_UNVERIFIED", new Set(["VERIFIED"])],
  ["RESOLVED", new Set()],
  ["REJECTED", new Set()],
]);

export function validateAuditBundle(bundle) {
  const privacyErrors = findSensitiveFields(bundle);
  if (privacyErrors.length > 0) return { ok: false, errors: privacyErrors };

  const parsed = AuditBundleSchema.safeParse(bundle);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  }

  const errors = [];
  const manifests = new Map(parsed.data.manifests.map((manifest) => [manifest.subjectId, manifest]));
  for (const requiredSubject of SUBJECT_IDS) {
    if (!manifests.has(requiredSubject)) errors.push(`missing ${requiredSubject} manifest`);
  }
  if (new Set(parsed.data.manifests.map((manifest) => manifest.subjectId)).size !== SUBJECT_IDS.length) {
    errors.push("manifest subjects must be unique");
  }

  const evidence = uniqueBy(parsed.data.evidence, "evidenceId", "evidence", errors);
  const capabilities = uniqueBy(parsed.data.capabilities, "capabilityId", "capability", errors);
  uniqueBy(parsed.data.findings, "findingId", "finding", errors);

  for (const capability of parsed.data.capabilities) {
    const source = evidence.get(capability.evidenceId);
    if (!source) errors.push(`capability ${capability.capabilityId} references missing evidence ${capability.evidenceId}`);
    else if (source.subjectId !== capability.subjectId) {
      errors.push(`capability ${capability.capabilityId} has subject mismatch with evidence ${capability.evidenceId}`);
    }
    if (capability.subjectId === "candidate" && capability.disposition === "UNRESOLVED") {
      errors.push(`candidate capability ${capability.capabilityId} remains UNRESOLVED`);
    }
  }

  for (const finding of parsed.data.findings) {
    const capability = capabilities.get(finding.capabilityId);
    if (!capability) errors.push(`finding ${finding.findingId} references missing capability ${finding.capabilityId}`);
    else if (capability.subjectId !== finding.subjectId) {
      errors.push(`finding ${finding.findingId} has subject mismatch with capability ${finding.capabilityId}`);
    }
    for (const transition of finding.transitions) {
      if (!ALLOWED_TRANSITIONS.get(transition.from)?.has(transition.to)) {
        errors.push(`finding ${finding.findingId} has invalid finding transition ${transition.from}->${transition.to}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function renderAuditMarkdown(bundle) {
  const validation = validateAuditBundle(bundle);
  if (!validation.ok) throw new Error(`cannot render invalid audit ledger: ${validation.errors.join("; ")}`);

  const lines = ["# Product Coherence Audit", "", "## Subjects", ""];
  for (const manifest of [...bundle.manifests].sort(by("subjectId"))) {
    lines.push(`- ${manifest.subjectId}: ${manifest.subjectSnapshotSha256}`);
  }
  lines.push("", "## Findings", "");
  for (const finding of [...bundle.findings].sort(by("findingId"))) {
    const lastTransition = finding.transitions.at(-1);
    lines.push(`- ${finding.subjectId} / ${finding.findingId}: ${lastTransition.to}`);
  }
  return `${lines.join("\n")}\n`;
}

export async function loadAuditBundle(inputDirectory) {
  const directory = path.resolve(inputDirectory);
  const entries = new Set(await readdir(directory));
  const expected = ["manifests", "evidence", "capabilities", "findings"];
  for (const name of expected) {
    if (!entries.has(`${name}.jsonl`)) throw new Error(`missing required ledger ${name}.jsonl`);
  }
  const [manifests, evidence, capabilities, findings] = await Promise.all(
    expected.map((name) => readJsonl(path.join(directory, `${name}.jsonl`))),
  );
  return { manifests, evidence, capabilities, findings };
}

function uniqueBy(rows, key, label, errors) {
  const records = new Map();
  for (const row of rows) {
    if (records.has(row[key])) errors.push(`duplicate ${label} id ${row[key]}`);
    records.set(row[key], row);
  }
  return records;
}

function findSensitiveFields(value, pathPrefix = "") {
  if (Array.isArray(value)) return value.flatMap((item, index) => findSensitiveFields(item, `${pathPrefix}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    return [
      ...(FORBIDDEN_FIELD.test(key) ? [`${childPath}: sensitive field is forbidden`] : []),
      ...findSensitiveFields(child, childPath),
    ];
  });
}

function by(key) {
  return (left, right) => left[key].localeCompare(right[key]);
}
