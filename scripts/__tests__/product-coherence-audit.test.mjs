import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { renderAuditMarkdown, validateAuditBundle } from "../product-coherence/core.mjs";

const SHA = "a".repeat(64);

function validBundle() {
  return {
    manifest: {
      runId: "product-coherence-contract",
      schemaVersion: "1.0.0",
      requestSha256: SHA,
      policySha256: SHA,
      toolInventorySha256: SHA,
      sourceLedgerSha256: SHA,
      redactionRules: ["NO_RAW_SENSITIVE_DATA"],
      subjects: [
        {
          subjectId: "baseline",
          repository: { commitSha256: SHA, treeSha256: SHA },
          build: { status: "PASS", artifactSha256: SHA },
          deploy: { status: "NOT_ATTEMPTED", artifactSha256: SHA },
        },
        {
          subjectId: "candidate",
          repository: {
            commitSha256: SHA,
            treeSha256: SHA,
            gitStatusSha256: SHA,
            trackedDiffSha256: "b".repeat(64),
          },
          build: { status: "UNVERIFIED", artifactSha256: SHA },
          deploy: { status: "NOT_ATTEMPTED", artifactSha256: SHA },
        },
      ],
      roleReceipts: [{ roleId: "qa-evidence", subjectId: "baseline", receiptSha256: SHA }],
    },
    evidence: [
      {
        evidenceId: "baseline-evidence",
        subjectId: "baseline",
        evidenceClass: "SOURCE",
        evidenceType: "GIT",
        observedAt: "2026-07-26T16:00:00.000Z",
        tool: { name: "git", version: "2" },
        scope: { platforms: ["web"], deviceScope: "repository" },
        result: "PASS",
        artifactSha256: SHA,
        privacyClass: "METADATA_ONLY",
        invalidatesOn: ["source-change"],
      },
      {
        evidenceId: "candidate-evidence",
        subjectId: "candidate",
        evidenceClass: "SOURCE",
        evidenceType: "GIT",
        observedAt: "2026-07-26T16:00:00.000Z",
        tool: { name: "git", version: "2" },
        scope: { platforms: ["web"], deviceScope: "repository" },
        result: "PASS",
        artifactSha256: SHA,
        privacyClass: "METADATA_ONLY",
        invalidatesOn: ["source-change"],
      },
    ],
    capabilities: [
      {
        capabilityId: "baseline-capability",
        subjectId: "baseline",
        evidenceId: "baseline-evidence",
        reachability: "REACHABLE",
        disposition: "IN_SCOPE",
        userJob: "record a product capability",
        userRole: "member",
        surfaces: ["settings"],
        platforms: ["web"],
        locales: ["en"],
        cohorts: ["anonymous"],
        trace: ["src/example.ts"],
        permissions: ["none"],
        dataActions: ["NONE"],
        dependencies: ["none"],
        promises: ["capability is observed"],
      },
      {
        capabilityId: "candidate-capability",
        subjectId: "candidate",
        evidenceId: "candidate-evidence",
        reachability: "REACHABLE",
        disposition: "IN_SCOPE",
        userJob: "record a candidate capability",
        userRole: "member",
        surfaces: ["settings"],
        platforms: ["web"],
        locales: ["en"],
        cohorts: ["anonymous"],
        trace: ["src/example.ts"],
        permissions: ["none"],
        dataActions: ["NONE"],
        dependencies: ["none"],
        promises: ["candidate capability is observed"],
      },
    ],
    decisions: [
      {
        decisionId: "candidate-decision",
        subjectId: "candidate",
        capabilityId: "candidate-capability",
        evidenceId: "candidate-evidence",
        disposition: "DEFERRED_UNVERIFIED",
        rationale: "No product decision is invented by this contract.",
      },
    ],
    findingHistory: [
      {
        findingId: "candidate-finding",
        subjectId: "candidate",
        capabilityId: "candidate-capability",
        transitions: [
          { from: "START", to: "DISCOVERED" },
          { from: "DISCOVERED", to: "TRIAGED" },
          { from: "TRIAGED", to: "DECIDED" },
          { from: "DECIDED", to: "IMPLEMENTING" },
          { from: "IMPLEMENTING", to: "VERIFIED" },
        ],
      },
    ],
  };
}

function writeBundle(directory, bundle) {
  const ledgers = {
    manifest: [bundle.manifest],
    evidence: bundle.evidence,
    capabilities: bundle.capabilities,
    decisions: bundle.decisions,
    findingHistory: bundle.findingHistory,
  };
  return Promise.all(
    Object.entries(ledgers).map(([name, rows]) =>
      writeFile(path.join(directory, `${name}.jsonl`), rows.map((row) => JSON.stringify(row)).join("\n")),
    ),
  );
}

