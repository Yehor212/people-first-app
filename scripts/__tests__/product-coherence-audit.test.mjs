import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  computeCandidateSnapshotSha256,
  computeSanitizedUntrackedManifest,
  renderAuditMarkdown,
  validateAuditBundle,
} from "../product-coherence/core.mjs";
import { enumerateRepositoryCandidates } from "../product-coherence/inventory.mjs";
import { JSONL_LIMITS, readJsonl } from "../product-coherence/jsonl.mjs";

const CLI = path.resolve("scripts/product-coherence/cli.mjs");
const SHA = "a".repeat(64);
const OTHER_SHA = "b".repeat(64);
const BASELINE_COMMIT = "1".repeat(40);
const BASELINE_TREE = "2".repeat(40);
const DEPLOYED_COMMIT = "3".repeat(40);
const CANDIDATE_COMMIT = "4".repeat(40);
const CANDIDATE_TREE = "5".repeat(40);
const DEEP_AUDIT_REGISTRY_VERSION = "zenflow-risk-registry-v2.2.1-e1";
const DEEP_AUDIT_REGISTRY_SHA = "061aac41532f1c928cbcaca38f5b7c2e33f61a4e303e5382c6c04d0c05f9e88a";
const BUILD_EVIDENCE_BODY = "build verification evidence\n";
const DEPLOY_EVIDENCE_BODY = "deployment verification evidence\n";
const BASELINE_SOURCE_BODY = "bounded baseline source evidence\n";
const BUILD_EVIDENCE_SHA = createHash("sha256").update(BUILD_EVIDENCE_BODY).digest("hex");
const DEPLOY_EVIDENCE_SHA = createHash("sha256").update(DEPLOY_EVIDENCE_BODY).digest("hex");
const BASELINE_SOURCE_SHA = createHash("sha256").update(BASELINE_SOURCE_BODY).digest("hex");
const CANDIDATE_MANIFEST_PATH = "artifacts/provenance/candidate-untracked-manifest.json";
const CANDIDATE_PRIVACY_PATH = "artifacts/provenance/candidate-privacy-receipt.json";
const CANDIDATE_SNAPSHOT_PATH = "artifacts/provenance/candidate-snapshot.json";
const CANDIDATE_MANIFEST_BODY = `${JSON.stringify({
  schemaVersion: "1.0.0",
  subjectId: "candidate",
  entries: [],
})}\n`;
const CANDIDATE_MANIFEST_SHA = createHash("sha256").update(CANDIDATE_MANIFEST_BODY).digest("hex");
const CANDIDATE_PRIVACY_BODY = candidatePrivacyBody(CANDIDATE_MANIFEST_SHA);
const CANDIDATE_PRIVACY_SHA = createHash("sha256").update(CANDIDATE_PRIVACY_BODY).digest("hex");

function validBundle() {
  const candidateRepository = {
    oidAlgorithm: "sha1",
    commitOid: CANDIDATE_COMMIT,
    treeOid: CANDIDATE_TREE,
    gitStatusSha256: SHA,
    trackedDiffSha256: OTHER_SHA,
    sanitizedUntrackedManifestSha256: CANDIDATE_MANIFEST_SHA,
    sanitizedUntrackedManifestPath: CANDIDATE_MANIFEST_PATH,
    privacyScanReceiptSha256: CANDIDATE_PRIVACY_SHA,
    privacyScanReceiptPath: CANDIDATE_PRIVACY_PATH,
    candidateSnapshotPath: CANDIDATE_SNAPSHOT_PATH,
  };
  candidateRepository.candidateSnapshotSha256 = candidateSnapshotDigest(candidateRepository);
  const evidence = [
    artifactEvidenceRecord(
      "baseline-evidence",
      "DIRECT_LOCAL",
      "SOURCE_INSPECTION",
      "artifacts/baseline-source.txt",
      BASELINE_SOURCE_SHA,
      "TESTING",
    ),
    artifactEvidenceRecord(
      "candidate-evidence",
      "DIRECT_LOCAL",
      "SOURCE_INSPECTION",
      CANDIDATE_MANIFEST_PATH,
      CANDIDATE_MANIFEST_SHA,
      "TESTING",
      "candidate",
    ),
    artifactEvidenceRecord(
      "baseline-build-evidence",
      "DIRECT_LOCAL",
      "TEST_RESULT",
      "artifacts/build.txt",
      BUILD_EVIDENCE_SHA,
      "TESTING",
    ),
    artifactEvidenceRecord(
      "baseline-deploy-evidence",
      "DIRECT_RUNTIME",
      "RUNTIME_TRACE",
      "artifacts/deploy.txt",
      DEPLOY_EVIDENCE_SHA,
      "WEB",
    ),
  ];
  return {
    manifest: {
      runId: "product-coherence-contract",
      schemaVersion: "1.0.0",
      requestSha256: SHA,
      policySha256: SHA,
      toolInventorySha256: SHA,
      sourceLedgerSha256: SHA,
      auditStatus: "IN_PROGRESS",
      classificationRegistryVersion: DEEP_AUDIT_REGISTRY_VERSION,
      classificationRegistrySha256: DEEP_AUDIT_REGISTRY_SHA,
      runWindow: {
        startedAt: "2026-07-26T15:59:00.000Z",
        observedThrough: "2026-07-26T16:10:00.000Z",
      },
      redactionRules: ["NO_RAW_SENSITIVE_PAYLOADS", "HASH_IDENTIFIERS"],
      subjects: [
        {
          subjectId: "production-baseline",
          repository: {
            oidAlgorithm: "sha1",
            commitOid: BASELINE_COMMIT,
            treeOid: BASELINE_TREE,
          },
          build: {
            status: "PASS",
            artifactSha256: BUILD_EVIDENCE_SHA,
            evidenceId: "baseline-build-evidence",
          },
          deploy: {
            status: "PASS",
            artifactSha256: DEPLOY_EVIDENCE_SHA,
            publicUrl: "https://yehor212.github.io/people-first-app/",
            deployedRevision: { oidAlgorithm: "sha1", commitOid: DEPLOYED_COMMIT },
            evidenceId: "baseline-deploy-evidence",
          },
        },
        {
          subjectId: "candidate",
          repository: candidateRepository,
          build: { status: "UNVERIFIED", reason: "Task 1 validates the contract only." },
          deploy: { status: "N/A", reason: "Candidate deployment is outside Task 1." },
        },
      ],
      roleReceipts: roleReceipts(),
      coordinatorIntegrationReceipt: receiptRecord("coordinator-teamlead", "INTEGRATION"),
    },
    evidence,
    capabilities: [
      capabilityRecord("baseline-capability", "production-baseline", "baseline-evidence"),
      capabilityRecord("candidate-capability", "candidate", "candidate-evidence"),
    ],
    decisions: [
      decisionRecord("decision-1", "production-baseline", "baseline-capability", "baseline-evidence"),
      decisionRecord("decision-2", "candidate", "candidate-capability", "candidate-evidence"),
    ],
    findingHistory: [
      findingHistoryRecord(
        "finding-1",
        "production-baseline",
        "baseline-capability",
        "decision-1",
        "baseline-evidence",
      ),
      findingHistoryRecord(
        "finding-2",
        "candidate",
        "candidate-capability",
        "decision-2",
        "candidate-evidence",
      ),
    ],
  };
}

function roleReceipts() {
  const subjectIds = ["production-baseline", "candidate"];
  return [
    ["independent-blind-spot-sentinel", "PASS_A"],
    ["psychology-human-factors-emotional-safety", "CREATE_BRIEF"],
    ["logic-causality-state-coherence", "INITIAL_REVIEW"],
    ["interaction-accessibility-readability-localization-culture", "INITIAL_REVIEW"],
    ["technical-architecture-data-cross-platform", "INITIAL_REVIEW"],
    ["security-privacy-agent-trust", "INITIAL_REVIEW"],
    ["performance-reliability-operations", "INITIAL_REVIEW"],
    ["product-discovery-visual-craft-experience-quality", "INITIAL_REVIEW"],
    ["psychology-human-factors-emotional-safety", "INDEPENDENT_FINAL_REVIEW"],
    ["logic-causality-state-coherence", "FINAL_REVIEW"],
    ["interaction-accessibility-readability-localization-culture", "FINAL_REVIEW"],
    ["technical-architecture-data-cross-platform", "FINAL_REVIEW"],
    ["security-privacy-agent-trust", "FINAL_REVIEW"],
    ["performance-reliability-operations", "FINAL_REVIEW"],
    ["product-discovery-visual-craft-experience-quality", "FINAL_REVIEW"],
    ["qa-evidence-release-verification", "QA_CLOSURE"],
    ["independent-blind-spot-sentinel", "PASS_B"],
  ].map(([roleId, phase]) => receiptRecord(roleId, phase, subjectIds));
}

function receiptRecord(roleId, phase, subjectIds = ["production-baseline", "candidate"]) {
  const receipt = {
    roleId,
    phase,
    subjectIds,
    verdict: "GO",
    artifactPath: `artifacts/receipts/${roleId}-${phase.toLowerCase()}.json`,
  };
  return {
    ...receipt,
    receiptSha256: createHash("sha256").update(receiptBody(receipt)).digest("hex"),
  };
}

function receiptBody(receipt) {
  return `${JSON.stringify({
    schemaVersion: "1.0.0",
    roleId: receipt.roleId,
    phase: receipt.phase,
    subjectIds: receipt.subjectIds,
    verdict: receipt.verdict,
  })}\n`;
}

