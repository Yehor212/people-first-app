import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { AuditBundleSchema, DEEP_AUDIT_ROLE_PHASES, SUBJECT_IDS } from "./schemas.mjs";
import { readJsonl } from "./jsonl.mjs";

const MAX_LOCAL_ARTIFACT_BYTES = 16 * 1024 * 1024;
const MAX_UNTRACKED_FILE_BYTES = 64 * 1024 * 1024;
const MAX_UNTRACKED_TOTAL_BYTES = 512 * 1024 * 1024;
const MAX_UNTRACKED_FILES = 10_000;
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
const REQUIRED_ROLE_PHASES = Object.freeze(
  DEEP_AUDIT_ROLE_PHASES.map(([roleId, phase]) => `${roleId}:${phase}`),
);
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
  const capabilities = uniqueBySubjectAndId(
    parsed.data.capabilities,
    "capabilityId",
    "capability",
    errors,
  );
  const decisions = uniqueBy(parsed.data.decisions, "decisionId", "decision", errors);
  const histories = uniqueBy(parsed.data.findingHistory, "findingId", "finding history", errors);

  validateRoleReceipts(parsed.data.manifest, subjects, errors);
  validateAuditStatus(parsed.data.manifest, errors);
  validateRunWindow(parsed.data.manifest.runWindow, parsed.data.evidence, errors);
  validateSubjectCoverage(
    parsed.data.manifest.subjects,
    parsed.data.evidence,
    parsed.data.capabilities,
    errors,
  );
  validateCandidateSnapshotProvenance(parsed.data.manifest, errors);
  validateSubjectLedgerCoverage(parsed.data, errors);
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

export async function validateAuditBundleWithLocalArtifacts(
  bundle,
  inputDirectory,
  subjectRoots = {},
  artifactDirectory = inputDirectory,
) {
  const result = validateAuditBundle(bundle);
  if (!result.ok) return result;
  const { errors: subjectRootErrors, roots } = await validateSubjectRoots(bundle, subjectRoots);
  const artifactErrors = [
    ...subjectRootErrors,
    ...(await validateLocalArtifacts(bundle.evidence, artifactDirectory)),
    ...(await validateManifestArtifacts(bundle.manifest, artifactDirectory)),
    ...(await validateRepositorySources(bundle, roots)),
  ];
  return { ok: artifactErrors.length === 0, errors: artifactErrors };
}

