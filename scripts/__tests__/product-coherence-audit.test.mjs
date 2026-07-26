import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { renderAuditMarkdown, validateAuditBundle } from "../product-coherence/core.mjs";
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
const BUILD_EVIDENCE_BODY = "build verification evidence\n";
const DEPLOY_EVIDENCE_BODY = "deployment verification evidence\n";
const BUILD_EVIDENCE_SHA = createHash("sha256").update(BUILD_EVIDENCE_BODY).digest("hex");
const DEPLOY_EVIDENCE_SHA = createHash("sha256").update(DEPLOY_EVIDENCE_BODY).digest("hex");

function validBundle() {
  const evidence = [
    evidenceRecord("baseline-evidence", "production-baseline"),
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
      redactionRules: ["NO_RAW_SENSITIVE_PAYLOADS", "HASH_IDENTIFIERS"],
      subjects: [
        {
          subjectId: "production-baseline",
          repository: {
            oidAlgorithm: "sha1",
            commitOid: BASELINE_COMMIT,
            treeOid: BASELINE_TREE,
          },
          build: { status: "PASS", artifactSha256: SHA, evidenceId: "baseline-build-evidence" },
          deploy: {
            status: "PASS",
            artifactSha256: OTHER_SHA,
            publicUrl: "https://yehor212.github.io/people-first-app/",
            deployedRevision: { oidAlgorithm: "sha1", commitOid: DEPLOYED_COMMIT },
            evidenceId: "baseline-deploy-evidence",
          },
        },
        {
          subjectId: "candidate",
          repository: {
            oidAlgorithm: "sha1",
            commitOid: CANDIDATE_COMMIT,
            treeOid: CANDIDATE_TREE,
            gitStatusSha256: SHA,
            trackedDiffSha256: OTHER_SHA,
            sanitizedUntrackedManifestSha256: SHA,
            privacyScanReceiptSha256: OTHER_SHA,
            candidateSnapshotSha256: SHA,
          },
          build: { status: "UNVERIFIED", reason: "Task 1 validates the contract only." },
          deploy: { status: "N/A", reason: "Candidate deployment is outside Task 1." },
        },
      ],
      roleReceipts: roleReceipts(),
    },
    evidence,
    capabilities: [
      capabilityRecord("baseline-capability", "production-baseline", "baseline-evidence"),
    ],
    decisions: [decisionRecord()],
    findingHistory: [
      {
        findingId: "finding-1",
        subjectId: "production-baseline",
        capabilityId: "baseline-capability",
        decisionId: "decision-1",
        events: [
          historyEvent(0, "DISCOVERED", "2026-07-26T16:00:00.000Z"),
          historyEvent(1, "TRIAGED", "2026-07-26T16:01:00.000Z"),
          historyEvent(2, "DECIDED", "2026-07-26T16:02:00.000Z"),
          historyEvent(3, "IMPLEMENTING", "2026-07-26T16:03:00.000Z"),
          historyEvent(4, "VERIFIED", "2026-07-26T16:04:00.000Z"),
        ],
      },
    ],
  };
}

function roleReceipts() {
  const subjectIds = ["production-baseline", "candidate"];
  return [
    { roleId: "coordinator-teamlead", phase: "INITIAL", subjectIds, verdict: "GO", receiptSha256: SHA },
    { roleId: "coordinator-teamlead", phase: "INTEGRATION", subjectIds, verdict: "GO", receiptSha256: SHA },
    {
      roleId: "psychology-human-factors-emotional-safety",
      phase: "INITIAL",
      subjectIds,
      verdict: "GO",
      receiptSha256: SHA,
    },
    { roleId: "logic-causality-state-coherence", phase: "INITIAL", subjectIds, verdict: "GO", receiptSha256: SHA },
    {
      roleId: "interaction-accessibility-readability-localization-culture",
      phase: "INITIAL",
      subjectIds,
      verdict: "GO",
      receiptSha256: SHA,
    },
    {
      roleId: "technical-architecture-data-cross-platform",
      phase: "INITIAL",
      subjectIds,
      verdict: "GO",
      receiptSha256: SHA,
    },
    { roleId: "security-privacy-agent-trust", phase: "INITIAL", subjectIds, verdict: "GO", receiptSha256: SHA },
    {
      roleId: "performance-reliability-operations",
      phase: "INITIAL",
      subjectIds,
      verdict: "GO",
      receiptSha256: SHA,
    },
    {
      roleId: "qa-evidence-release-verification",
      phase: "INITIAL",
      subjectIds,
      verdict: "GO",
      receiptSha256: SHA,
    },
    {
      roleId: "product-discovery-visual-craft-experience-quality",
      phase: "INITIAL",
      subjectIds,
      verdict: "GO",
      receiptSha256: SHA,
    },
    {
      roleId: "independent-blind-spot-sentinel",
      phase: "PASS_A",
      subjectIds,
      verdict: "GO",
      receiptSha256: SHA,
    },
    {
      roleId: "independent-blind-spot-sentinel",
      phase: "PASS_B",
      subjectIds,
      verdict: "GO",
      receiptSha256: SHA,
    },
  ];
}

