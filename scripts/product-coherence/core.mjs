import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { AuditBundleSchema, SUBJECT_IDS } from "./schemas.mjs";
import { readJsonl } from "./jsonl.mjs";

const MAX_LOCAL_ARTIFACT_BYTES = 16 * 1024 * 1024;
const execFileAsync = promisify(execFile);
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
  /(?<!\d)\d{10,18}(?!\d)/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
  /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
];
const REQUIRED_ROLE_PHASES = Object.freeze([
  "coordinator-teamlead:INITIAL",
  "coordinator-teamlead:INTEGRATION",
  "psychology-human-factors-emotional-safety:INITIAL",
  "logic-causality-state-coherence:INITIAL",
  "interaction-accessibility-readability-localization-culture:INITIAL",
  "technical-architecture-data-cross-platform:INITIAL",
  "security-privacy-agent-trust:INITIAL",
  "performance-reliability-operations:INITIAL",
  "qa-evidence-release-verification:INITIAL",
  "product-discovery-visual-craft-experience-quality:INITIAL",
  "independent-blind-spot-sentinel:PASS_A",
  "independent-blind-spot-sentinel:PASS_B",
]);
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
  const histories = uniqueBy(parsed.data.findingHistory, "findingId", "finding history", errors);

  validateRoleReceipts(parsed.data.manifest.roleReceipts, subjects, errors);
  for (const row of parsed.data.evidence) {
    if (!subjects.has(row.subjectId)) errors.push(`evidence ${row.evidenceId} references missing subject ${row.subjectId}`);
    else validateEvidenceSemantics(row, subjects.get(row.subjectId), errors);
  }
  for (const subject of parsed.data.manifest.subjects) {
    validateStageEvidence(subject, evidence, errors);
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
  validateCapabilityClosure(parsed.data.capabilities, parsed.data.decisions, parsed.data.findingHistory, errors);
  return { ok: errors.length === 0, errors };
}

export async function validateAuditBundleWithLocalArtifacts(bundle, inputDirectory, subjectRoots = {}) {
  const result = validateAuditBundle(bundle);
  if (!result.ok) return result;
  const artifactErrors = [
    ...(await validateLocalArtifacts(bundle.evidence, inputDirectory)),
    ...(await validateRepositorySources(bundle, subjectRoots)),
  ];
  return { ok: artifactErrors.length === 0, errors: artifactErrors };
}