function inventoryReconciliation() {
  return ["production-baseline", "candidate"].map((subjectId) => {
    const record = {
      subjectId,
      candidateCount: 1,
      capabilityMappedCount: 1,
      excludedCandidateCount: 0,
      unclassifiedCandidateCount: 0,
      artifactPath: `artifacts/inventory/${subjectId}-reconciliation.json`,
    };
    return {
      ...record,
      artifactSha256: createHash("sha256").update(inventoryReconciliationBody(record)).digest("hex"),
    };
  });
}

function inventoryReconciliationBody(record) {
  return `${JSON.stringify({
    schemaVersion: "1.0.0",
    subjectId: record.subjectId,
    candidateCount: record.candidateCount,
    capabilityMappedCount: record.capabilityMappedCount,
    excludedCandidateCount: record.excludedCandidateCount,
    unclassifiedCandidateCount: record.unclassifiedCandidateCount,
  })}\n`;
}

function evidenceRecord(evidenceId, subjectId, candidateSnapshotSha256) {
  const isCandidate = subjectId === "candidate";
  return {
    evidenceId,
    subjectId,
    evidenceClass: "DIRECT_LOCAL",
    evidenceType: "SOURCE_INSPECTION",
    locator: {
      kind: "REPOSITORY_SOURCE",
      path: "scripts/product-coherence/core.mjs",
      revision: {
        oidAlgorithm: "sha1",
        commitOid: isCandidate ? CANDIDATE_COMMIT : BASELINE_COMMIT,
      },
      ...(isCandidate ? { candidateSnapshotSha256 } : {}),
    },
    observedAt: "2026-07-26T16:00:00.000Z",
    tool: { name: "git", version: "2.50.1" },
    scope: {
      platforms: ["WEB"],
      deviceScope: "REPOSITORY_ONLY",
      accountCohort: "ANONYMOUS",
    },
    result: "PASS",
    artifactSha256: SHA,
    privacyClass: "SENSITIVE_NOT_CAPTURED",
    invalidationTriggers: ["source-change"],
  };
}

function artifactEvidenceRecord(
  evidenceId,
  evidenceClass,
  evidenceType,
  artifactPath,
  artifactSha256,
  platform,
  subjectId = "production-baseline",
) {
  return {
    evidenceId,
    subjectId,
    evidenceClass,
    evidenceType,
    locator: { kind: "LOCAL_ARTIFACT", path: artifactPath },
    observedAt: "2026-07-26T16:00:00.000Z",
    tool: { name: "audit-fixture", version: "1.0.0" },
    scope: {
      platforms: [platform],
      deviceScope: evidenceClass === "DIRECT_RUNTIME" ? "DESKTOP_BROWSER" : "REPOSITORY_ONLY",
      accountCohort: "ANONYMOUS",
    },
    result: "PASS",
    artifactSha256,
    privacyClass: "SENSITIVE_NOT_CAPTURED",
    invalidationTriggers: ["artifact-change"],
  };
}

function capabilityRecord(capabilityId, subjectId, evidenceId) {
  return {
    capabilityId,
    subjectId,
    reachability: "SHIPPED_REACHABLE",
    capabilityRole: "CORE_INFREQUENT",
    productDisposition: "KEEP",
    userJob: "understand the current audit contract",
    userRole: "repository reviewer",
    surfaces: ["audit CLI"],
    platforms: ["WEB"],
    locales: ["en"],
    cohorts: ["anonymous"],
    trace: [
      { kind: "ENTRYPOINT", locator: "package.json#audit:product-coherence:validate", evidenceId },
      { kind: "SOURCE", locator: "scripts/product-coherence/core.mjs", evidenceId },
    ],
    permissions: ["repository-read"],
    dataActions: ["NONE"],
    dependencies: ["zod"],
    promises: ["validation does not invent a product disposition"],
    evidenceIds: [evidenceId],
  };
}

function decisionRecord(
  decisionId = "decision-1",
  subjectId = "production-baseline",
  capabilityId = "baseline-capability",
  evidenceId = "baseline-evidence",
) {
  return {
    decisionId,
    subjectId,
    capabilityId,
    observation: "The audit contract is reachable from a package command.",
    hypothesis: "Keeping the command supports repeatable audit validation.",
    options: [
      { optionId: "keep", disposition: "KEEP", description: "Retain the command." },
      { optionId: "remove", disposition: "REMOVE", description: "Remove the command." },
    ],
    selectedDecision: { optionId: "keep", disposition: "KEEP", rationale: "Current evidence supports retention." },
    rejectedAlternatives: [{ optionId: "remove", reason: "It would remove the required validator." }],
    priority: "P1",
    confidence: "HIGH",
    hardGates: ["same-subject evidence"],
    owner: "audit owner",
    affectedCohorts: ["repository reviewers"],
    acceptanceCriteria: ["focused contract test passes"],
    killCriteria: ["validator invents a disposition"],
    rollbackCriteria: ["revert the audit-only commit"],
    metrics: [{ metricId: "contract-tests", target: "all focused tests pass" }],
    tradeOffs: ["schema strictness requires explicit ledger migrations"],
    evidenceIds: [evidenceId],
  };
}

function findingHistoryRecord(findingId, subjectId, capabilityId, decisionId, evidenceId) {
  return {
    findingId,
    subjectId,
    capabilityId,
    decisionId,
    events: [
      historyEvent(0, "DISCOVERED", "2026-07-26T16:00:00.000Z", evidenceId),
      historyEvent(1, "TRIAGED", "2026-07-26T16:01:00.000Z", evidenceId),
      historyEvent(2, "DECIDED", "2026-07-26T16:02:00.000Z", evidenceId),
      historyEvent(3, "IMPLEMENTING", "2026-07-26T16:03:00.000Z", evidenceId),
      historyEvent(4, "VERIFIED", "2026-07-26T16:04:00.000Z", evidenceId),
    ],
  };
}

function historyEvent(sequence, state, observedAt, evidenceId = "baseline-evidence") {
  return { sequence, state, observedAt, evidenceIds: [evidenceId] };
}