function evidenceRecord(evidenceId, subjectId) {
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
      ...(isCandidate ? { candidateSnapshotSha256: SHA } : {}),
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

function artifactEvidenceRecord(evidenceId, evidenceClass, evidenceType, artifactPath, artifactSha256, platform) {
  return {
    evidenceId,
    subjectId: "production-baseline",
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

function decisionRecord() {
  return {
    decisionId: "decision-1",
    subjectId: "production-baseline",
    capabilityId: "baseline-capability",
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
    evidenceIds: ["baseline-evidence"],
  };
}

function historyEvent(sequence, state, observedAt) {
  return { sequence, state, observedAt, evidenceIds: ["baseline-evidence"] };
}

async function writeBundle(directory, bundle) {
  const ledgers = {
    manifest: [bundle.manifest],
    evidence: bundle.evidence,
    capabilities: bundle.capabilities,
    decisions: bundle.decisions,
    findingHistory: bundle.findingHistory,
  };
  await mkdir(path.join(directory, "artifacts"), { recursive: true });
  await Promise.all([
    writeFile(path.join(directory, "artifacts", "build.txt"), BUILD_EVIDENCE_BODY),
    writeFile(path.join(directory, "artifacts", "deploy.txt"), DEPLOY_EVIDENCE_BODY),
    ...Object.entries(ledgers).map(([name, rows]) =>
      writeFile(path.join(directory, `${name}.jsonl`), rows.map((row) => JSON.stringify(row)).join("\n")),
    ),
  ]);
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

  it("requires the exact twelve phase-bound receipts for all ten audit roles", () => {
    const invalid = validBundle();
    invalid.manifest.roleReceipts = Array.from({ length: 12 }, () => ({
      roleId: "qa-evidence-release-verification",
      phase: "INITIAL",
      subjectIds: ["production-baseline", "candidate"],
      verdict: "GO",
      receiptSha256: SHA,
    }));

    expect(validateAuditBundle(invalid)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/role receipt|duplicate|required/)]),
    });
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
    const markdown = renderAuditMarkdown(validBundle());

    for (const state of ["DISCOVERED", "TRIAGED", "DECIDED", "IMPLEMENTING", "VERIFIED"]) {
      expect(markdown).toContain(state);
    }
    expect(markdown).toContain("decision-1");
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
    try {
      const bundle = validBundle();
      await mkdir(path.join(root, "artifacts"), { recursive: true });
      await writeFile(path.join(root, "artifacts", "evidence.txt"), "bounded audit evidence\n");
      bundle.evidence[0].locator = { kind: "LOCAL_ARTIFACT", path: "artifacts/evidence.txt" };
      bundle.evidence[0].artifactSha256 = SHA;
      await writeBundle(root, bundle);

      const result = spawnSync(process.execPath, [CLI, "validate", "--input", root], { encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("local artifact hash mismatch");

      bundle.evidence[0].artifactSha256 = createHash("sha256")
        .update("bounded audit evidence\n")
        .digest("hex");
      await writeBundle(root, bundle);
      const valid = spawnSync(process.execPath, [CLI, "validate", "--input", root], { encoding: "utf8" });
      expect(valid.status, valid.stderr).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("confines repository sources, binds them to the subject revision, and rehashes content", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-repository-"));
    const ledgerRoot = await mkdtemp(path.join(os.tmpdir(), "product-coherence-repository-ledger-"));
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
      bundle.manifest.subjects[0].repository.commitOid = commitOid;
      bundle.manifest.subjects[0].repository.treeOid = treeOid;
      bundle.evidence[0].locator.revision.commitOid = commitOid;
      bundle.evidence[0].artifactSha256 = createHash("sha256")
        .update("export const contract = true;\n")
        .digest("hex");
      await writeBundle(ledgerRoot, bundle);

      const pass = spawnSync(
        process.execPath,
        [
          CLI,
          "validate",
          "--input",
          ledgerRoot,
          "--subject-root",
          `production-baseline=${root}`,
        ],
        { encoding: "utf8" },
      );
      expect(pass.status, pass.stderr || pass.stdout).toBe(0);

      await writeFile(sourcePath, "export const contract = false;\n");
      const changed = spawnSync(
        process.execPath,
        [
          CLI,
          "validate",
          "--input",
          ledgerRoot,
          "--subject-root",
          `production-baseline=${root}`,
        ],
        { encoding: "utf8" },
      );
      expect(changed.status).toBe(1);
      expect(changed.stdout).toContain("repository source hash mismatch");

      const escaped = validBundle();
      escaped.evidence[0].locator.path = "../../outside/private.ts";
      expect(validateAuditBundle(escaped)).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([expect.stringContaining("repository-relative")]),
      });

      const wrongRevision = validBundle();
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
        ],
        { encoding: "utf8" },
      );
      expect(symlinkedRoot.status).toBe(1);
      expect(symlinkedRoot.stdout).toMatch(/subject root.*symlink|real directory/i);

      const outside = await mkdtemp(path.join(os.tmpdir(), "product-coherence-repository-outside-"));
      try {
        await writeFile(path.join(outside, "private.ts"), "private fixture\n");
        await symlink(outside, path.join(root, "linked"));
        const escapedThroughIntermediateLink = validBundle();
        escapedThroughIntermediateLink.manifest.subjects[0].repository.commitOid = commitOid;
        escapedThroughIntermediateLink.manifest.subjects[0].repository.treeOid = treeOid;
        escapedThroughIntermediateLink.evidence[0].locator.path = "linked/private.ts";
        escapedThroughIntermediateLink.evidence[0].locator.revision.commitOid = commitOid;
        escapedThroughIntermediateLink.evidence[0].artifactSha256 = createHash("sha256")
          .update("private fixture\n")
          .digest("hex");
        await writeBundle(ledgerRoot, escapedThroughIntermediateLink);
        const intermediateLink = spawnSync(
          process.execPath,
          [
            CLI,
            "validate",
            "--input",
            ledgerRoot,
            "--subject-root",
            `production-baseline=${root}`,
          ],
          { encoding: "utf8" },
        );
        expect(intermediateLink.status).toBe(1);
        expect(intermediateLink.stdout).toMatch(/escape|symlink|realpath/i);
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(ledgerRoot, { recursive: true, force: true }),
      ]);
    }
  });

  it("binds candidate repository sources to the dirty snapshot and reads worktree bytes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-candidate-repository-"));
    const ledgerRoot = await mkdtemp(path.join(os.tmpdir(), "product-coherence-candidate-ledger-"));
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

      const bundle = validBundle();
      bundle.manifest.subjects[1].repository.commitOid = commitOid;
      bundle.manifest.subjects[1].repository.treeOid = treeOid;
      bundle.manifest.subjects[1].repository.gitStatusSha256 = createHash("sha256")
        .update(runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]).stdout)
        .digest("hex");
      bundle.manifest.subjects[1].repository.trackedDiffSha256 = createHash("sha256")
        .update(runGit(root, ["diff", "--binary", "HEAD", "--"]).stdout)
        .digest("hex");
      bundle.evidence = [
        evidenceRecord("candidate-evidence", "candidate"),
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
      bundle.evidence[0].locator.revision.commitOid = commitOid;
      bundle.evidence[0].artifactSha256 = createHash("sha256")
        .update("export const dirtyCandidate = true;\n")
        .digest("hex");
      bundle.capabilities[0] = capabilityRecord("candidate-capability", "candidate", "candidate-evidence");
      bundle.decisions[0] = {
        ...decisionRecord(),
        capabilityId: "candidate-capability",
        subjectId: "candidate",
        evidenceIds: ["candidate-evidence"],
      };
      bundle.findingHistory[0] = {
        ...bundle.findingHistory[0],
        subjectId: "candidate",
        capabilityId: "candidate-capability",
        events: bundle.findingHistory[0].events.map((event) => ({
          ...event,
          evidenceIds: ["candidate-evidence"],
        })),
      };
      await writeBundle(ledgerRoot, bundle);

      const pass = spawnSync(
        process.execPath,
        [
          CLI,
          "validate",
          "--input",
          ledgerRoot,
          "--subject-root",
          `candidate=${root}`,
        ],
        { encoding: "utf8" },
      );
      expect(pass.status, pass.stderr || pass.stdout).toBe(0);

      bundle.evidence[0].locator.candidateSnapshotSha256 = OTHER_SHA;
      expect(validateAuditBundle(bundle)).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([expect.stringContaining("candidate snapshot")]),
      });
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(ledgerRoot, { recursive: true, force: true }),
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
      }, "MEDIUM"],
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

  it("requires direct local or runtime evidence for HIGH confidence", () => {
    for (const evidenceClass of ["AUTHORITATIVE_EXTERNAL", "HUMAN_RESEARCH", "INFERENCE", "UNKNOWN"]) {
      const invalid = validBundle();
      invalid.evidence[0].evidenceClass = evidenceClass;
      if (evidenceClass === "AUTHORITATIVE_EXTERNAL") {
        invalid.evidence[0].evidenceType = "AUTHORITATIVE_DOCUMENT";
        invalid.evidence[0].locator = {
          kind: "AUTHORITATIVE_URL",
          url: "https://www.w3.org/TR/WCAG22/",
        };
      } else if (evidenceClass === "HUMAN_RESEARCH") {
        invalid.evidence[0].evidenceType = "HUMAN_RESEARCH_RECEIPT";
        invalid.evidence[0].locator = {
          kind: "HUMAN_RECEIPT",
          receiptId: "research-receipt-1",
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
});

function runGit(cwd, args) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}