export function renderAuditMarkdown(bundle) {
  const validation = validateAuditBundle(bundle);
  if (!validation.ok) throw new Error(`cannot render invalid audit ledger: ${validation.errors.join("; ")}`);

  const lines = ["# Product Coherence Audit", "", "## Subjects", ""];
  for (const subject of [...bundle.manifest.subjects].sort(by("subjectId"))) {
    lines.push(
      `- ${markdownText(subject.subjectId)}: git-${markdownText(subject.repository.oidAlgorithm)}:${markdownText(subject.repository.commitOid)}`,
    );
  }
  lines.push("", "## Decisions", "");
  for (const decision of [...bundle.decisions].sort(by("decisionId"))) {
    lines.push(
      `- ${markdownText(decision.subjectId)} / ${markdownText(decision.decisionId)}: ${markdownText(decision.selectedDecision.disposition)}`,
    );
  }
  lines.push("", "## Finding history", "");
  for (const history of [...bundle.findingHistory].sort(by("findingId"))) {
    lines.push(`### ${markdownText(history.findingId)} → ${markdownText(history.decisionId)}`, "");
    for (const event of history.events) {
      lines.push(`- ${event.sequence}. ${markdownText(event.observedAt)} — ${markdownText(event.state)}`);
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
  const seen = new Set();
  for (const receipt of receipts) {
    const key = `${receipt.roleId}:${receipt.phase}`;
    if (seen.has(key)) errors.push(`duplicate role receipt ${key}`);
    seen.add(key);
    const receiptSubjects = new Set(receipt.subjectIds);
    if (receiptSubjects.size !== receipt.subjectIds.length) {
      errors.push(`role receipt ${key} repeats a subject`);
    }
    for (const subjectId of receiptSubjects) {
      if (!subjects.has(subjectId)) {
        errors.push(`role receipt ${key} references missing subject ${subjectId}`);
      }
    }
    for (const subjectId of SUBJECT_IDS) {
      if (!receiptSubjects.has(subjectId)) {
        errors.push(`role receipt ${key} does not cover ${subjectId}`);
      }
    }
  }
  for (const required of REQUIRED_ROLE_PHASES) {
    if (!seen.has(required)) errors.push(`missing required role receipt ${required}`);
  }
  for (const actual of seen) {
    if (!REQUIRED_ROLE_PHASES.includes(actual)) errors.push(`unexpected role receipt ${actual}`);
  }
}

function validateStageEvidence(subject, evidence, errors) {
  if (subject.build.status === "PASS") {
    const source = validateSubjectEvidence(
      "build provenance",
      subject.subjectId,
      subject.subjectId,
      subject.build.evidenceId,
      evidence,
      errors,
    );
    if (
      source &&
      (source.evidenceClass !== "DIRECT_LOCAL" ||
        !["TEST_RESULT", "COMMAND_OUTPUT"].includes(source.evidenceType))
    ) {
      errors.push(`build provenance ${subject.subjectId} requires DIRECT_LOCAL test or command evidence`);
    }
  }
  if (subject.deploy.status === "PASS") {
    const source = validateSubjectEvidence(
      "deploy provenance",
      subject.subjectId,
      subject.subjectId,
      subject.deploy.evidenceId,
      evidence,
      errors,
    );
    if (
      source &&
      (source.evidenceClass !== "DIRECT_RUNTIME" ||
        !["RUNTIME_TRACE", "COMMAND_OUTPUT"].includes(source.evidenceType))
    ) {
      errors.push(`deploy provenance ${subject.subjectId} requires DIRECT_RUNTIME trace or command evidence`);
    }
  }
}

function validateEvidenceSemantics(evidence, subject, errors) {
  const { evidenceClass, evidenceType, locator } = evidence;
  const allowed =
    (evidenceClass === "DIRECT_LOCAL" &&
      ((locator.kind === "REPOSITORY_SOURCE" && evidenceType === "SOURCE_INSPECTION") ||
        (locator.kind === "LOCAL_ARTIFACT" &&
          ["SOURCE_INSPECTION", "COMMAND_OUTPUT", "TEST_RESULT", "SECURITY_SCAN"].includes(evidenceType)))) ||
    (evidenceClass === "DIRECT_RUNTIME" &&
      locator.kind === "LOCAL_ARTIFACT" &&
      ["RUNTIME_TRACE", "SCREENSHOT", "COMMAND_OUTPUT", "TEST_RESULT"].includes(evidenceType)) ||
    (evidenceClass === "AUTHORITATIVE_EXTERNAL" &&
      locator.kind === "AUTHORITATIVE_URL" &&
      evidenceType === "AUTHORITATIVE_DOCUMENT") ||
    (evidenceClass === "HUMAN_RESEARCH" &&
      locator.kind === "HUMAN_RECEIPT" &&
      evidenceType === "HUMAN_RESEARCH_RECEIPT") ||
    (["INFERENCE", "UNKNOWN"].includes(evidenceClass) &&
      locator.kind === "UNVERIFIABLE_REFERENCE" &&
      ["SOURCE_INSPECTION", "COMMAND_OUTPUT", "TEST_RESULT", "RUNTIME_TRACE"].includes(evidenceType));

  if (!allowed) {
    errors.push(
      `evidence ${evidence.evidenceId} has invalid evidenceClass/evidenceType/locator combination`,
    );
  }
  if (evidence.result === "PASS" && evidence.scope.platforms.length !== 1) {
    errors.push(`evidence ${evidence.evidenceId} PASS must address exactly one platform scope`);
  }
  if (locator.kind === "REPOSITORY_SOURCE") {
    if (
      locator.revision.oidAlgorithm !== subject.repository.oidAlgorithm ||
      locator.revision.commitOid !== subject.repository.commitOid
    ) {
      errors.push(`evidence ${evidence.evidenceId} repository source does not match subject revision`);
    }
    if (evidence.subjectId === "candidate") {
      if (!locator.candidateSnapshotSha256) {
        errors.push(`evidence ${evidence.evidenceId} candidate repository source requires candidate snapshot binding`);
      } else if (locator.candidateSnapshotSha256 !== subject.repository.candidateSnapshotSha256) {
        errors.push(`evidence ${evidence.evidenceId} candidate snapshot does not match subject provenance`);
      }
    } else if (locator.candidateSnapshotSha256) {
      errors.push(`evidence ${evidence.evidenceId} production source cannot carry candidate snapshot binding`);
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
  if (decision.confidence === "HIGH") {
    const classes = decision.evidenceIds
      .map((evidenceId) => evidence.get(evidenceId)?.evidenceClass)
      .filter(Boolean);
    if (!classes.some((evidenceClass) => ["DIRECT_LOCAL", "DIRECT_RUNTIME"].includes(evidenceClass))) {
      errors.push(`decision ${decision.decisionId} HIGH confidence requires direct local or runtime evidence`);
    }
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
  const rejectedCounts = new Map();
  for (const rejected of decision.rejectedAlternatives) {
    rejectedCounts.set(rejected.optionId, (rejectedCounts.get(rejected.optionId) ?? 0) + 1);
  }
  for (const option of decision.options) {
    if (option.optionId === decision.selectedDecision.optionId) continue;
    if (rejectedCounts.get(option.optionId) !== 1) {
      errors.push(`decision ${decision.decisionId} must account for rejected option ${option.optionId} exactly once`);
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
  const finalState = history.events.at(-1)?.state;
  if (decision?.selectedDecision.disposition === "BLOCKED_UNVERIFIED" && finalState !== "BLOCKED") {
    errors.push(
      `finding history ${history.findingId} contradicts BLOCKED_UNVERIFIED decision with final state ${finalState}`,
    );
  }
  if (finalState === "BLOCKED" && decision?.selectedDecision.disposition !== "BLOCKED_UNVERIFIED") {
    errors.push(
      `finding history ${history.findingId} ends BLOCKED without a BLOCKED_UNVERIFIED decision`,
    );
  }
}

function validateSubjectEvidence(label, recordId, subjectId, evidenceId, evidence, errors) {
  const source = evidence.get(evidenceId);
  if (!source) errors.push(`${label} ${recordId} references missing evidence ${evidenceId}`);
  else if (source.subjectId !== subjectId) errors.push(`${label} ${recordId} has subject mismatch with evidence ${evidenceId}`);
  return source;
}

function validateCapabilityClosure(capabilities, decisions, histories, errors) {
  const decisionCounts = new Map();
  const historyCounts = new Map();
  for (const decision of decisions) {
    const key = `${decision.subjectId}:${decision.capabilityId}`;
    decisionCounts.set(key, (decisionCounts.get(key) ?? 0) + 1);
  }
  for (const history of histories) {
    const key = `${history.subjectId}:${history.capabilityId}`;
    historyCounts.set(key, (historyCounts.get(key) ?? 0) + 1);
  }
  for (const capability of capabilities) {
    const key = `${capability.subjectId}:${capability.capabilityId}`;
    if (decisionCounts.get(key) !== 1) {
      errors.push(`capability ${capability.capabilityId} requires exactly one decision for the same subject`);
    }
    if (historyCounts.get(key) !== 1) {
      errors.push(`capability ${capability.capabilityId} requires exactly one same-subject finding history`);
    }
  }
}

async function validateLocalArtifacts(evidenceRows, inputDirectory) {
  const root = await realpath(path.resolve(inputDirectory));
  const errors = [];
  for (const evidence of evidenceRows) {
    if (evidence.locator.kind !== "LOCAL_ARTIFACT") continue;
    try {
      const bytes = await readStableFileInsideRoot(
        root,
        evidence.locator.path,
        "local artifact",
        MAX_LOCAL_ARTIFACT_BYTES,
      );
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

async function validateRepositorySources(bundle, subjectRoots) {
  const errors = [];
  const subjects = new Map(bundle.manifest.subjects.map((subject) => [subject.subjectId, subject]));
  const verifiedRoots = new Map();
  for (const evidence of bundle.evidence) {
    if (evidence.locator.kind !== "REPOSITORY_SOURCE") continue;
    const configuredRoot = subjectRoots[evidence.subjectId];
    if (!configuredRoot) {
      errors.push(`evidence ${evidence.evidenceId} requires --subject-root for ${evidence.subjectId}`);
      continue;
    }
    try {
      let root = verifiedRoots.get(evidence.subjectId);
      if (!root) {
        root = await verifySubjectRoot(configuredRoot, subjects.get(evidence.subjectId));
        verifiedRoots.set(evidence.subjectId, root);
      }
      const bytes = await readStableFileInsideRoot(
        root,
        evidence.locator.path,
        "repository source",
        MAX_LOCAL_ARTIFACT_BYTES,
      );
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (actual !== evidence.artifactSha256) {
        errors.push(`evidence ${evidence.evidenceId} repository source hash mismatch`);
      }
    } catch (error) {
      errors.push(`evidence ${evidence.evidenceId} repository source validation failed: ${error.message}`);
    }
  }
  return errors;
}

async function verifySubjectRoot(rootDirectory, subject) {
  const requested = path.resolve(rootDirectory);
  const rootStat = await lstat(requested);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("subject root must be a real directory, not a symlink");
  }
  const root = await realpath(requested);
  const { stdout: topLevelStdout } = await execFileAsync(
    "git",
    ["-C", root, "rev-parse", "--show-toplevel"],
    { encoding: "utf8" },
  );
  const topLevel = await realpath(topLevelStdout.trim());
  if (topLevel !== root) throw new Error("subject root is nested inside a different Git worktree");

  const [{ stdout: commitStdout }, { stdout: treeStdout }] = await Promise.all([
    execFileAsync("git", ["-C", root, "rev-parse", "HEAD^{commit}"], { encoding: "utf8" }),
    execFileAsync("git", ["-C", root, "rev-parse", "HEAD^{tree}"], { encoding: "utf8" }),
  ]);
  if (commitStdout.trim() !== subject.repository.commitOid) {
    throw new Error("subject root HEAD does not match manifest commit");
  }
  if (treeStdout.trim() !== subject.repository.treeOid) {
    throw new Error("subject root tree does not match manifest tree");
  }
  if (subject.subjectId === "candidate") {
    const maxBuffer = 256 * 1024 * 1024;
    const [{ stdout: statusBytes }, { stdout: diffBytes }] = await Promise.all([
      execFileAsync("git", ["-C", root, "status", "--porcelain=v1", "--untracked-files=all"], {
        encoding: "buffer",
        maxBuffer,
      }),
      execFileAsync("git", ["-C", root, "diff", "--binary", "HEAD", "--"], {
        encoding: "buffer",
        maxBuffer,
      }),
    ]);
    const statusSha256 = createHash("sha256").update(statusBytes).digest("hex");
    const diffSha256 = createHash("sha256").update(diffBytes).digest("hex");
    if (statusSha256 !== subject.repository.gitStatusSha256) {
      throw new Error("candidate subject root status does not match manifest");
    }
    if (diffSha256 !== subject.repository.trackedDiffSha256) {
      throw new Error("candidate subject root tracked diff does not match manifest");
    }
  }
  return root;
}

async function readStableFileInsideRoot(root, relativePath, label, maxBytes) {
  const normalizedRoot = `${root}${path.sep}`;
  const target = path.resolve(root, relativePath);
  if (!target.startsWith(normalizedRoot)) throw new Error(`${label} path escapes root`);

  let descriptor;
  try {
    descriptor = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const before = await descriptor.stat();
    if (!before.isFile()) throw new Error(`${label} must be a regular file`);
    if (before.size > maxBytes) throw new Error(`${label} byte limit exceeded`);
    const bytes = await descriptor.readFile();
    const after = await descriptor.stat();
    if (!sameFileIdentity(before, after) || bytes.length !== before.size) {
      throw new Error(`${label} changed while being hashed`);
    }
    const current = await lstat(target);
    if (current.isSymbolicLink() || !sameFileIdentity(before, current)) {
      throw new Error(`${label} path identity changed while being hashed`);
    }
    const canonical = await realpath(target);
    if (!canonical.startsWith(normalizedRoot)) throw new Error(`${label} realpath escapes root`);
    return bytes;
  } finally {
    await descriptor?.close();
  }
}

function sameFileIdentity(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs
  );
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
    if (isDeclaredDigestOrOid(pathPrefix, value)) return [];
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

function isDeclaredDigestOrOid(pathPrefix, value) {
  const field = pathPrefix.split(".").at(-1)?.replace(/\[\d+\]$/, "") ?? "";
  return (
    /(?:sha256|commitoid|treeoid)$/i.test(field) &&
    (/^[a-f0-9]{40}$/i.test(value) || /^[a-f0-9]{64}$/i.test(value))
  );
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
  return (left, right) =>
    Buffer.compare(Buffer.from(String(left[key]), "utf8"), Buffer.from(String(right[key]), "utf8"));
}

function markdownText(value) {
  return String(value)
    .replace(/[\r\n]+/g, " ")
    .replace(/([\\`*_{}\[\]<>#+!|])/g, "\\$1");
}
