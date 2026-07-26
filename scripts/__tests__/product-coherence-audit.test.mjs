import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { renderAuditMarkdown, validateAuditBundle } from "../product-coherence/core.mjs";
import { JSONL_LIMITS, readJsonl } from "../product-coherence/jsonl.mjs";

const CLI = path.resolve("scripts/product-coherence/cli.mjs");
const SHA = "a".repeat(64);
const OTHER_SHA = "b".repeat(64);
const BASELINE_COMMIT = "1".repeat(40);
const BASELINE_TREE = "2".repeat(40);
const DEPLOYED_COMMIT = "3".repeat(40);
const CANDIDATE_COMMIT = "4".repeat(40);
const CANDIDATE_TREE = "5".repeat(40);

function validBundle() {
  const evidence = [evidenceRecord("baseline-evidence", "production-baseline")];
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
          build: { status: "PASS", artifactSha256: SHA },
          deploy: {
            status: "PASS",
            artifactSha256: OTHER_SHA,
            publicUrl: "https://yehor212.github.io/people-first-app/",
            deployedRevision: { oidAlgorithm: "sha1", commitOid: DEPLOYED_COMMIT },
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
      roleReceipts: [
        { roleId: "qa-evidence-release-verification", subjectId: "production-baseline", receiptSha256: SHA },
      ],
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

function evidenceRecord(evidenceId, subjectId) {
  return {
    evidenceId,
    subjectId,
    evidenceClass: "DIRECT_LOCAL",
    evidenceType: "SOURCE_INSPECTION",
    locator: { kind: "REPOSITORY_SOURCE", value: "scripts/product-coherence/core.mjs" },
    observedAt: "2026-07-26T16:00:00.000Z",
    tool: { name: "git", version: "2.50.1" },
    scope: {
      platforms: ["WEB"],
      deviceScope: "repository metadata",
      accountCohort: "anonymous",
    },
    result: "PASS",
    artifactSha256: SHA,
    privacyClass: "SENSITIVE_NOT_CAPTURED",
    invalidationTriggers: ["source-change"],
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
  await Promise.all(
    Object.entries(ledgers).map(([name, rows]) =>
      writeFile(path.join(directory, `${name}.jsonl`), rows.map((row) => JSON.stringify(row)).join("\n")),
    ),
  );
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
    expect(validateAuditBundle(blocked)).toEqual({ ok: true, errors: [] });
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
      expect(result.stdout).toContain("escapes input directory");
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
      expect(inventory.candidates.map((candidate) => candidate.path)).toEqual(["src/A.tsx", "src/B.ts"]);
      expect(first.stdout).not.toMatch(/reachability|disposition|decision/i);
    } finally {
      await rm(root, { recursive: true, force: true });
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