export function renderAuditMarkdown(bundle) {
  const validation = validateAuditBundle(bundle);
  if (!validation.ok) throw new Error(`cannot render invalid audit ledger: ${validation.errors.join("; ")}`);

  const lines = [
    "# Product Coherence Audit",
    "",
    `Audit status: ${markdownText(bundle.manifest.auditStatus)}`,
    "",
    "## Role receipts",
    "",
  ];
  for (const receipt of [...bundle.manifest.roleReceipts].sort(bySubjectPhase)) {
    lines.push(
      `- ${markdownText(receipt.roleId)} / ${markdownText(receipt.phase)}: ${markdownText(receipt.verdict)}`,
      `  - Subjects: ${receipt.subjectIds.map(markdownText).join(", ")}`,
      `  - Artifact: ${markdownText(receipt.artifactPath)}`,
      `  - Receipt SHA-256: ${markdownText(receipt.receiptSha256)}`,
    );
  }
  const integration = bundle.manifest.coordinatorIntegrationReceipt;
  if (integration) {
    lines.push(
      `- coordinator-teamlead / INTEGRATION: ${markdownText(integration.verdict)}`,
      `  - Subjects: ${integration.subjectIds.map(markdownText).join(", ")}`,
      `  - Artifact: ${markdownText(integration.artifactPath)}`,
      `  - Receipt SHA-256: ${markdownText(integration.receiptSha256)}`,
    );
  } else {
    lines.push("- coordinator-teamlead / INTEGRATION: MISSING");
  }

  const orderedSubjects = SUBJECT_IDS.map((subjectId) =>
    bundle.manifest.subjects.find((subject) => subject.subjectId === subjectId),
  ).filter(Boolean);
  for (const subject of orderedSubjects) {
    const title = subject.subjectId === "production-baseline" ? "Production truth" : "Candidate truth";
    lines.push(
      "",
      `## ${title}`,
      "",
      `- Subject: ${markdownText(subject.subjectId)}`,
      `- Repository: git-${markdownText(subject.repository.oidAlgorithm)}:${markdownText(subject.repository.commitOid)}`,
      `- Tree: ${markdownText(subject.repository.treeOid)}`,
      ...renderStageLines("Build", subject.build),
      ...renderStageLines("Deploy", subject.deploy),
      ...(subject.subjectId === "candidate"
        ? [
            `- Status SHA-256: ${markdownText(subject.repository.gitStatusSha256)}`,
            `- Tracked diff SHA-256: ${markdownText(subject.repository.trackedDiffSha256)}`,
            `- Sanitized untracked manifest SHA-256: ${markdownText(subject.repository.sanitizedUntrackedManifestSha256)}`,
            `- Privacy scan receipt SHA-256: ${markdownText(subject.repository.privacyScanReceiptSha256)}`,
            `- Candidate snapshot SHA-256: ${markdownText(subject.repository.candidateSnapshotSha256)}`,
          ]
        : []),
      "",
      "### Inventory reconciliation",
      "",
      ...renderInventoryReconciliation(
        bundle.manifest.inventoryReconciliation?.find(
          (row) => row.subjectId === subject.subjectId,
        ),
      ),
      "",
      "### Evidence",
      "",
    );
    const subjectEvidence = bundle.evidence
      .filter((row) => row.subjectId === subject.subjectId)
      .sort(by("evidenceId"));
    for (const evidence of subjectEvidence) {
      lines.push(
        `#### ${markdownText(evidence.evidenceId)}`,
        "",
        `- Classification: ${markdownText(evidence.evidenceClass)} / ${markdownText(evidence.evidenceType)}`,
        `- Result / platform: ${markdownText(evidence.result)} / ${markdownText(evidence.scope.platforms[0])}`,
        `- Observed: ${markdownText(evidence.observedAt)}`,
        `- Tool: ${markdownText(evidence.tool.name)} ${markdownText(evidence.tool.version)}`,
        `- Device / account scope: ${markdownText(evidence.scope.deviceScope)} / ${markdownText(evidence.scope.accountCohort)}`,
        `- Locator: ${markdownText(evidenceLocatorText(evidence.locator))}`,
        `- Artifact SHA-256: ${markdownText(evidence.artifactSha256)}`,
        `- Privacy class: ${markdownText(evidence.privacyClass)}`,
        `- Invalidation triggers: ${evidence.invalidationTriggers.map(markdownText).join("; ")}`,
        "",
      );
    }

    lines.push("", "### Capabilities", "");
    const subjectCapabilities = bundle.capabilities
      .filter((row) => row.subjectId === subject.subjectId)
      .sort(by("capabilityId"));
    for (const capability of subjectCapabilities) {
      lines.push(
        `#### ${markdownText(capability.capabilityId)}`,
        "",
        `- User job: ${markdownText(capability.userJob)}`,
        `- User role: ${markdownText(capability.userRole)}`,
        `- Role: ${markdownText(capability.capabilityRole)}`,
        `- Reachability: ${markdownText(capability.reachability)}`,
        `- Disposition: ${markdownText(capability.productDisposition)}`,
        ...(capability.blocker
          ? [
              `- Blocker: ${markdownText(capability.blocker.summary)}`,
              `- Blocker owner: ${markdownText(capability.blocker.owner)}`,
            ]
          : []),
        `- Surfaces: ${capability.surfaces.map(markdownText).join("; ")}`,
        `- Platforms: ${capability.platforms.map(markdownText).join(", ")}`,
        `- Locales: ${capability.locales.map(markdownText).join(", ")}`,
        `- Cohorts: ${capability.cohorts.map(markdownText).join("; ")}`,
        `- Permissions: ${capability.permissions.map(markdownText).join("; ")}`,
        `- Data actions: ${capability.dataActions.map(markdownText).join("; ")}`,
        `- Dependencies: ${capability.dependencies.map(markdownText).join("; ")}`,
        `- Promises: ${capability.promises.map(markdownText).join("; ")}`,
        `- Evidence IDs: ${capability.evidenceIds.map(markdownText).join(", ")}`,
        `- Trace: ${capability.trace
          .map(
            (node) =>
              `${markdownText(node.kind)}:${markdownText(node.locator)} [${markdownText(node.evidenceId)}]`,
          )
          .join(" → ")}`,
        "",
      );
    }

    lines.push("### Decisions", "");
    const subjectDecisions = bundle.decisions
      .filter((row) => row.subjectId === subject.subjectId)
      .sort(by("decisionId"));
    for (const decision of subjectDecisions) {
      lines.push(
        `#### ${markdownText(decision.decisionId)}`,
        "",
        `- Capability: ${markdownText(decision.capabilityId)}`,
        `- Observation: ${markdownText(decision.observation)}`,
        `- Hypothesis: ${markdownText(decision.hypothesis)}`,
        `- Selected: ${markdownText(decision.selectedDecision.optionId)} / ${markdownText(decision.selectedDecision.disposition)}`,
        `- Rationale: ${markdownText(decision.selectedDecision.rationale)}`,
        `- Priority / confidence: ${markdownText(decision.priority)} / ${markdownText(decision.confidence)}`,
        `- Owner: ${markdownText(decision.owner)}`,
        `- Affected cohorts: ${decision.affectedCohorts.map(markdownText).join("; ")}`,
        `- Hard gates: ${decision.hardGates.map(markdownText).join("; ")}`,
        ...(decision.blocker
          ? [
              `- Blocker: ${markdownText(decision.blocker.summary)}`,
              `- Blocker owner: ${markdownText(decision.blocker.owner)}`,
            ]
          : []),
        `- Trade-offs: ${decision.tradeOffs.map(markdownText).join("; ")}`,
        `- Acceptance criteria: ${decision.acceptanceCriteria.map(markdownText).join("; ")}`,
        `- Kill criteria: ${decision.killCriteria.map(markdownText).join("; ")}`,
        `- Rollback criteria: ${decision.rollbackCriteria.map(markdownText).join("; ")}`,
        `- Metrics: ${decision.metrics
          .map((metric) => `${markdownText(metric.metricId)} — ${markdownText(metric.target)}`)
          .join("; ")}`,
        `- Evidence IDs: ${decision.evidenceIds.map(markdownText).join(", ")}`,
        `- Rejected alternatives: ${decision.rejectedAlternatives
          .map((item) => `${markdownText(item.optionId)} — ${markdownText(item.reason)}`)
          .join("; ")}`,
        "",
      );
    }

    lines.push("### Finding history", "");
    const subjectHistories = bundle.findingHistory
      .filter((row) => row.subjectId === subject.subjectId)
      .sort(by("findingId"));
    for (const history of subjectHistories) {
      lines.push(`#### ${markdownText(history.findingId)} → ${markdownText(history.decisionId)}`, "");
      for (const event of history.events) {
        lines.push(
          `- ${event.sequence}. ${markdownText(event.observedAt)} — ${markdownText(event.state)} — evidence: ${event.evidenceIds.map(markdownText).join(", ")}`,
        );
      }
      lines.push("");
    }
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
    ledgerPaths.map((filePath) => readJsonl(filePath, { expectedRoot: root })),
  );
  if (manifestRows.length !== 1) throw new Error("manifest.jsonl must contain exactly one AuditManifest");
  return { manifest: manifestRows[0], evidence, capabilities, decisions, findingHistory };
}