function candidateSnapshotDigest(repository) {
  return computeCandidateSnapshotSha256(repository);
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

function candidatePrivacyBody(scannedArtifactSha256) {
  return `${JSON.stringify({
    schemaVersion: "1.0.0",
    subjectId: "candidate",
    scanStatus: "PASS",
    scannedArtifactSha256,
    findingCount: 0,
  })}\n`;
}

async function writeBundle(directory, bundle, artifactBodies = {}) {
  const ledgers = {
    manifest: [bundle.manifest],
    evidence: bundle.evidence,
    capabilities: bundle.capabilities,
    decisions: bundle.decisions,
    findingHistory: bundle.findingHistory,
  };
  await writeAuditArtifacts(directory, bundle, artifactBodies);
  await Promise.all([
    ...Object.entries(ledgers).map(([name, rows]) =>
      writeFile(path.join(directory, `${name}.jsonl`), rows.map((row) => JSON.stringify(row)).join("\n")),
    ),
  ]);
}

async function writeAuditArtifacts(directory, bundle, artifactBodies = {}) {
  const candidateRepository = bundle.manifest.subjects.find(({ subjectId }) => subjectId === "candidate").repository;
  const receiptRows = [
    ...bundle.manifest.roleReceipts,
    ...(bundle.manifest.coordinatorIntegrationReceipt
      ? [bundle.manifest.coordinatorIntegrationReceipt]
      : []),
  ];
  const inventoryRows = bundle.manifest.inventoryReconciliation ?? [];
  const files = [
    ["artifacts/baseline-source.txt", BASELINE_SOURCE_BODY],
    ["artifacts/build.txt", BUILD_EVIDENCE_BODY],
    ["artifacts/deploy.txt", DEPLOY_EVIDENCE_BODY],
    [
      candidateRepository.sanitizedUntrackedManifestPath,
      artifactBodies.candidateManifestBody ?? CANDIDATE_MANIFEST_BODY,
    ],
    [
      candidateRepository.privacyScanReceiptPath,
      artifactBodies.candidatePrivacyBody ?? CANDIDATE_PRIVACY_BODY,
    ],
    [candidateRepository.candidateSnapshotPath, candidateSnapshotBody(candidateRepository)],
    ...receiptRows.map((receipt) => [receipt.artifactPath, receiptBody(receipt)]),
    ...inventoryRows.map((row) => [row.artifactPath, inventoryReconciliationBody(row)]),
  ];
  await Promise.all(files.map(async ([relativePath, body]) => {
    const target = path.join(directory, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }));
}

async function prepareSubjectRepositories(bundle, options = {}) {
  const parent = await mkdtemp(path.join(os.tmpdir(), "product-coherence-subjects-"));
  const roots = {
    "production-baseline": path.join(parent, "production-baseline"),
    candidate: path.join(parent, "candidate"),
  };
  const sourceBodies = {
    "production-baseline": "export const baselineContract = true;\n",
    candidate: "export const candidateContract = true;\n",
  };

  try {
    for (const subjectId of ["production-baseline", "candidate"]) {
      const root = roots[subjectId];
      await mkdir(path.join(root, "scripts", "product-coherence"), { recursive: true });
      expect(runGit(root, ["init", "--object-format=sha1"]).status).toBe(0);
      expect(runGit(root, ["config", "user.email", "audit@example.invalid"]).status).toBe(0);
      expect(runGit(root, ["config", "user.name", "Audit Test"]).status).toBe(0);
      const sourcePath = path.join(root, "scripts", "product-coherence", "core.mjs");
      const committedBody =
        subjectId === "candidate"
          ? "export const candidateContract = false;\n"
          : sourceBodies[subjectId];
      await writeFile(sourcePath, committedBody);
      expect(runGit(root, ["add", "."]).status).toBe(0);
      expect(runGit(root, ["commit", "-m", `${subjectId} fixture`]).status).toBe(0);
      if (subjectId === "candidate") {
        await writeFile(sourcePath, sourceBodies[subjectId]);
        if (options.candidateUntrackedBody !== undefined) {
          await writeFile(
            path.join(root, "candidate-untracked-fixture.txt"),
            options.candidateUntrackedBody,
          );
        }
      }

      const subject = bundle.manifest.subjects.find((row) => row.subjectId === subjectId);
      subject.repository.commitOid = runGit(root, ["rev-parse", "HEAD"]).stdout.trim();
      subject.repository.treeOid = runGit(root, ["rev-parse", "HEAD^{tree}"]).stdout.trim();
      for (const evidence of bundle.evidence) {
        if (evidence.subjectId !== subjectId || evidence.locator.kind !== "REPOSITORY_SOURCE") continue;
        evidence.locator.revision = {
          oidAlgorithm: "sha1",
          commitOid: subject.repository.commitOid,
        };
        evidence.artifactSha256 = createHash("sha256").update(sourceBodies[subjectId]).digest("hex");
      }
    }

    const candidate = bundle.manifest.subjects.find((row) => row.subjectId === "candidate");
    const candidateRoot = roots.candidate;
    const statusBytes = runGitBuffer(candidateRoot, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]).stdout;
    const diffBytes = runGitBuffer(candidateRoot, ["diff", "--binary", "HEAD", "--"]).stdout;
    const untracked = await computeSanitizedUntrackedManifest(candidateRoot);
    const privacyBody = candidatePrivacyBody(untracked.sha256);
    candidate.repository.gitStatusSha256 = createHash("sha256").update(statusBytes).digest("hex");
    candidate.repository.trackedDiffSha256 = createHash("sha256").update(diffBytes).digest("hex");
    candidate.repository.sanitizedUntrackedManifestSha256 = untracked.sha256;
    candidate.repository.privacyScanReceiptSha256 = createHash("sha256")
      .update(privacyBody)
      .digest("hex");
    candidate.repository.candidateSnapshotSha256 = computeCandidateSnapshotSha256(
      candidate.repository,
    );
    for (const evidence of bundle.evidence) {
      if (evidence.subjectId !== "candidate") continue;
      if (evidence.locator.kind === "REPOSITORY_SOURCE") {
        evidence.locator.candidateSnapshotSha256 = candidate.repository.candidateSnapshotSha256;
      }
      if (evidence.locator.kind === "LOCAL_ARTIFACT" &&
          evidence.locator.path === candidate.repository.sanitizedUntrackedManifestPath) {
        evidence.artifactSha256 = untracked.sha256;
      }
    }

    return {
      parent,
      roots,
      artifactBodies: {
        candidateManifestBody: untracked.body,
        candidatePrivacyBody: privacyBody,
      },
      cliArgs: [
        "--subject-root",
        `production-baseline=${roots["production-baseline"]}`,
        "--subject-root",
        `candidate=${roots.candidate}`,
      ],
    };
  } catch (error) {
    await rm(parent, { recursive: true, force: true });
    throw error;
  }
}

describe("ProductCoherenceAudit v1 approved ledger contract", () => {
  it("accepts canonical subjects, real Git SHA-1 OIDs, and explicit public deploy provenance", () => {
    expect(validateAuditBundle(validBundle())).toEqual({ ok: true, errors: [] });
  });

  it("rejects legacy subject IDs and Git OIDs mislabeled as SHA-256", () => {
    const legacy = validBundle();
    legacy.manifest.subjects[0].subjectId = "baseline";
    legacy.manifest.subjects[0].repository.commitOid = SHA;

    expect(validateAuditBundle(legacy)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/subjectId|commitOid/)]),
    });
  });

  it("does not require or accept fabricated artifact hashes for N/A and UNVERIFIED stages", () => {
    const invalid = validBundle();
    invalid.manifest.subjects[1].build.artifactSha256 = SHA;

    expect(validateAuditBundle(invalid)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("artifactSha256")]),
    });
  });

  it("accepts legitimate device/account metadata but rejects raw identifiers and phone values", () => {
    const valid = validBundle();
    expect(validateAuditBundle(valid)).toEqual({ ok: true, errors: [] });

    for (const [key, value] of [
      ["deviceId", "device-123"],
      ["accountId", "account-123"],
      ["phoneNumber", "+1 204 555 0199"],
    ]) {
      const invalid = validBundle();
      invalid.evidence[0].scope[key] = value;
      expect(validateAuditBundle(invalid)).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([expect.stringContaining("sensitive")]),
      });
    }
  });

  it("rejects raw identifiers hidden inside otherwise allowed free text", () => {
    for (const value of [
      "IMEI 490154203237518",
      "2045550199",
      "550e8400-e29b-41d4-a716-446655440000",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature123",
    ]) {
      const invalid = validBundle();
      invalid.decisions[0].observation = `Observed ${value}`;
      expect(validateAuditBundle(invalid)).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([expect.stringContaining("sensitive value")]),
      });
    }
  });

  it("uses bounded device and account scopes rather than identifier-bearing free text", () => {
    const invalid = validBundle();
    invalid.evidence[0].scope.deviceScope = "IMEI 490154203237518";
    invalid.evidence[0].scope.accountCohort = "account 550e8400-e29b-41d4-a716-446655440000";

    expect(validateAuditBundle(invalid)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.stringContaining("deviceScope"),
        expect.stringContaining("accountCohort"),
      ]),
    });
  });

  it("enforces approved evidence, reachability, role, disposition, and platform-result enums", () => {
    const invalid = validBundle();
    invalid.evidence[0].evidenceClass = "SOURCE";
    invalid.evidence[0].result = "NOT_APPLICABLE";
    invalid.capabilities[0].reachability = "REACHABLE";
    invalid.capabilities[0].capabilityRole = "CLASSIFIED";
    invalid.capabilities[0].productDisposition = "RESOLVED";

    const result = validateAuditBundle(invalid);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/evidenceClass|result|reachability|capabilityRole|productDisposition/);
  });

  it("binds role receipts to the canonical 17-phase DEEP_AUDIT classifier topology", () => {
    const classification = spawnSync(
      process.execPath,
      ["scripts/run-ten-lens-assurance.mjs", "--classify", "--trigger", "DEEP_AUDIT"],
      { encoding: "utf8" },
    );
    expect(classification.status, classification.stderr).toBe(0);
    const canonical = JSON.parse(classification.stdout);
    expect(canonical.classification_registry_version).toBe(DEEP_AUDIT_REGISTRY_VERSION);
    expect(canonical.classification_registry_digest).toBe(DEEP_AUDIT_REGISTRY_SHA);
    expect(roleReceipts().map(({ roleId, phase }) => ({ role_id: roleId, phase })))
      .toEqual(canonical.mandatory_phases);

    const invalid = validBundle();
    invalid.manifest.roleReceipts = Array.from({ length: 12 }, (_, index) => ({
      roleId: "qa-evidence-release-verification",
      phase: "INITIAL_REVIEW",
      subjectIds: ["production-baseline", "candidate"],
      verdict: "GO",
      artifactPath: `artifacts/receipts/invalid-${index}.json`,
      receiptSha256: SHA,
    }));

    expect(validateAuditBundle(invalid)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/role receipt|duplicate|required/)]),
    });
  });

  it("accepts AUDIT_COMPLETE only with reconciled inventory and every canonical GO receipt", () => {
    const complete = validBundle();
    complete.manifest.auditStatus = "AUDIT_COMPLETE";
    complete.manifest.inventoryReconciliation = inventoryReconciliation();
    expect(validateAuditBundle(complete)).toEqual({ ok: true, errors: [] });

    const missingInventory = validBundle();
    missingInventory.manifest.auditStatus = "AUDIT_COMPLETE";
    expect(validateAuditBundle(missingInventory)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/AUDIT_COMPLETE.*inventory/i)]),
    });

    const unresolved = validBundle();
    unresolved.manifest.auditStatus = "AUDIT_COMPLETE";
    unresolved.manifest.inventoryReconciliation = inventoryReconciliation();
    unresolved.manifest.inventoryReconciliation[1].unclassifiedCandidateCount = 1;
    expect(validateAuditBundle(unresolved)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/candidate.*unclassified|unclassified.*candidate/i)]),
    });

    const inconsistent = validBundle();
    inconsistent.manifest.auditStatus = "AUDIT_COMPLETE";
    inconsistent.manifest.inventoryReconciliation = inventoryReconciliation();
    inconsistent.manifest.inventoryReconciliation[0].candidateCount = 2;
    expect(validateAuditBundle(inconsistent)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/candidate count|reconciliation/i)]),
    });

    const stopped = validBundle();
    stopped.manifest.auditStatus = "AUDIT_COMPLETE";
    stopped.manifest.inventoryReconciliation = inventoryReconciliation();
    stopped.manifest.roleReceipts[2].verdict = "STOP";
    expect(validateAuditBundle(stopped)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/AUDIT_COMPLETE.*GO/i)]),
    });

    const unintegrated = validBundle();
    unintegrated.manifest.auditStatus = "AUDIT_COMPLETE";
    unintegrated.manifest.inventoryReconciliation = inventoryReconciliation();
    delete unintegrated.manifest.coordinatorIntegrationReceipt;
    expect(validateAuditBundle(unintegrated)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/AUDIT_COMPLETE.*coordinator/i)]),
    });

    const blocked = validBundle();
    blocked.manifest.auditStatus = "BLOCKED";
    blocked.manifest.roleReceipts[2].verdict = "STOP";
    blocked.manifest.coordinatorIntegrationReceipt.verdict = "ASK";
    expect(validateAuditBundle(blocked)).toEqual({ ok: true, errors: [] });
  });

  it("rehashes inventory reconciliation artifacts before accepting AUDIT_COMPLETE", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-inventory-reconciliation-"));
    let subjects;
    try {
      const bundle = validBundle();
      bundle.manifest.auditStatus = "AUDIT_COMPLETE";
      bundle.manifest.inventoryReconciliation = inventoryReconciliation();
      subjects = await prepareSubjectRepositories(bundle);
      await writeBundle(root, bundle, subjects.artifactBodies);

      const pass = spawnSync(
        process.execPath,
        [CLI, "validate", "--input", root, ...subjects.cliArgs],
        { encoding: "utf8" },
      );
      expect(pass.status, pass.stderr || pass.stdout).toBe(0);

      const candidateRow = bundle.manifest.inventoryReconciliation.find(
        ({ subjectId }) => subjectId === "candidate",
      );
      await writeFile(
        path.join(root, candidateRow.artifactPath),
        inventoryReconciliationBody({
          ...candidateRow,
          unclassifiedCandidateCount: 1,
        }),
      );
      const tampered = spawnSync(
        process.execPath,
        [CLI, "validate", "--input", root, ...subjects.cliArgs],
        { encoding: "utf8" },
      );
      expect(tampered.status).toBe(1);
      expect(tampered.stdout).toMatch(/inventory reconciliation.*(?:hash|content|identity)/i);
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        subjects ? rm(subjects.parent, { recursive: true, force: true }) : Promise.resolve(),
      ]);
    }
  });

  it("rejects stale DEEP_AUDIT registry version or digest bindings", () => {
    const staleVersion = validBundle();
    staleVersion.manifest.classificationRegistryVersion = "zenflow-risk-registry-stale";
    expect(validateAuditBundle(staleVersion)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/classificationRegistryVersion|registry version/)]),
    });

    const staleDigest = validBundle();
    staleDigest.manifest.classificationRegistrySha256 = OTHER_SHA;
    expect(validateAuditBundle(staleDigest)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/classificationRegistrySha256|registry digest/)]),
    });
  });

  it("rejects duplicate role-receipt hashes and rehashes receipt identity from the artifact root", async () => {
    const duplicate = validBundle();
    duplicate.manifest.roleReceipts[1].receiptSha256 =
      duplicate.manifest.roleReceipts[0].receiptSha256;
    expect(validateAuditBundle(duplicate)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/duplicate role receipt.*hash|receiptSha256/)]),
    });

    const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-receipt-artifact-"));
    try {
      const bundle = validBundle();
      await writeBundle(root, bundle);
      await writeFile(
        path.join(root, bundle.manifest.roleReceipts[0].artifactPath),
        receiptBody(bundle.manifest.roleReceipts[1]),
      );
      const result = spawnSync(process.execPath, [CLI, "validate", "--input", root], { encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(result.stdout).toMatch(/role receipt.*(?:hash|role|phase|identity)/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("requires evidence observations to fall inside the declared audit run window", () => {
    const stale = validBundle();
    stale.evidence[0].observedAt = "2020-01-01T00:00:00.000Z";
    expect(validateAuditBundle(stale)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/observedAt|run window|stale/)]),
    });
  });

  it("requires direct evidence and capability coverage for both canonical subjects", () => {
    const uncovered = validBundle();
    uncovered.evidence = uncovered.evidence.filter(({ subjectId }) => subjectId !== "candidate");
    uncovered.capabilities = uncovered.capabilities.filter(({ subjectId }) => subjectId !== "candidate");
    uncovered.decisions = uncovered.decisions.filter(({ subjectId }) => subjectId !== "candidate");
    uncovered.findingHistory = uncovered.findingHistory.filter(({ subjectId }) => subjectId !== "candidate");
    expect(validateAuditBundle(uncovered)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.stringMatching(/candidate.*direct evidence|direct evidence.*candidate/),
        expect.stringMatching(/candidate.*capability|capability.*candidate/),
      ]),
    });
  });

  it("rehashes and reconciles candidate manifest, privacy, and snapshot artifacts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-candidate-provenance-"));
    let subjects;
    try {
      const bundle = validBundle();
      subjects = await prepareSubjectRepositories(bundle);
      await writeBundle(root, bundle, subjects.artifactBodies);
      const pass = spawnSync(
        process.execPath,
        [CLI, "validate", "--input", root, ...subjects.cliArgs],
        { encoding: "utf8" },
      );
      expect(pass.status, pass.stderr || pass.stdout).toBe(0);

      const candidateRepository = bundle.manifest.subjects[1].repository;
      await writeFile(
        path.join(root, candidateRepository.privacyScanReceiptPath),
        CANDIDATE_MANIFEST_BODY,
      );
      const swapped = spawnSync(
        process.execPath,
        [CLI, "validate", "--input", root, ...subjects.cliArgs],
        { encoding: "utf8" },
      );
      expect(swapped.status).toBe(1);
      expect(swapped.stdout).toMatch(/candidate privacy.*(?:hash|receipt|content)/i);

      await writeFile(
        path.join(root, candidateRepository.privacyScanReceiptPath),
        subjects.artifactBodies.candidatePrivacyBody,
      );
      candidateRepository.candidateSnapshotSha256 = OTHER_SHA;
      await writeBundle(root, bundle, subjects.artifactBodies);
      const arbitrary = spawnSync(
        process.execPath,
        [CLI, "validate", "--input", root, ...subjects.cliArgs],
        { encoding: "utf8" },
      );
      expect(arbitrary.status).toBe(1);
      expect(arbitrary.stdout).toMatch(/candidate snapshot.*(?:hash|digest)/i);
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        subjects ? rm(subjects.parent, { recursive: true, force: true }) : Promise.resolve(),
      ]);
    }
  });

  it("requires verified roots for both subjects even when evidence uses only local artifacts", async () => {
    const ledgerRoot = await mkdtemp(path.join(os.tmpdir(), "product-coherence-both-roots-"));
    let subjects;
    try {
      const bundle = validBundle();
      bundle.evidence[0].locator = { kind: "LOCAL_ARTIFACT", path: "artifacts/build.txt" };
      bundle.evidence[0].artifactSha256 = BUILD_EVIDENCE_SHA;
      subjects = await prepareSubjectRepositories(bundle);
      await writeBundle(ledgerRoot, bundle, subjects.artifactBodies);

      const missingCandidate = spawnSync(
        process.execPath,
        [
          CLI,
          "validate",
          "--input",
          ledgerRoot,
          "--subject-root",
          `production-baseline=${subjects.roots["production-baseline"]}`,
        ],
        { encoding: "utf8" },
      );
      expect(
        missingCandidate.status,
        `stdout=${missingCandidate.stdout}\nstderr=${missingCandidate.stderr}`,
      ).toBe(1);
      expect(missingCandidate.stdout).toMatch(/candidate.*requires --subject-root/i);
    } finally {
      await Promise.all([
        rm(ledgerRoot, { recursive: true, force: true }),
        subjects ? rm(subjects.parent, { recursive: true, force: true }) : Promise.resolve(),
      ]);
    }
  });

  it("rejects arbitrary capability platform and locale claims", () => {
    const invalid = validBundle();
    invalid.capabilities[0].platforms = ["SMART_FRIDGE"];
    invalid.capabilities[0].locales = ["xx"];

    expect(validateAuditBundle(invalid)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.stringContaining("platforms"),
        expect.stringContaining("locales"),
      ]),
    });
  });

  it("does not let one PASS evidence row claim multiple platform scopes", () => {
    const invalid = validBundle();
    invalid.evidence[0].scope.platforms = ["WEB", "ANDROID"];

    expect(validateAuditBundle(invalid)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("exactly one platform")]),
    });
  });

  it("requires exactly one platform scope for every evidence result", () => {
    for (const result of ["FAIL", "N/A", "UNVERIFIED"]) {
      const invalid = validBundle();
      invalid.evidence[0].result = result;
      invalid.evidence[0].scope.platforms = ["WEB", "ANDROID"];

      expect(validateAuditBundle(invalid), result).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([expect.stringContaining("exactly one platform")]),
      });
    }
  });

  it("requires evidence, capabilities, decisions, and histories for both subjects", () => {
    for (const ledger of ["evidence", "capabilities", "decisions", "findingHistory"]) {
      const invalid = validBundle();
      invalid[ledger] = invalid[ledger].filter((row) => row.subjectId !== "candidate");

      expect(validateAuditBundle(invalid), ledger).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([
          expect.stringMatching(new RegExp(`${ledger}.*candidate|candidate.*${ledger}`, "i")),
        ]),
      });
    }
  });

  it("allows one stable capability ID across subjects but rejects duplicates within a subject", () => {
    const sharedStableId = validBundle();
    sharedStableId.capabilities[1].capabilityId = "baseline-capability";
    sharedStableId.decisions[1].capabilityId = "baseline-capability";
    sharedStableId.findingHistory[1].capabilityId = "baseline-capability";
    expect(validateAuditBundle(sharedStableId)).toEqual({ ok: true, errors: [] });

    const duplicateWithinSubject = validBundle();
    duplicateWithinSubject.capabilities.push({
      ...capabilityRecord("baseline-capability", "production-baseline", "baseline-evidence"),
    });
    expect(validateAuditBundle(duplicateWithinSubject)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/duplicate capability.*production-baseline/i)]),
    });
  });

  it("rejects mixed-subject capability evidence", () => {
    const invalid = validBundle();
    invalid.evidence.push(evidenceRecord("candidate-evidence", "candidate"));
    invalid.capabilities[0].evidenceIds = ["candidate-evidence"];
    invalid.capabilities[0].trace[0].evidenceId = "candidate-evidence";

    expect(validateAuditBundle(invalid)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("subject mismatch")]),
    });
  });

  it("requires blocker and owner for BLOCKED_UNVERIFIED without inventing another enum", () => {
    const blocked = validBundle();
    blocked.capabilities[0].productDisposition = "BLOCKED_UNVERIFIED";
    expect(validateAuditBundle(blocked)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("blocker")]),
    });

    blocked.capabilities[0].blocker = { summary: "Runtime proof is unavailable.", owner: "audit owner" };
    blocked.decisions[0].options[0].disposition = "BLOCKED_UNVERIFIED";
    blocked.decisions[0].selectedDecision.disposition = "BLOCKED_UNVERIFIED";
    expect(validateAuditBundle(blocked)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("decision blocker")]),
    });
    blocked.decisions[0].blocker = { summary: "Runtime proof is unavailable.", owner: "audit owner" };
    blocked.findingHistory[0].events[4].state = "BLOCKED";
    expect(validateAuditBundle(blocked)).toEqual({ ok: true, errors: [] });
  });

  it("rejects whitespace blockers, missing blocked decisions, and contradictory closure", () => {
    const whitespace = validBundle();
    whitespace.capabilities[0].productDisposition = "BLOCKED_UNVERIFIED";
    whitespace.capabilities[0].blocker = { summary: "   ", owner: "\t" };
    expect(validateAuditBundle(whitespace)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/blocker|summary|owner/)]),
    });

    const whitespaceDecisionOwner = validBundle();
    whitespaceDecisionOwner.decisions[0].owner = " \t ";
    expect(validateAuditBundle(whitespaceDecisionOwner)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/owner|nonblank/)]),
    });

    const untrimmedDecisionOwner = validBundle();
    untrimmedDecisionOwner.decisions[0].owner = " audit owner ";
    expect(validateAuditBundle(untrimmedDecisionOwner)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/owner|trimmed/)]),
    });

    const missingDecision = validBundle();
    missingDecision.capabilities[0].productDisposition = "BLOCKED_UNVERIFIED";
    missingDecision.capabilities[0].blocker = { summary: "Runtime unavailable.", owner: "audit owner" };
    missingDecision.decisions = [];
    expect(validateAuditBundle(missingDecision)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/decision|decisions/)]),
    });

    const contradictory = validBundle();
    contradictory.capabilities[0].productDisposition = "BLOCKED_UNVERIFIED";
    contradictory.capabilities[0].blocker = { summary: "Runtime unavailable.", owner: "audit owner" };
    contradictory.decisions[0].options[0].disposition = "BLOCKED_UNVERIFIED";
    contradictory.decisions[0].selectedDecision.disposition = "BLOCKED_UNVERIFIED";
    contradictory.decisions[0].blocker = { summary: "Runtime unavailable.", owner: "audit owner" };
    expect(validateAuditBundle(contradictory)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/BLOCKED_UNVERIFIED|VERIFIED/)]),
    });

    const hiddenBlocker = validBundle();
    hiddenBlocker.findingHistory[0].events[4].state = "BLOCKED";
    expect(validateAuditBundle(hiddenBlocker)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/BLOCKED|BLOCKED_UNVERIFIED/)]),
    });
  });

  it("requires exactly one decision for each capability", () => {
    const missing = validBundle();
    missing.capabilities.push(
      capabilityRecord("second-capability", "production-baseline", "baseline-evidence"),
    );
    expect(validateAuditBundle(missing)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/exactly one .*decision/)]),
    });

    const duplicate = validBundle();
    duplicate.decisions.push({
      ...decisionRecord(),
      decisionId: "decision-2",
    });
    expect(validateAuditBundle(duplicate)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/exactly one .*decision/)]),
    });
  });

  it("requires structured decisions and valid finding-history references", () => {
    const missingObservation = validBundle();
    missingObservation.decisions[0].observation = undefined;
    expect(validateAuditBundle(missingObservation)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("observation")]),
    });

    const missingDecision = validBundle();
    missingDecision.findingHistory[0].decisionId = "missing-decision";
    expect(validateAuditBundle(missingDecision)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("missing-decision")]),
    });
  });

  it("rejects non-continuous and non-chronological finding histories", () => {
    const invalid = validBundle();
    invalid.findingHistory[0].events[2] = historyEvent(3, "DECIDED", "2026-07-26T15:59:00.000Z");

    expect(validateAuditBundle(invalid)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.stringContaining("sequence must be continuous"),
        expect.stringContaining("not chronological"),
      ]),
    });
  });

  it("keeps selected decisions consistent with capability disposition", () => {
    const invalid = validBundle();
    invalid.decisions[0].options[0].disposition = "REMOVE";
    invalid.decisions[0].selectedDecision.disposition = "REMOVE";

    expect(validateAuditBundle(invalid)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("capability disposition")]),
    });
  });

  it("requires every non-selected decision option to be rejected exactly once", () => {
    const invalid = validBundle();
    invalid.decisions[0].options.push({
      optionId: "instrument",
      disposition: "INSTRUMENT_OR_TEST",
      description: "Collect bounded evidence.",
    });

    expect(validateAuditBundle(invalid)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("rejected option instrument")]),
    });
  });

  it("rejects duplicate decision option IDs before option lookup", () => {
    const invalid = validBundle();
    invalid.decisions[0].options[1].optionId = "keep";
    invalid.decisions[0].rejectedAlternatives[0].optionId = "keep";

    expect(validateAuditBundle(invalid)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/duplicate.*option.*keep/i)]),
    });
  });

  it("requires direct evidence references for PASS build and deploy provenance", () => {
    const missingBuild = validBundle();
    delete missingBuild.manifest.subjects[0].build.evidenceId;
    expect(validateAuditBundle(missingBuild)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("evidenceId")]),
    });

    const missingDeploy = validBundle();
    delete missingDeploy.manifest.subjects[0].deploy.evidenceId;
    expect(validateAuditBundle(missingDeploy)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("evidenceId")]),
    });
  });

  it("binds PASS build and deploy artifact hashes to their cited evidence records", () => {
    const mismatchedBuild = validBundle();
    mismatchedBuild.manifest.subjects[0].build.artifactSha256 = SHA;
    expect(validateAuditBundle(mismatchedBuild)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/build provenance.*artifact hash/)]),
    });

    const mismatchedDeploy = validBundle();
    mismatchedDeploy.manifest.subjects[0].deploy.artifactSha256 = OTHER_SHA;
    expect(validateAuditBundle(mismatchedDeploy)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/deploy provenance.*artifact hash/)]),
    });
  });

  it("requires cited PASS results before build or deploy provenance can be PASS", () => {
    const failedBuild = validBundle();
    failedBuild.evidence.find(({ evidenceId }) => evidenceId === "baseline-build-evidence").result =
      "FAIL";
    expect(validateAuditBundle(failedBuild)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/build provenance.*PASS result/i)]),
    });

    const unverifiedDeploy = validBundle();
    unverifiedDeploy.evidence.find(
      ({ evidenceId }) => evidenceId === "baseline-deploy-evidence",
    ).result = "UNVERIFIED";
    expect(validateAuditBundle(unverifiedDeploy)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/deploy provenance.*PASS result/i)]),
    });
  });

  it("rejects lifecycle shortcuts before IMPLEMENTING", () => {
    const invalid = validBundle();
    invalid.findingHistory[0].events = [
      historyEvent(0, "DISCOVERED", "2026-07-26T16:00:00.000Z"),
      historyEvent(1, "TRIAGED", "2026-07-26T16:01:00.000Z"),
      historyEvent(2, "DECIDED", "2026-07-26T16:02:00.000Z"),
      historyEvent(3, "BLOCKED", "2026-07-26T16:03:00.000Z"),
    ];

    expect(validateAuditBundle(invalid)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("DECIDED->BLOCKED")]),
    });
  });

  it("derives a full-history Markdown report from validated ledgers", () => {
    const bundle = validBundle();
    bundle.manifest.inventoryReconciliation = inventoryReconciliation();
    const markdown = renderAuditMarkdown(bundle);

    for (const state of ["DISCOVERED", "TRIAGED", "DECIDED", "IMPLEMENTING", "VERIFIED"]) {
      expect(markdown).toContain(state);
    }
    for (const closureFact of [
      "Audit status: IN\\_PROGRESS",
      "Production truth",
      "Candidate truth",
      "PASS\\_A: GO",
      "INTEGRATION: GO",
      "Classification: DIRECT\\_LOCAL / TEST\\_RESULT",
      "Result / platform: PASS / TESTING",
      "Reachability: SHIPPED\\_REACHABLE",
      "Disposition: KEEP",
      "P1 / HIGH",
      "Trade-offs:",
      "Acceptance criteria:",
      "Kill criteria:",
      "Rollback criteria:",
      "Build: PASS",
      "Deploy: PASS",
      `Artifact SHA-256: ${BUILD_EVIDENCE_SHA}`,
      "Public URL: https://yehor212.github.io/people-first-app/",
      `Deployed revision: git-sha1:${DEPLOYED_COMMIT}`,
      "Receipt SHA-256:",
      "Trace:",
      "Data actions: NONE",
      "Evidence IDs:",
      "Hard gates: same-subject evidence",
      "Owner: audit owner",
      "Metrics: contract-tests — all focused tests pass",
      "decision-1",
      "decision-2",
    ]) {
      expect(markdown).toContain(closureFact);
    }
    expect(markdown).toContain("Unclassified candidates: 0");
    expect(markdown.match(/- Acceptance criteria:/g)).toHaveLength(2);
  });

  it("rejects newline-bearing stable IDs before Markdown rendering", () => {
    const cases = [
      ["runId", (bundle, id) => { bundle.manifest.runId = id; }],
      ["roleId", (bundle, id) => { bundle.manifest.roleReceipts[0].roleId = id; }],
      ["evidenceId", (bundle, id) => {
        bundle.evidence[0].evidenceId = id;
        bundle.capabilities[0].evidenceIds = [id];
        for (const trace of bundle.capabilities[0].trace) trace.evidenceId = id;
        bundle.decisions[0].evidenceIds = [id];
        for (const event of bundle.findingHistory[0].events) event.evidenceIds = [id];
      }],
      ["capabilityId", (bundle, id) => {
        bundle.capabilities[0].capabilityId = id;
        bundle.decisions[0].capabilityId = id;
        bundle.findingHistory[0].capabilityId = id;
      }],
      ["decisionId", (bundle, id) => {
        bundle.decisions[0].decisionId = id;
        bundle.findingHistory[0].decisionId = id;
      }],
      ["findingId", (bundle, id) => { bundle.findingHistory[0].findingId = id; }],
      ["optionId", (bundle, id) => {
        bundle.decisions[0].options[0].optionId = id;
        bundle.decisions[0].selectedDecision.optionId = id;
      }],
      ["metricId", (bundle, id) => { bundle.decisions[0].metrics[0].metricId = id; }],
    ];

    for (const [label, mutate] of cases) {
      const invalid = validBundle();
      mutate(invalid, `${label}\n## injected`);
      const result = validateAuditBundle(invalid);
      expect(result.ok, label).toBe(false);
      expect(result.errors.join("\n"), label).toContain(label);
      if (label !== "roleId") {
        expect(result.errors.join("\n"), label).toContain("safe single-line identifier");
      }
      expect(() => renderAuditMarkdown(invalid), label).toThrow("cannot render invalid audit ledger");
    }
  });

  it("rejects sensitive free text under otherwise innocuous keys", () => {
    const invalid = validBundle();
    invalid.decisions[0].observation = "Contact +1 204 555 0199 for the raw account.";

    expect(validateAuditBundle(invalid)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("sensitive value")]),
    });
  });

  it("recomputes hashes for local artifact locators during CLI validation", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-artifact-"));
    let subjects;
    try {
      const bundle = validBundle();
      subjects = await prepareSubjectRepositories(bundle);
      await mkdir(path.join(root, "artifacts"), { recursive: true });
      await writeFile(path.join(root, "artifacts", "evidence.txt"), "bounded audit evidence\n");
      bundle.evidence[0].locator = { kind: "LOCAL_ARTIFACT", path: "artifacts/evidence.txt" };
      bundle.evidence[0].artifactSha256 = SHA;
      await writeBundle(root, bundle, subjects.artifactBodies);

      const result = spawnSync(
        process.execPath,
        [CLI, "validate", "--input", root, ...subjects.cliArgs],
        { encoding: "utf8" },
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("local artifact hash mismatch");

      bundle.evidence[0].artifactSha256 = createHash("sha256")
        .update("bounded audit evidence\n")
        .digest("hex");
      await writeBundle(root, bundle, subjects.artifactBodies);
      const valid = spawnSync(
        process.execPath,
        [CLI, "validate", "--input", root, ...subjects.cliArgs],
        { encoding: "utf8" },
      );
      expect(valid.status, valid.stderr).toBe(0);
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        subjects ? rm(subjects.parent, { recursive: true, force: true }) : Promise.resolve(),
      ]);
    }
  });

  it("resolves local artifacts from a separate real artifact root and rejects symlink escape", async () => {
    const ledgerRoot = await mkdtemp(path.join(os.tmpdir(), "product-coherence-ledger-root-"));
    const artifactRoot = await mkdtemp(path.join(os.tmpdir(), "product-coherence-artifact-root-"));
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "product-coherence-artifact-outside-"));
    let subjects;
    try {
      const sourceBody = "bounded source evidence\n";
      const bundle = validBundle();
      subjects = await prepareSubjectRepositories(bundle);
      bundle.evidence[0].locator = { kind: "LOCAL_ARTIFACT", path: "artifacts/source.txt" };
      bundle.evidence[0].artifactSha256 = createHash("sha256").update(sourceBody).digest("hex");
      await writeBundle(ledgerRoot, bundle, subjects.artifactBodies);
      await rm(path.join(ledgerRoot, "artifacts"), { recursive: true, force: true });
      await writeAuditArtifacts(artifactRoot, bundle, subjects.artifactBodies);
      await writeFile(path.join(artifactRoot, "artifacts", "source.txt"), sourceBody);

      const pass = spawnSync(
        process.execPath,
        [
          CLI,
          "validate",
          "--input",
          ledgerRoot,
          "--artifact-root",
          artifactRoot,
          ...subjects.cliArgs,
        ],
        { encoding: "utf8" },
      );
      expect(pass.status, pass.stderr || pass.stdout).toBe(0);

      const defaultRoot = spawnSync(
        process.execPath,
        [CLI, "validate", "--input", ledgerRoot, ...subjects.cliArgs],
        { encoding: "utf8" },
      );
      expect(defaultRoot.status).toBe(1);
      expect(defaultRoot.stdout).toContain("local artifact validation failed");

      const artifactRootLink = path.join(ledgerRoot, "artifact-root-link");
      await symlink(artifactRoot, artifactRootLink);
      const symlinkedRoot = spawnSync(
        process.execPath,
        [
          CLI,
          "validate",
          "--input",
          ledgerRoot,
          "--artifact-root",
          artifactRootLink,
          ...subjects.cliArgs,
        ],
        { encoding: "utf8" },
      );
      expect(symlinkedRoot.status).toBe(2);
      expect(symlinkedRoot.stderr).toMatch(/artifact root.*real directory|symlink/i);

      const outsideArtifact = path.join(outsideRoot, "private.txt");
      await writeFile(outsideArtifact, sourceBody);
      await rm(path.join(artifactRoot, "artifacts", "source.txt"));
      await symlink(outsideArtifact, path.join(artifactRoot, "artifacts", "source.txt"));
      const escaped = spawnSync(
        process.execPath,
        [
          CLI,
          "validate",
          "--input",
          ledgerRoot,
          "--artifact-root",
          artifactRoot,
          ...subjects.cliArgs,
        ],
        { encoding: "utf8" },
      );
      expect(escaped.status).toBe(1);
      expect(escaped.stdout).toMatch(/local artifact.*(?:symlink|symbolic link|escape|identity)/i);
    } finally {
      await Promise.all([
        rm(ledgerRoot, { recursive: true, force: true }),
        rm(artifactRoot, { recursive: true, force: true }),
        rm(outsideRoot, { recursive: true, force: true }),
        subjects ? rm(subjects.parent, { recursive: true, force: true }) : Promise.resolve(),
      ]);
    }
  });

  it("confines repository sources, binds them to the subject revision, and rehashes content", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-repository-"));
    const ledgerRoot = await mkdtemp(path.join(os.tmpdir(), "product-coherence-repository-ledger-"));
    let subjects;
    try {
      expect(runGit(root, ["init", "--object-format=sha1"]).status).toBe(0);
      expect(runGit(root, ["config", "user.email", "audit@example.invalid"]).status).toBe(0);
      expect(runGit(root, ["config", "user.name", "Audit Test"]).status).toBe(0);
      await mkdir(path.join(root, "scripts", "product-coherence"), { recursive: true });
      const sourcePath = path.join(root, "scripts", "product-coherence", "core.mjs");
      await writeFile(sourcePath, "export const contract = true;\n");
      expect(runGit(root, ["add", "."]).status).toBe(0);
      expect(runGit(root, ["commit", "-m", "test fixture"]).status).toBe(0);
      const commitOid = runGit(root, ["rev-parse", "HEAD"]).stdout.trim();
      const treeOid = runGit(root, ["rev-parse", "HEAD^{tree}"]).stdout.trim();
      const bundle = validBundle();
      subjects = await prepareSubjectRepositories(bundle);
      bundle.evidence[0] = evidenceRecord("baseline-evidence", "production-baseline");
      bundle.manifest.subjects[0].repository.commitOid = commitOid;
      bundle.manifest.subjects[0].repository.treeOid = treeOid;
      bundle.evidence[0].locator.revision.commitOid = commitOid;
      bundle.evidence[0].artifactSha256 = createHash("sha256")
        .update("export const contract = true;\n")
        .digest("hex");
      await writeBundle(ledgerRoot, bundle, subjects.artifactBodies);

      const pass = spawnSync(
        process.execPath,
        [
          CLI,
          "validate",
          "--input",
          ledgerRoot,
          "--subject-root",
          `production-baseline=${root}`,
          "--subject-root",
          `candidate=${subjects.roots.candidate}`,
        ],
        { encoding: "utf8" },
      );
      expect(pass.status, pass.stderr || pass.stdout).toBe(0);

      bundle.evidence[0].artifactSha256 = OTHER_SHA;
      await writeBundle(ledgerRoot, bundle, subjects.artifactBodies);
      const changed = spawnSync(
        process.execPath,
        [
          CLI,
          "validate",
          "--input",
          ledgerRoot,
          "--subject-root",
          `production-baseline=${root}`,
          "--subject-root",
          `candidate=${subjects.roots.candidate}`,
        ],
        { encoding: "utf8" },
      );
      expect(changed.status).toBe(1);
      expect(changed.stdout).toContain("repository source hash mismatch");

      bundle.evidence[0].artifactSha256 = createHash("sha256")
        .update("export const contract = true;\n")
        .digest("hex");
      await writeBundle(ledgerRoot, bundle, subjects.artifactBodies);
      await writeFile(sourcePath, "export const contract = false;\n");
      const dirtyBaseline = spawnSync(
        process.execPath,
        [
          CLI,
          "validate",
          "--input",
          ledgerRoot,
          "--subject-root",
          `production-baseline=${root}`,
          "--subject-root",
          `candidate=${subjects.roots.candidate}`,
        ],
        { encoding: "utf8" },
      );
      expect(dirtyBaseline.status).toBe(1);
      expect(dirtyBaseline.stdout).toMatch(/production baseline.*clean/i);
      await writeFile(sourcePath, "export const contract = true;\n");

      const escaped = validBundle();
      escaped.evidence[0] = evidenceRecord("baseline-evidence", "production-baseline");
      escaped.evidence[0].locator.path = "../../outside/private.ts";
      expect(validateAuditBundle(escaped)).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([expect.stringContaining("repository-relative")]),
      });

      const wrongRevision = validBundle();
      wrongRevision.evidence[0] = evidenceRecord("baseline-evidence", "production-baseline");
      wrongRevision.evidence[0].locator.revision.commitOid = "9".repeat(40);
      expect(validateAuditBundle(wrongRevision)).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([expect.stringContaining("subject revision")]),
      });

      const rootLink = path.join(ledgerRoot, "subject-root-link");
      await symlink(root, rootLink);
      const symlinkedRoot = spawnSync(
        process.execPath,
        [
          CLI,
          "validate",
          "--input",
          ledgerRoot,
          "--subject-root",
          `production-baseline=${rootLink}`,
          "--subject-root",
          `candidate=${subjects.roots.candidate}`,
        ],
        { encoding: "utf8" },
      );
      expect(symlinkedRoot.status).toBe(1);
      expect(symlinkedRoot.stdout).toMatch(/subject root.*symlink|real directory/i);

    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(ledgerRoot, { recursive: true, force: true }),
        subjects ? rm(subjects.parent, { recursive: true, force: true }) : Promise.resolve(),
      ]);
    }
  });

  it("binds candidate repository sources and untracked content to the dirty snapshot", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-candidate-repository-"));
    const ledgerRoot = await mkdtemp(path.join(os.tmpdir(), "product-coherence-candidate-ledger-"));
    let subjects;
    try {
      expect(runGit(root, ["init", "--object-format=sha1"]).status).toBe(0);
      expect(runGit(root, ["config", "user.email", "audit@example.invalid"]).status).toBe(0);
      expect(runGit(root, ["config", "user.name", "Audit Test"]).status).toBe(0);
      await mkdir(path.join(root, "scripts", "product-coherence"), { recursive: true });
      const sourcePath = path.join(root, "scripts", "product-coherence", "core.mjs");
      await writeFile(sourcePath, "export const dirtyCandidate = false;\n");
      expect(runGit(root, ["add", "."]).status).toBe(0);
      expect(runGit(root, ["commit", "-m", "candidate fixture"]).status).toBe(0);
      const commitOid = runGit(root, ["rev-parse", "HEAD"]).stdout.trim();
      const treeOid = runGit(root, ["rev-parse", "HEAD^{tree}"]).stdout.trim();
      await writeFile(sourcePath, "export const dirtyCandidate = true;\n");
      const untrackedPath = path.join(root, "candidate-untracked-fixture.txt");
      await writeFile(untrackedPath, "candidate untracked v1\n");

      const bundle = validBundle();
      subjects = await prepareSubjectRepositories(bundle);
      const candidateRepository = bundle.manifest.subjects[1].repository;
      const statusBytes = runGitBuffer(root, [
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
      ]).stdout;
      const diffBytes = runGitBuffer(root, ["diff", "--binary", "HEAD", "--"]).stdout;
      const untracked = await computeSanitizedUntrackedManifest(root);
      const privacyBody = candidatePrivacyBody(untracked.sha256);
      candidateRepository.commitOid = commitOid;
      candidateRepository.treeOid = treeOid;
      candidateRepository.gitStatusSha256 = createHash("sha256").update(statusBytes).digest("hex");
      candidateRepository.trackedDiffSha256 = createHash("sha256").update(diffBytes).digest("hex");
      candidateRepository.sanitizedUntrackedManifestSha256 = untracked.sha256;
      candidateRepository.privacyScanReceiptSha256 = createHash("sha256")
        .update(privacyBody)
        .digest("hex");
      candidateRepository.candidateSnapshotSha256 =
        computeCandidateSnapshotSha256(candidateRepository);

      const repositoryEvidence = evidenceRecord(
        "candidate-repository-evidence",
        "candidate",
        candidateRepository.candidateSnapshotSha256,
      );
      repositoryEvidence.locator.revision.commitOid = commitOid;
      repositoryEvidence.artifactSha256 = createHash("sha256")
        .update("export const dirtyCandidate = true;\n")
        .digest("hex");
      bundle.evidence.push(repositoryEvidence);
      bundle.evidence.find(({ evidenceId }) => evidenceId === "candidate-evidence").artifactSha256 =
        untracked.sha256;
      bundle.capabilities[1].evidenceIds.push(repositoryEvidence.evidenceId);
      bundle.decisions[1].evidenceIds.push(repositoryEvidence.evidenceId);
      await writeBundle(ledgerRoot, bundle, {
        candidateManifestBody: untracked.body,
        candidatePrivacyBody: privacyBody,
      });

      const pass = spawnSync(
        process.execPath,
        [
          CLI,
          "validate",
          "--input",
          ledgerRoot,
          "--subject-root",
          `candidate=${root}`,
          "--subject-root",
          `production-baseline=${subjects.roots["production-baseline"]}`,
        ],
        { encoding: "utf8" },
      );
      expect(pass.status, pass.stderr || pass.stdout).toBe(0);

      await writeFile(untrackedPath, "candidate untracked v2\n");
      const changedUntracked = spawnSync(
        process.execPath,
        [
          CLI,
          "validate",
          "--input",
          ledgerRoot,
          "--subject-root",
          `candidate=${root}`,
          "--subject-root",
          `production-baseline=${subjects.roots["production-baseline"]}`,
        ],
        { encoding: "utf8" },
      );
      expect(changedUntracked.status).toBe(1);
      expect(changedUntracked.stdout).toMatch(/untracked manifest|candidate.*status/i);

      repositoryEvidence.locator.candidateSnapshotSha256 = OTHER_SHA;
      expect(validateAuditBundle(bundle)).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([expect.stringContaining("candidate snapshot")]),
      });
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(ledgerRoot, { recursive: true, force: true }),
        subjects ? rm(subjects.parent, { recursive: true, force: true }) : Promise.resolve(),
      ]);
    }
  });

  it("rejects evidence class, type, and locator combinations that cannot prove each other", () => {
    const invalid = validBundle();
    invalid.evidence[0].evidenceClass = "DIRECT_RUNTIME";
    invalid.evidence[0].locator = {
      kind: "AUTHORITATIVE_URL",
      url: "https://www.w3.org/TR/WCAG22/",
    };

    expect(validateAuditBundle(invalid)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/evidenceClass|evidenceType|locator/)]),
    });
  });

  it("accepts only the supported evidence class, type, and locator tuples", () => {
    const supported = [
      ["DIRECT_LOCAL", "SOURCE_INSPECTION", {
        kind: "REPOSITORY_SOURCE",
        path: "scripts/product-coherence/core.mjs",
        revision: { oidAlgorithm: "sha1", commitOid: BASELINE_COMMIT },
      }, "HIGH"],
      ["DIRECT_RUNTIME", "RUNTIME_TRACE", {
        kind: "LOCAL_ARTIFACT",
        path: "artifacts/runtime-trace.json",
      }, "HIGH"],
      ["AUTHORITATIVE_EXTERNAL", "AUTHORITATIVE_DOCUMENT", {
        kind: "AUTHORITATIVE_URL",
        url: "https://www.w3.org/TR/WCAG22/",
      }, "MEDIUM"],
      ["HUMAN_RESEARCH", "HUMAN_RESEARCH_RECEIPT", {
        kind: "HUMAN_RECEIPT",
        receiptId: "research-receipt-1",
        artifactPath: "artifacts/research/research-receipt-1.json",
      }, "HIGH"],
      ["INFERENCE", "SOURCE_INSPECTION", {
        kind: "UNVERIFIABLE_REFERENCE",
        value: "bounded audit hypothesis",
        reason: "Direct proof is unavailable.",
      }, "MEDIUM"],
      ["UNKNOWN", "SOURCE_INSPECTION", {
        kind: "UNVERIFIABLE_REFERENCE",
        value: "unknown audit state",
        reason: "No direct proof was collected.",
      }, "LOW"],
    ];

    for (const [evidenceClass, evidenceType, locator, confidence] of supported) {
      const bundle = validBundle();
      bundle.evidence[0].evidenceClass = evidenceClass;
      bundle.evidence[0].evidenceType = evidenceType;
      bundle.evidence[0].locator = locator;
      bundle.decisions[0].confidence = confidence;
      expect(validateAuditBundle(bundle), `${evidenceClass}/${evidenceType}/${locator.kind}`).toEqual({
        ok: true,
        errors: [],
      });
    }
  });

  it("requires PASS direct local, runtime, or artifact-bound human research for HIGH confidence", () => {
    for (const evidenceClass of ["AUTHORITATIVE_EXTERNAL", "INFERENCE", "UNKNOWN"]) {
      const invalid = validBundle();
      invalid.evidence[0].evidenceClass = evidenceClass;
      if (evidenceClass === "AUTHORITATIVE_EXTERNAL") {
        invalid.evidence[0].evidenceType = "AUTHORITATIVE_DOCUMENT";
        invalid.evidence[0].locator = {
          kind: "AUTHORITATIVE_URL",
          url: "https://www.w3.org/TR/WCAG22/",
        };
      } else {
        invalid.evidence[0].locator = {
          kind: "UNVERIFIABLE_REFERENCE",
          value: "bounded audit hypothesis",
          reason: "Direct proof is unavailable.",
        };
      }
      expect(validateAuditBundle(invalid)).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([expect.stringContaining("HIGH confidence")]),
      });
    }

    const human = validBundle();
    human.evidence[0].evidenceClass = "HUMAN_RESEARCH";
    human.evidence[0].evidenceType = "HUMAN_RESEARCH_RECEIPT";
    human.evidence[0].locator = {
      kind: "HUMAN_RECEIPT",
      receiptId: "research-receipt-1",
      artifactPath: "artifacts/research/research-receipt-1.json",
    };
    expect(validateAuditBundle(human)).toEqual({ ok: true, errors: [] });

    for (const result of ["FAIL", "N/A", "UNVERIFIED"]) {
      const invalid = validBundle();
      invalid.evidence[0].result = result;
      expect(validateAuditBundle(invalid), result).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([expect.stringContaining("HIGH confidence")]),
      });
    }
  });

  it("rehashes human-research receipts before accepting them as HIGH-confidence evidence", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-human-receipt-"));
    let subjects;
    try {
      const receiptPath = "artifacts/research/research-receipt-1.json";
      const humanReceiptBody = `${JSON.stringify({
        schemaVersion: "1.0.0",
        receiptId: "research-receipt-1",
        studyStatus: "COMPLETE",
      })}\n`;
      const bundle = validBundle();
      bundle.evidence[0].evidenceClass = "HUMAN_RESEARCH";
      bundle.evidence[0].evidenceType = "HUMAN_RESEARCH_RECEIPT";
      bundle.evidence[0].locator = {
        kind: "HUMAN_RECEIPT",
        receiptId: "research-receipt-1",
        artifactPath: receiptPath,
      };
      bundle.evidence[0].artifactSha256 = createHash("sha256")
        .update(humanReceiptBody)
        .digest("hex");
      subjects = await prepareSubjectRepositories(bundle);
      await writeBundle(root, bundle, subjects.artifactBodies);
      await mkdir(path.dirname(path.join(root, receiptPath)), { recursive: true });
      await writeFile(path.join(root, receiptPath), humanReceiptBody);

      const pass = spawnSync(
        process.execPath,
        [CLI, "validate", "--input", root, ...subjects.cliArgs],
        { encoding: "utf8" },
      );
      expect(pass.status, pass.stderr || pass.stdout).toBe(0);

      await writeFile(path.join(root, receiptPath), `${humanReceiptBody}tampered\n`);
      const tampered = spawnSync(
        process.execPath,
        [CLI, "validate", "--input", root, ...subjects.cliArgs],
        { encoding: "utf8" },
      );
      expect(tampered.status).toBe(1);
      expect(tampered.stdout).toMatch(/human research receipt.*hash mismatch/i);

      const wrongReceiptBody = `${JSON.stringify({
        schemaVersion: "1.0.0",
        receiptId: "different-research-receipt",
        studyStatus: "COMPLETE",
      })}\n`;
      bundle.evidence[0].artifactSha256 = createHash("sha256")
        .update(wrongReceiptBody)
        .digest("hex");
      await writeBundle(root, bundle, subjects.artifactBodies);
      await writeFile(path.join(root, receiptPath), wrongReceiptBody);
      const wrongIdentity = spawnSync(
        process.execPath,
        [CLI, "validate", "--input", root, ...subjects.cliArgs],
        { encoding: "utf8" },
      );
      expect(wrongIdentity.status).toBe(1);
      expect(wrongIdentity.stdout).toMatch(/human research receipt.*(?:identity|content)/i);
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        subjects ? rm(subjects.parent, { recursive: true, force: true }) : Promise.resolve(),
      ]);
    }
  });

  it("rejects repository source paths that are not canonical repository-relative paths", () => {
    for (const unsafePath of [
      "scripts/./private.ts",
      "scripts//private.ts",
      "C:private.ts",
      "scripts/private.ts\u0000suffix",
    ]) {
      const invalid = validBundle();
      invalid.evidence[0].locator.path = unsafePath;
      expect(validateAuditBundle(invalid), unsafePath).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([expect.stringContaining("normalized repository-relative path")]),
      });
    }
  });

  it("rejects structurally empty ledgers instead of presenting an empty audit as complete", () => {
    for (const ledger of ["evidence", "capabilities", "decisions", "findingHistory"]) {
      const invalid = validBundle();
      invalid[ledger] = [];
      expect(validateAuditBundle(invalid)).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([expect.stringMatching(new RegExp(ledger, "i"))]),
      });
    }
  });

  it("rejects local artifact locators that traverse outside the input directory", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-artifact-root-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "product-coherence-artifact-outside-"));
    try {
      const outsideArtifact = path.join(outside, "evidence.txt");
      await writeFile(outsideArtifact, "outside audit evidence\n");
      const bundle = validBundle();
      bundle.evidence[0].locator = { kind: "LOCAL_ARTIFACT", path: path.relative(root, outsideArtifact) };
      await writeBundle(root, bundle);

      const result = spawnSync(process.execPath, [CLI, "validate", "--input", root], { encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("normalized repository-relative path");
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(outside, { recursive: true, force: true }),
      ]);
    }
  });

  it("rejects symlinked ledgers that escape the resolved input directory", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-ledger-root-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "product-coherence-ledger-outside-"));
    try {
      await writeBundle(root, validBundle());
      const outsideManifest = path.join(outside, "manifest.jsonl");
      await writeFile(outsideManifest, `${JSON.stringify(validBundle().manifest)}\n`);
      await rm(path.join(root, "manifest.jsonl"));
      await symlink(outsideManifest, path.join(root, "manifest.jsonl"));

      const result = spawnSync(process.execPath, [CLI, "validate", "--input", root], { encoding: "utf8" });
      expect(result.status).toBe(2);
      expect(result.stderr).toMatch(/symlink|escape/);
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(outside, { recursive: true, force: true }),
      ]);
    }
  });

  it("enumerates neutral repository-derived candidates deterministically without decisions", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-inventory-"));
    try {
      await mkdir(path.join(root, "src"), { recursive: true });
      await mkdir(path.join(root, "node_modules", "ignored"), { recursive: true });
      await writeFile(path.join(root, "src", "B.ts"), "export const b = 2;\n");
      await writeFile(path.join(root, "src", "A.tsx"), "export const A = () => null;\n");
      await writeFile(path.join(root, "src", "Z.ts"), "export const z = 3;\n");
      await writeFile(path.join(root, "src", "a.ts"), "export const a = 4;\n");
      await writeFile(path.join(root, "node_modules", "ignored", "fake.ts"), "ignored\n");

      const run = () =>
        spawnSync(process.execPath, [CLI, "inventory", "--root", root, "--subject", "candidate"], {
          encoding: "utf8",
        });
      const first = run();
      const second = run();
      expect(first.status, first.stderr).toBe(0);
      expect(second.status, second.stderr).toBe(0);
      expect(first.stdout).toBe(second.stdout);
      const inventory = JSON.parse(first.stdout);
      expect(inventory.candidates.map((candidate) => candidate.path)).toEqual([
        "src/A.tsx",
        "src/B.ts",
        "src/Z.ts",
        "src/a.ts",
      ]);
      expect(first.stdout).not.toMatch(/reachability|disposition|decision/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed when an inventory file is replaced by a symlink after it is opened", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-inventory-race-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "product-coherence-inventory-race-outside-"));
    try {
      const target = path.join(root, "source.ts");
      const moved = path.join(root, "source.original.ts");
      const outsideTarget = path.join(outside, "private.ts");
      await writeFile(target, "export const safe = true;\n");
      await writeFile(outsideTarget, "private fixture\n");

      await expect(
        enumerateRepositoryCandidates(root, "candidate", {
          afterFileOpen: async (openedPath) => {
            if (path.basename(openedPath) !== "source.ts") return;
            await rename(target, moved);
            await symlink(outsideTarget, target);
          },
        }),
      ).rejects.toThrow(/changed|symlink|identity/i);
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(outside, { recursive: true, force: true }),
      ]);
    }
  });

  it("fails closed on JSONL byte, line, and record bounds", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-jsonl-"));
    try {
      const bytesPath = path.join(root, "bytes.jsonl");
      const linesPath = path.join(root, "lines.jsonl");
      const recordsPath = path.join(root, "records.jsonl");
      await writeFile(bytesPath, "x".repeat(JSONL_LIMITS.maxFileBytes + 1));
      await writeFile(linesPath, "\n".repeat(JSONL_LIMITS.maxLines + 1));
      await writeFile(recordsPath, `${"{}\n".repeat(JSONL_LIMITS.maxRecords + 1)}`);

      await expect(readJsonl(bytesPath)).rejects.toThrow("byte limit");
      await expect(readJsonl(linesPath)).rejects.toThrow("line limit");
      await expect(readJsonl(recordsPath)).rejects.toThrow("record limit");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a JSONL path replacement after the ledger descriptor opens", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-jsonl-race-"));
    try {
      const ledgerPath = path.join(root, "evidence.jsonl");
      const replacementPath = path.join(root, "replacement.jsonl");
      await writeFile(ledgerPath, '{"record":"opened"}\n');
      await writeFile(replacementPath, '{"record":"replacement"}\n');
      let hookCalled = false;

      await expect(
        readJsonl(ledgerPath, {
          afterFileOpen: async () => {
            hookCalled = true;
            await rename(replacementPath, ledgerPath);
          },
        }),
      ).rejects.toThrow(/changed|identity/i);
      expect(hookCalled).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function runGit(cwd, args) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

function runGitBuffer(cwd, args) {
  return spawnSync("git", args, { cwd });
}