describe("ProductCoherenceAudit v1 ledger contract", () => {
  it("accepts an approved two-subject manifest and renders only ledger facts", () => {
    const bundle = validBundle();

    expect(validateAuditBundle(bundle)).toEqual({ ok: true, errors: [] });
    expect(renderAuditMarkdown(bundle)).toContain("candidate-finding");
  });

  it("rejects evidence referenced from a different subject", () => {
    const bundle = validBundle();
    bundle.capabilities[0].evidenceId = "candidate-evidence";

    expect(validateAuditBundle(bundle)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("subject mismatch")]),
    });
  });

  it("rejects partial candidate provenance on the baseline subject", () => {
    const bundle = validBundle();
    bundle.manifest.subjects[0].repository.gitStatusSha256 = SHA;

    expect(validateAuditBundle(bundle)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("baseline cannot carry")]),
    });
  });

  it("rejects an unresolved candidate record instead of inventing a disposition", () => {
    const bundle = validBundle();
    bundle.capabilities[1].disposition = "UNRESOLVED_CANDIDATE";

    expect(validateAuditBundle(bundle)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("UNRESOLVED")]),
    });
  });

  it("rejects an invalid finding state transition", () => {
    const bundle = validBundle();
    bundle.findingHistory[0].transitions = [{ from: "DISCOVERED", to: "VERIFIED" }];

    expect(validateAuditBundle(bundle)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("invalid finding transition")]),
    });
  });

  it("rejects sensitive fields from every durable ledger row", () => {
    const bundle = validBundle();
    bundle.evidence[1].journalPayload = "redacted";

    expect(validateAuditBundle(bundle)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("sensitive field")]),
    });
  });

  it("rejects raw credential-like values while allowing device metadata scope", () => {
    const bundle = validBundle();
    bundle.evidence[1].scope.deviceScope = "Bearer raw-test-credential";

    expect(validateAuditBundle(bundle)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("sensitive value")]),
    });
  });

  it("exposes deterministic read-only inventory, validation, and report commands", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "product-coherence-ledger-"));
    try {
      const bundle = validBundle();
      await writeBundle(directory, bundle);

      for (const command of ["inventory", "validate", "report"]) {
        const result = spawnSync(process.execPath, ["scripts/product-coherence/cli.mjs", command, "--input", directory], {
          cwd: process.cwd(),
          encoding: "utf8",
        });
        expect(result.status, result.stderr).toBe(0);
        const expectedOutput =
          command === "report"
            ? "# Product Coherence Audit"
            : command === "validate"
              ? '"ok":true'
              : "candidate";
        expect(result.stdout).toContain(expectedOutput);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not inventory an invalid ledger as if it were a valid audit input", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "product-coherence-invalid-ledger-"));
    try {
      const bundle = validBundle();
      bundle.capabilities[1].disposition = "UNRESOLVED_CANDIDATE";
      await writeBundle(directory, bundle);

      const result = spawnSync(
        process.execPath,
        ["scripts/product-coherence/cli.mjs", "inventory", "--input", directory],
        { cwd: process.cwd(), encoding: "utf8" },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("UNRESOLVED");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("normalizes inventory JSON instead of inheriting input property order", async () => {
    const leftDirectory = await mkdtemp(path.join(os.tmpdir(), "product-coherence-left-"));
    const rightDirectory = await mkdtemp(path.join(os.tmpdir(), "product-coherence-right-"));
    try {
      const left = validBundle();
      const right = validBundle();
      right.manifest = {
        ...right.manifest,
        subjects: [
          {
            deploy: { artifactSha256: SHA, status: "NOT_ATTEMPTED" },
            build: { artifactSha256: SHA, status: "PASS" },
            repository: { treeSha256: SHA, commitSha256: SHA },
            subjectId: "baseline",
          },
          {
            deploy: { artifactSha256: SHA, status: "NOT_ATTEMPTED" },
            build: { artifactSha256: SHA, status: "UNVERIFIED" },
            repository: { trackedDiffSha256: "b".repeat(64), gitStatusSha256: SHA, treeSha256: SHA, commitSha256: SHA },
            subjectId: "candidate",
          },
        ],
      };
      for (const [directory, bundle] of [[leftDirectory, left], [rightDirectory, right]]) {
        await writeBundle(directory, bundle);
      }

      const inventory = (directory) =>
        spawnSync(process.execPath, ["scripts/product-coherence/cli.mjs", "inventory", "--input", directory], {
          cwd: process.cwd(),
          encoding: "utf8",
        });
      const leftResult = inventory(leftDirectory);
      const rightResult = inventory(rightDirectory);
      expect(leftResult.status, leftResult.stderr).toBe(0);
      expect(rightResult.status, rightResult.stderr).toBe(0);
      expect(leftResult.stdout).toBe(rightResult.stdout);
    } finally {
      await Promise.all([rm(leftDirectory, { recursive: true, force: true }), rm(rightDirectory, { recursive: true, force: true })]);
    }
  });
});