export function computeCandidateSnapshotSha256(repository) {
  return createHash("sha256").update(candidateSnapshotBody(repository)).digest("hex");
}

function validateCandidateSnapshotProvenance(manifest, errors) {
  const candidate = manifest.subjects.find((subject) => subject.subjectId === "candidate");
  if (!candidate) return;
  const expected = computeCandidateSnapshotSha256(candidate.repository);
  if (candidate.repository.candidateSnapshotSha256 !== expected) {
    errors.push("candidate snapshot digest does not match canonical candidate provenance");
  }
}

function validateSubjectLedgerCoverage(bundle, errors) {
  for (const [ledgerName, rows] of [
    ["evidence", bundle.evidence],
    ["capabilities", bundle.capabilities],
    ["decisions", bundle.decisions],
    ["findingHistory", bundle.findingHistory],
  ]) {
    for (const subjectId of SUBJECT_IDS) {
      if (!rows.some((row) => row.subjectId === subjectId)) {
        errors.push(`${ledgerName} has no records for ${subjectId}`);
      }
    }
  }
}

function validateAuditStatus(manifest, errors) {
  const reconciliation = manifest.inventoryReconciliation ?? [];
  const reconciliationBySubject = new Map();
  for (const row of reconciliation) {
    if (reconciliationBySubject.has(row.subjectId)) {
      errors.push(`duplicate inventory reconciliation for ${row.subjectId}`);
    }
    reconciliationBySubject.set(row.subjectId, row);
    if (
      row.candidateCount !==
      row.capabilityMappedCount + row.excludedCandidateCount + row.unclassifiedCandidateCount
    ) {
      errors.push(`inventory reconciliation candidate count is inconsistent for ${row.subjectId}`);
    }
  }
  if (manifest.auditStatus !== "AUDIT_COMPLETE") return;

  for (const subjectId of SUBJECT_IDS) {
    const row = reconciliationBySubject.get(subjectId);
    if (!row) {
      errors.push(`AUDIT_COMPLETE requires inventory reconciliation for ${subjectId}`);
    } else if (row.unclassifiedCandidateCount !== 0) {
      errors.push(
        `AUDIT_COMPLETE requires ${subjectId} unclassified candidate count to be zero`,
      );
    }
  }

  const receipts = new Map(
    manifest.roleReceipts.map((receipt) => [`${receipt.roleId}:${receipt.phase}`, receipt]),
  );
  for (const required of REQUIRED_ROLE_PHASES) {
    const receipt = receipts.get(required);
    if (!receipt) errors.push(`AUDIT_COMPLETE requires canonical role receipt ${required}`);
    else if (receipt.verdict !== "GO") {
      errors.push(`AUDIT_COMPLETE requires GO verdict for ${required}`);
    }
  }
  if (!manifest.coordinatorIntegrationReceipt) {
    errors.push("AUDIT_COMPLETE requires coordinator integration receipt");
  } else if (manifest.coordinatorIntegrationReceipt.verdict !== "GO") {
    errors.push("AUDIT_COMPLETE requires coordinator integration GO");
  }
}

