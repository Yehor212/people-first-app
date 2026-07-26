import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { renderAuditMarkdown, validateAuditBundle } from "../product-coherence/core.mjs";

const SHA = "a".repeat(64);

function validBundle() {
  return {
    manifests: [
      { subjectId: "baseline", subjectSnapshotSha256: SHA },
      {
        subjectId: "candidate",
        subjectSnapshotSha256: SHA,
        candidateProvenance: {
          gitStatusSha256: SHA,
          trackedDiffSha256: "b".repeat(64),
        },
      },
    ],
    evidence: [
      { evidenceId: "baseline-evidence", subjectId: "baseline", locator: "git:origin/main" },
      { evidenceId: "candidate-evidence", subjectId: "candidate", locator: "git:candidate" },
    ],
    capabilities: [
      {
        capabilityId: "baseline-capability",
        subjectId: "baseline",
        evidenceId: "baseline-evidence",
        disposition: "CLASSIFIED",
      },
      {
        capabilityId: "candidate-capability",
        subjectId: "candidate",
        evidenceId: "candidate-evidence",
        disposition: "CLASSIFIED",
      },
    ],
    findings: [
      {
        findingId: "candidate-finding",
        subjectId: "candidate",
        capabilityId: "candidate-capability",
        transitions: [{ from: "OPEN", to: "VERIFIED" }],
      },
    ],
  };
}

describe("ProductCoherenceAudit v1 ledger contract", () => {
  it("accepts independently valid baseline and candidate manifests and renders only their ledger facts", () => {
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

  it("rejects an unresolved candidate record instead of inventing a disposition", () => {
    const bundle = validBundle();
    bundle.capabilities[1].disposition = "UNRESOLVED";

    expect(validateAuditBundle(bundle)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("UNRESOLVED")]),
    });
  });

  it("rejects an invalid finding state transition", () => {
    const bundle = validBundle();
    bundle.findings[0].transitions = [{ from: "OPEN", to: "RESOLVED" }];

    expect(validateAuditBundle(bundle)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("invalid finding transition")]),
    });
  });

  it("rejects sensitive fields from every durable ledger row", () => {
    const bundle = validBundle();
    bundle.evidence[1].token = "redacted";

    expect(validateAuditBundle(bundle)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining("sensitive field")]),
    });
  });

  it("exposes deterministic read-only inventory, validation, and report commands", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "product-coherence-ledger-"));
    try {
      const bundle = validBundle();
      await Promise.all(
        Object.entries(bundle).map(([name, rows]) =>
          writeFile(path.join(directory, `${name}.jsonl`), rows.map((row) => JSON.stringify(row)).join("\n")),
        ),
      );

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
      bundle.capabilities[1].disposition = "UNRESOLVED";
      await Promise.all(
        Object.entries(bundle).map(([name, rows]) =>
          writeFile(path.join(directory, `${name}.jsonl`), rows.map((row) => JSON.stringify(row)).join("\n")),
        ),
      );

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
      right.manifests = [
        { subjectSnapshotSha256: SHA, subjectId: "baseline" },
        {
          candidateProvenance: { trackedDiffSha256: "b".repeat(64), gitStatusSha256: SHA },
          subjectSnapshotSha256: SHA,
          subjectId: "candidate",
        },
      ];
      for (const [directory, bundle] of [[leftDirectory, left], [rightDirectory, right]]) {
        await Promise.all(
          Object.entries(bundle).map(([name, rows]) =>
            writeFile(path.join(directory, `${name}.jsonl`), rows.map((row) => JSON.stringify(row)).join("\n")),
          ),
        );
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