function validateRoleReceipts(manifest, subjects, errors) {
  const { coordinatorIntegrationReceipt, roleReceipts: receipts } = manifest;
  const seen = new Set();
  const seenHashes = new Set();
  const seenArtifactPaths = new Set();
  for (const receipt of receipts) {
    const key = `${receipt.roleId}:${receipt.phase}`;
    if (seen.has(key)) errors.push(`duplicate role receipt ${key}`);
    seen.add(key);
    if (seenHashes.has(receipt.receiptSha256)) {
      errors.push(`duplicate role receipt hash ${receipt.receiptSha256}`);
    }
    seenHashes.add(receipt.receiptSha256);
    if (seenArtifactPaths.has(receipt.artifactPath)) {
      errors.push(`duplicate role receipt artifact path ${receipt.artifactPath}`);
    }
    seenArtifactPaths.add(receipt.artifactPath);
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
  for (const actual of seen) {
    if (!REQUIRED_ROLE_PHASES.includes(actual)) errors.push(`unexpected role receipt ${actual}`);
  }

  if (coordinatorIntegrationReceipt) {
    if (seenHashes.has(coordinatorIntegrationReceipt.receiptSha256)) {
      errors.push(`duplicate role receipt hash ${coordinatorIntegrationReceipt.receiptSha256}`);
    }
    if (seenArtifactPaths.has(coordinatorIntegrationReceipt.artifactPath)) {
      errors.push(`duplicate role receipt artifact path ${coordinatorIntegrationReceipt.artifactPath}`);
    }
    const coordinatorSubjects = new Set(coordinatorIntegrationReceipt.subjectIds);
    if (coordinatorSubjects.size !== coordinatorIntegrationReceipt.subjectIds.length) {
      errors.push("coordinator integration receipt repeats a subject");
    }
    for (const subjectId of SUBJECT_IDS) {
      if (!coordinatorSubjects.has(subjectId)) {
        errors.push(`coordinator integration receipt does not cover ${subjectId}`);
      }
    }
  }
}

function validateRunWindow(runWindow, evidenceRows, errors) {
  const startedAt = Date.parse(runWindow.startedAt);
  const observedThrough = Date.parse(runWindow.observedThrough);
  if (startedAt > observedThrough) errors.push("audit run window starts after observedThrough");
  for (const evidence of evidenceRows) {
    const observedAt = Date.parse(evidence.observedAt);
    if (observedAt < startedAt || observedAt > observedThrough) {
      errors.push(`evidence ${evidence.evidenceId} observedAt falls outside the declared audit run window`);
    }
  }
}

function validateSubjectCoverage(subjectRows, evidenceRows, capabilityRows, errors) {
  for (const subject of subjectRows) {
    const hasDirectEvidence = evidenceRows.some(
      (evidence) =>
        evidence.subjectId === subject.subjectId &&
        ["DIRECT_LOCAL", "DIRECT_RUNTIME"].includes(evidence.evidenceClass),
    );
    if (!hasDirectEvidence) {
      errors.push(`subject ${subject.subjectId} requires direct evidence coverage`);
    }
    if (!capabilityRows.some((capability) => capability.subjectId === subject.subjectId)) {
      errors.push(`subject ${subject.subjectId} requires capability coverage`);
    }
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
    if (source && source.result !== "PASS") {
      errors.push(`build provenance ${subject.subjectId} requires cited evidence with PASS result`);
    }
    if (source && subject.build.artifactSha256 !== source.artifactSha256) {
      errors.push(`build provenance ${subject.subjectId} artifact hash does not match cited evidence`);
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
    if (source && source.result !== "PASS") {
      errors.push(`deploy provenance ${subject.subjectId} requires cited evidence with PASS result`);
    }
    if (source && subject.deploy.artifactSha256 !== source.artifactSha256) {
      errors.push(`deploy provenance ${subject.subjectId} artifact hash does not match cited evidence`);
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
  if (evidence.scope.platforms.length !== 1) {
    errors.push(`evidence ${evidence.evidenceId} must address exactly one platform scope`);
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
  const capability = capabilities.get(subjectRecordKey(decision.subjectId, decision.capabilityId));
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
    const qualifyingEvidence = decision.evidenceIds
      .map((evidenceId) => evidence.get(evidenceId))
      .filter(
        (row) =>
          row?.result === "PASS" &&
          ["DIRECT_LOCAL", "DIRECT_RUNTIME", "HUMAN_RESEARCH"].includes(row.evidenceClass),
      );
    if (qualifyingEvidence.length === 0) {
      errors.push(
        `decision ${decision.decisionId} HIGH confidence requires PASS direct local, runtime, or artifact-bound human research evidence`,
      );
    }
  }
  const optionIds = new Set();
  for (const option of decision.options) {
    if (optionIds.has(option.optionId)) {
      errors.push(`decision ${decision.decisionId} has duplicate option id ${option.optionId}`);
    }
    optionIds.add(option.optionId);
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
  const capability = capabilities.get(subjectRecordKey(history.subjectId, history.capabilityId));
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

async function validateManifestArtifacts(manifest, inputDirectory) {
  const requestedRoot = path.resolve(inputDirectory);
  const rootStat = await lstat(requestedRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("artifact root must be a real directory, not a symlink");
  }
  const root = await realpath(requestedRoot);
  const errors = [];
  const candidate = manifest.subjects.find((subject) => subject.subjectId === "candidate");
  if (candidate) {
    const { repository } = candidate;
    let untrackedArtifact;
    try {
      untrackedArtifact = await readAndHashArtifact(
        root,
        repository.sanitizedUntrackedManifestPath,
        "candidate sanitized untracked manifest",
      );
      if (untrackedArtifact.sha256 !== repository.sanitizedUntrackedManifestSha256) {
        errors.push("candidate sanitized untracked manifest artifact hash mismatch");
      }
      validateSanitizedUntrackedManifest(untrackedArtifact.bytes);
    } catch (error) {
      errors.push(`candidate sanitized untracked manifest validation failed: ${error.message}`);
    }

    try {
      const privacyArtifact = await readAndHashArtifact(
        root,
        repository.privacyScanReceiptPath,
        "candidate privacy scan receipt",
      );
      if (privacyArtifact.sha256 !== repository.privacyScanReceiptSha256) {
        errors.push("candidate privacy scan receipt artifact hash mismatch");
      }
      const receipt = parseCanonicalJson(privacyArtifact.bytes, "candidate privacy scan receipt");
      if (
        !hasExactKeys(receipt, [
          "schemaVersion",
          "subjectId",
          "scanStatus",
          "scannedArtifactSha256",
          "findingCount",
        ]) ||
        receipt.schemaVersion !== "1.0.0" ||
        receipt.subjectId !== "candidate" ||
        receipt.scanStatus !== "PASS" ||
        receipt.scannedArtifactSha256 !== repository.sanitizedUntrackedManifestSha256 ||
        receipt.findingCount !== 0
      ) {
        throw new Error("candidate privacy scan receipt content does not prove a clean sanitized manifest");
      }
    } catch (error) {
      errors.push(`candidate privacy scan receipt validation failed: ${error.message}`);
    }

    try {
      const snapshotArtifact = await readAndHashArtifact(
        root,
        repository.candidateSnapshotPath,
        "candidate snapshot",
      );
      if (snapshotArtifact.sha256 !== repository.candidateSnapshotSha256) {
        errors.push("candidate snapshot artifact hash mismatch");
      }
      const expectedBody = candidateSnapshotBody(repository);
      if (!snapshotArtifact.bytes.equals(Buffer.from(expectedBody, "utf8"))) {
        errors.push("candidate snapshot artifact content does not match manifest provenance");
      }
    } catch (error) {
      errors.push(`candidate snapshot validation failed: ${error.message}`);
    }
  }

  const receipts = [
    ...manifest.roleReceipts,
    ...(manifest.coordinatorIntegrationReceipt ? [manifest.coordinatorIntegrationReceipt] : []),
  ];
  for (const receipt of receipts) {
    const label = `role receipt ${receipt.roleId}:${receipt.phase}`;
    try {
      const artifact = await readAndHashArtifact(root, receipt.artifactPath, label);
      if (artifact.sha256 !== receipt.receiptSha256) {
        errors.push(`${label} artifact hash mismatch`);
      }
      const expectedBody = roleReceiptBody(receipt);
      if (!artifact.bytes.equals(Buffer.from(expectedBody, "utf8"))) {
        errors.push(`${label} artifact identity does not match manifest receipt`);
      }
    } catch (error) {
      errors.push(`${label} validation failed: ${error.message}`);
    }
  }
  for (const row of manifest.inventoryReconciliation ?? []) {
    const label = `inventory reconciliation ${row.subjectId}`;
    try {
      const artifact = await readAndHashArtifact(root, row.artifactPath, label);
      if (artifact.sha256 !== row.artifactSha256) {
        errors.push(`${label} artifact hash mismatch`);
      }
      const expectedBody = inventoryReconciliationBody(row);
      if (!artifact.bytes.equals(Buffer.from(expectedBody, "utf8"))) {
        errors.push(`${label} artifact content does not match manifest reconciliation`);
      }
    } catch (error) {
      errors.push(`${label} validation failed: ${error.message}`);
    }
  }
  return errors;
}

async function readAndHashArtifact(root, relativePath, label) {
  const bytes = await readStableFileInsideRoot(root, relativePath, label, MAX_LOCAL_ARTIFACT_BYTES);
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}

function validateSanitizedUntrackedManifest(bytes) {
  const value = parseCanonicalJson(bytes, "candidate sanitized untracked manifest");
  if (
    !hasExactKeys(value, ["schemaVersion", "subjectId", "entries"]) ||
    value.schemaVersion !== "1.0.0" ||
    value.subjectId !== "candidate" ||
    !Array.isArray(value.entries) ||
    value.entries.length > MAX_UNTRACKED_FILES
  ) {
    throw new Error("candidate sanitized untracked manifest has invalid structure");
  }
  for (const entry of value.entries) {
    if (
      !hasExactKeys(entry, ["pathSha256", "contentSha256"]) ||
      !/^[a-f0-9]{64}$/.test(entry.pathSha256) ||
      !/^[a-f0-9]{64}$/.test(entry.contentSha256)
    ) {
      throw new Error("candidate sanitized untracked manifest exposes or malforms an entry");
    }
  }
}

function parseCanonicalJson(bytes, label) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not strict UTF-8`);
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  if (`${JSON.stringify(value)}\n` !== text) {
    throw new Error(`${label} is not canonical single-record JSON`);
  }
  return value;
}

function hasExactKeys(value, expectedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function candidateSnapshotBody(repository) {
  return `${JSON.stringify({
    schemaVersion: "1.0.0",
    subjectId: "candidate",
    repository: {
      oidAlgorithm: repository.oidAlgorithm,
      commitOid: repository.commitOid,
      treeOid: repository.treeOid,
      gitStatusSha256: repository.gitStatusSha256,
      trackedDiffSha256: repository.trackedDiffSha256,
      sanitizedUntrackedManifestSha256: repository.sanitizedUntrackedManifestSha256,
      privacyScanReceiptSha256: repository.privacyScanReceiptSha256,
    },
  })}\n`;
}

function roleReceiptBody(receipt) {
  return `${JSON.stringify({
    schemaVersion: "1.0.0",
    roleId: receipt.roleId,
    phase: receipt.phase,
    subjectIds: receipt.subjectIds,
    verdict: receipt.verdict,
  })}\n`;
}

function inventoryReconciliationBody(row) {
  return `${JSON.stringify({
    schemaVersion: "1.0.0",
    subjectId: row.subjectId,
    candidateCount: row.candidateCount,
    capabilityMappedCount: row.capabilityMappedCount,
    excludedCandidateCount: row.excludedCandidateCount,
    unclassifiedCandidateCount: row.unclassifiedCandidateCount,
  })}\n`;
}

async function validateLocalArtifacts(evidenceRows, inputDirectory) {
  const requestedRoot = path.resolve(inputDirectory);
  const rootStat = await lstat(requestedRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("artifact root must be a real directory, not a symlink");
  }
  const root = await realpath(requestedRoot);
  const errors = [];
  for (const evidence of evidenceRows) {
    const relativePath =
      evidence.locator.kind === "LOCAL_ARTIFACT"
        ? evidence.locator.path
        : evidence.locator.kind === "HUMAN_RECEIPT"
          ? evidence.locator.artifactPath
          : undefined;
    if (!relativePath) continue;
    const artifactLabel =
      evidence.locator.kind === "HUMAN_RECEIPT" ? "human research receipt" : "local artifact";
    try {
      const bytes = await readStableFileInsideRoot(
        root,
        relativePath,
        artifactLabel,
        MAX_LOCAL_ARTIFACT_BYTES,
      );
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (actual !== evidence.artifactSha256) {
        errors.push(`evidence ${evidence.evidenceId} ${artifactLabel} hash mismatch`);
      }
      if (evidence.locator.kind === "HUMAN_RECEIPT") {
        const receipt = parseCanonicalJson(bytes, artifactLabel);
        if (
          !hasExactKeys(receipt, ["schemaVersion", "receiptId", "studyStatus"]) ||
          receipt.schemaVersion !== "1.0.0" ||
          receipt.receiptId !== evidence.locator.receiptId ||
          receipt.studyStatus !== "COMPLETE"
        ) {
          throw new Error("human research receipt content does not match locator identity");
        }
      }
    } catch (error) {
      errors.push(
        `evidence ${evidence.evidenceId} ${artifactLabel} validation failed: ${error.message}`,
      );
    }
  }
  return errors;
}

async function validateSubjectRoots(bundle, subjectRoots) {
  const errors = [];
  const roots = new Map();
  for (const subject of bundle.manifest.subjects) {
    const configuredRoot = subjectRoots[subject.subjectId];
    if (!configuredRoot) {
      errors.push(`subject ${subject.subjectId} requires --subject-root`);
      continue;
    }
    try {
      roots.set(subject.subjectId, await verifySubjectRoot(configuredRoot, subject));
    } catch (error) {
      errors.push(`subject ${subject.subjectId} root validation failed: ${error.message}`);
    }
  }
  return { errors, roots };
}

async function validateRepositorySources(bundle, verifiedRoots) {
  const errors = [];
  const subjects = new Map(bundle.manifest.subjects.map((subject) => [subject.subjectId, subject]));
  for (const evidence of bundle.evidence) {
    if (evidence.locator.kind !== "REPOSITORY_SOURCE") continue;
    const root = verifiedRoots.get(evidence.subjectId);
    if (!root) {
      errors.push(`evidence ${evidence.evidenceId} repository source has no verified subject root`);
      continue;
    }
    try {
      const subject = subjects.get(evidence.subjectId);
      const bytes =
        subject.subjectId === "production-baseline"
          ? await readGitBlob(root, subject.repository.commitOid, evidence.locator.path)
          : await readStableFileInsideRoot(
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
  const maxBuffer = 256 * 1024 * 1024;
  const { stdout: statusBytes } = await execFileAsync(
    "git",
    ["-C", root, "status", "--porcelain=v1", "--untracked-files=all"],
    {
      encoding: "buffer",
      maxBuffer,
    },
  );
  if (subject.subjectId === "production-baseline") {
    if (statusBytes.length !== 0) {
      throw new Error("production baseline subject root must be clean");
    }
  } else {
    const [{ stdout: diffBytes }, untrackedManifest] = await Promise.all([
      execFileAsync("git", ["-C", root, "diff", "--binary", "HEAD", "--"], {
        encoding: "buffer",
        maxBuffer,
      }),
      computeSanitizedUntrackedManifest(root),
    ]);
    const statusSha256 = createHash("sha256").update(statusBytes).digest("hex");
    const diffSha256 = createHash("sha256").update(diffBytes).digest("hex");
    if (statusSha256 !== subject.repository.gitStatusSha256) {
      throw new Error("candidate subject root status does not match manifest");
    }
    if (diffSha256 !== subject.repository.trackedDiffSha256) {
      throw new Error("candidate subject root tracked diff does not match manifest");
    }
    if (untrackedManifest.sha256 !== subject.repository.sanitizedUntrackedManifestSha256) {
      throw new Error("candidate subject root sanitized untracked manifest does not match manifest");
    }
    if (
      computeCandidateSnapshotSha256(subject.repository) !==
      subject.repository.candidateSnapshotSha256
    ) {
      throw new Error("candidate subject root snapshot digest does not match manifest provenance");
    }
  }
  return root;
}

export async function computeSanitizedUntrackedManifest(rootDirectory) {
  const root = await realpath(path.resolve(rootDirectory));
  const { stdout } = await execFileAsync(
    "git",
    ["-C", root, "ls-files", "--others", "--exclude-standard", "-z"],
    { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 },
  );
  const rawPaths = splitNulBuffer(stdout);
  if (rawPaths.length > MAX_UNTRACKED_FILES) {
    throw new Error("candidate untracked file count limit exceeded");
  }
  rawPaths.sort(Buffer.compare);

  const entries = [];
  let totalBytes = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (const rawPath of rawPaths) {
    let relativePath;
    try {
      relativePath = decoder.decode(rawPath);
    } catch {
      throw new Error("candidate untracked path is not strict UTF-8");
    }
    const bytes = await readStableFileInsideRoot(
      root,
      relativePath,
      "candidate untracked file",
      MAX_UNTRACKED_FILE_BYTES,
    );
    totalBytes += bytes.length;
    if (totalBytes > MAX_UNTRACKED_TOTAL_BYTES) {
      throw new Error("candidate untracked aggregate byte limit exceeded");
    }
    entries.push({
      pathSha256: createHash("sha256").update(rawPath).digest("hex"),
      contentSha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  const body = Buffer.from(
    `${JSON.stringify({
      schemaVersion: "1.0.0",
      subjectId: "candidate",
      entries,
    })}\n`,
    "utf8",
  );
  return {
    body,
    sha256: createHash("sha256").update(body).digest("hex"),
    fileCount: entries.length,
    totalBytes,
  };
}

async function readGitBlob(root, commitOid, relativePath) {
  const maxBuffer = MAX_LOCAL_ARTIFACT_BYTES + 1;
  const { stdout } = await execFileAsync(
    "git",
    ["-C", root, "show", `${commitOid}:${relativePath}`],
    { encoding: "buffer", maxBuffer },
  );
  if (stdout.length > MAX_LOCAL_ARTIFACT_BYTES) {
    throw new Error("repository source byte limit exceeded");
  }
  return stdout;
}

function splitNulBuffer(value) {
  const entries = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== 0) continue;
    if (index > start) entries.push(value.subarray(start, index));
    start = index + 1;
  }
  if (start !== value.length) {
    throw new Error("git untracked path list is not NUL terminated");
  }
  return entries;
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

function uniqueBySubjectAndId(rows, key, label, errors) {
  const records = new Map();
  for (const row of rows) {
    const compositeKey = subjectRecordKey(row.subjectId, row[key]);
    if (records.has(compositeKey)) {
      errors.push(`duplicate ${label} id ${row[key]} for ${row.subjectId}`);
    }
    records.set(compositeKey, row);
  }
  return records;
}

function subjectRecordKey(subjectId, recordId) {
  return `${subjectId}:${recordId}`;
}

function formatZodErrors(issues) {
  return issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

function by(key) {
  return (left, right) =>
    Buffer.compare(Buffer.from(String(left[key]), "utf8"), Buffer.from(String(right[key]), "utf8"));
}

function bySubjectPhase(left, right) {
  return Buffer.compare(
    Buffer.from(`${left.roleId}:${left.phase}`, "utf8"),
    Buffer.from(`${right.roleId}:${right.phase}`, "utf8"),
  );
}

function renderStageLines(label, stage) {
  const lines = [`- ${label}: ${markdownText(stage.status)}`];
  if (stage.reason) lines.push(`  - Reason: ${markdownText(stage.reason)}`);
  if (stage.artifactSha256) {
    lines.push(`  - Artifact SHA-256: ${markdownText(stage.artifactSha256)}`);
  }
  if (stage.evidenceId) lines.push(`  - Evidence ID: ${markdownText(stage.evidenceId)}`);
  if (stage.publicUrl) lines.push(`  - Public URL: ${markdownText(stage.publicUrl)}`);
  if (stage.deployedRevision) {
    lines.push(
      `  - Deployed revision: git-${markdownText(stage.deployedRevision.oidAlgorithm)}:${markdownText(stage.deployedRevision.commitOid)}`,
    );
  }
  return lines;
}

function renderInventoryReconciliation(row) {
  if (!row) return ["- Status: NOT_DECLARED"];
  return [
    `- Candidates: ${row.candidateCount}`,
    `- Capability-mapped candidates: ${row.capabilityMappedCount}`,
    `- Evidence-backed exclusions: ${row.excludedCandidateCount}`,
    `- Unclassified candidates: ${row.unclassifiedCandidateCount}`,
    `- Artifact: ${markdownText(row.artifactPath)}`,
    `- Artifact SHA-256: ${markdownText(row.artifactSha256)}`,
  ];
}

function evidenceLocatorText(locator) {
  if (locator.kind === "REPOSITORY_SOURCE") {
    const snapshot = locator.candidateSnapshotSha256
      ? `; candidate snapshot ${locator.candidateSnapshotSha256}`
      : "";
    return `${locator.path} @ git-${locator.revision.oidAlgorithm}:${locator.revision.commitOid}${snapshot}`;
  }
  if (locator.kind === "LOCAL_ARTIFACT") return locator.path;
  if (locator.kind === "AUTHORITATIVE_URL") return locator.url;
  if (locator.kind === "HUMAN_RECEIPT") {
    return `human receipt ${locator.receiptId} at ${locator.artifactPath}`;
  }
  return `${locator.value}; reason: ${locator.reason}`;
}

function markdownText(value) {
  return String(value)
    .replace(/[\r\n]+/g, " ")
    .replace(/([\\`*_{}\[\]<>#+!|])/g, "\\$1");
}
