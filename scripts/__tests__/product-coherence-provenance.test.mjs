import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  captureCandidateProvenance,
  captureProductionProvenance,
  recomputeSnapshotSha256,
  verifyCandidateArtifactSnapshot,
  verifyProductionProvenance,
} from "../product-coherence/provenance.mjs";

const FIXED_GIT_ENV = Object.freeze({
  GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
  GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
});

describe("ProductCoherenceAudit subject provenance", () => {
  it("keeps a clean production snapshot stable across absolute roots", async () => {
    const roots = await Promise.all([
      mkdtemp(path.join(os.tmpdir(), "product-coherence-production-a-")),
      mkdtemp(path.join(os.tmpdir(), "product-coherence-production-b-")),
    ]);
    try {
      await Promise.all(roots.map((root) => initializeRepository(root)));
      const captures = await Promise.all(
        roots.map((root) => captureProductionProvenance({ root })),
      );

      expect(captures[0]).toEqual(captures[1]);
      expect(JSON.stringify(captures[0])).not.toContain(roots[0]);
      expect(JSON.stringify(captures[1])).not.toContain(roots[1]);
      expect(captures[0].snapshotSha256).toBe(recomputeSnapshotSha256(captures[0]));
    } finally {
      await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
    }
  });

  it("rejects dirty tracked and untracked production baselines", async () => {
    const trackedRoot = await createRepository();
    const untrackedRoot = await createRepository();
    try {
      await writeFile(path.join(trackedRoot, "src", "entry.mjs"), "export const ready = false;\n");
      await writeFile(path.join(untrackedRoot, "candidate.mjs"), "export const candidate = true;\n");

      await expect(captureProductionProvenance({ root: trackedRoot })).rejects.toMatchObject({
        code: "PRODUCTION_DIRTY",
      });
      await expect(captureProductionProvenance({ root: untrackedRoot })).rejects.toMatchObject({
        code: "PRODUCTION_DIRTY",
      });
    } finally {
      await Promise.all([trackedRoot, untrackedRoot].map(removeTree));
    }
  });

  it("binds and verifies a configurable tracked dependency lock file", async () => {
    const root = await createRepository();
    try {
      const lockBody = "lockfileVersion: 9\n";
      await writeFile(path.join(root, "pnpm-lock.yaml"), lockBody);
      expect(runGit(root, ["add", "pnpm-lock.yaml"]).status).toBe(0);
      expect(runGit(root, ["commit", "-m", "add alternate lock"], FIXED_GIT_ENV).status).toBe(0);

      const capture = await captureProductionProvenance({
        root,
        dependencyLockPath: "pnpm-lock.yaml",
      });
      expect(capture.repository).toMatchObject({
        dependencyLockPath: "pnpm-lock.yaml",
        dependencyLockSha256: sha256(lockBody),
      });
      await expect(verifyProductionProvenance(capture, { root })).resolves.toEqual({
        subjectId: "production-baseline",
        snapshotIntegrity: "VERIFIED",
        snapshotSha256: capture.snapshotSha256,
        closure: "PASS",
      });
    } finally {
      await removeTree(root);
    }
  });

  it("binds candidate status, binary diff, lock, and untracked bytes without root leakage", async () => {
    const roots = await Promise.all([createRepository(), createRepository()]);
    try {
      for (const root of roots) {
        await writeFile(path.join(root, "src", "entry.mjs"), "export const ready = false;\n");
        await writeFile(path.join(root, "candidate.mjs"), "export const candidate = true;\n");
      }
      const captures = await Promise.all(
        roots.map((root) =>
          captureCandidateProvenance({ root, privacyScanner: scannerReturning("CLEARED") }),
        ),
      );

      expect(captures[0]).toEqual(captures[1]);
      expect(captures[0]).toMatchObject({
        subjectId: "candidate",
        subjectKind: "CANDIDATE_WORKTREE",
        sanitizedUntrackedManifest: {
          entryCount: 1,
          clearedCount: 1,
          excludedCount: 0,
          entries: [
            {
              status: "CLEARED",
              path: "candidate.mjs",
              contentSha256: sha256("export const candidate = true;\n"),
              size: 31,
            },
          ],
        },
        privacyScanReceipt: {
          tool: "fixture-scanner",
          version: "1.0.0",
          configSha256: "c".repeat(64),
          scannedFileCount: 1,
          findingCount: 0,
          status: "PASS",
        },
        runtimeCopy: { complete: true, closure: "PASS", reasons: [] },
      });
      expect(captures[0].snapshotSha256).toBe(recomputeSnapshotSha256(captures[0]));
      expect(Object.keys(captures[0].privacyScanReceipt).sort()).toEqual([
        "configSha256",
        "findingCount",
        "scannedFileCount",
        "status",
        "tool",
        "version",
      ]);
      expect(JSON.stringify(captures[0])).not.toContain(roots[0]);
      expect(JSON.stringify(captures[1])).not.toContain(roots[1]);
    } finally {
      await Promise.all(roots.map(removeTree));
    }
  });

  it("detects untracked denominator and content drift across the capture window", async () => {
    const denominatorRoot = await createRepository();
    const contentRoot = await createRepository();
    try {
      await writeFile(path.join(denominatorRoot, "candidate-a.mjs"), "export const a = 1;\n");
      await writeFile(path.join(contentRoot, "candidate.mjs"), "export const version = 1;\n");

      await expect(
        captureCandidateProvenance({
          root: denominatorRoot,
          privacyScanner: scannerReturning("CLEARED"),
          testingHooks: {
            afterInitialUntrackedSnapshot: async () => {
              await writeFile(path.join(denominatorRoot, "candidate-b.mjs"), "export const b = 2;\n");
            },
          },
        }),
      ).rejects.toMatchObject({ code: "SUBJECT_MUTATED" });

      await expect(
        captureCandidateProvenance({
          root: contentRoot,
          privacyScanner: scannerReturning("CLEARED"),
          testingHooks: {
            afterInitialUntrackedSnapshot: async () => {
              await writeFile(path.join(contentRoot, "candidate.mjs"), "export const version = 2;\n");
            },
          },
        }),
      ).rejects.toMatchObject({ code: "SUBJECT_MUTATED" });
    } finally {
      await Promise.all([denominatorRoot, contentRoot].map(removeTree));
    }
  });

  it("rejects symlinked untracked files and pathname replacement after descriptor open", async () => {
    const symlinkRoot = await createRepository();
    const replacementRoot = await createRepository();
    try {
      await symlink("src/entry.mjs", path.join(symlinkRoot, "candidate.mjs"));
      await expect(
        captureCandidateProvenance({
          root: symlinkRoot,
          privacyScanner: scannerReturning("CLEARED"),
        }),
      ).rejects.toMatchObject({ code: "FILE_UNSAFE" });

      const candidatePath = path.join(replacementRoot, "candidate.mjs");
      await writeFile(candidatePath, "export const candidate = true;\n");
      let replaced = false;
      await expect(
        captureCandidateProvenance({
          root: replacementRoot,
          privacyScanner: scannerReturning("CLEARED"),
          testingHooks: {
            afterFileOpen: async ({ phase, relativePath }) => {
              if (phase !== "candidate-initial" || relativePath !== "candidate.mjs" || replaced) return;
              replaced = true;
              await rename(candidatePath, path.join(replacementRoot, "candidate.saved.mjs"));
              await symlink("src/entry.mjs", candidatePath);
            },
          },
        }),
      ).rejects.toMatchObject({ code: "FILE_UNSAFE" });
    } finally {
      await Promise.all([symlinkRoot, replacementRoot].map(removeTree));
    }
  });

  it("rejects a special untracked file before an open could block on it", async () => {
    const root = await createRepository();
    const fifoPath = path.join(root, "candidate.pipe");
    try {
      expect(spawnSync("mkfifo", [fifoPath]).status).toBe(0);
      const capture = captureCandidateProvenance({
        root,
        privacyScanner: scannerReturning("CLEARED"),
      });
      const settledWithoutWriter = await Promise.race([
        capture.then(
          () => true,
          () => true,
        ),
        delay(750, false),
      ]);
      if (!settledWithoutWriter) {
        await writeFile(fifoPath, "unblock");
        await capture.then(
          () => undefined,
          () => undefined,
        );
      }
      expect(settledWithoutWriter, "special-file rejection waited for a FIFO writer").toBe(true);
      await expect(capture).rejects.toMatchObject({ code: "FILE_UNSAFE" });
    } finally {
      await removeTree(root);
    }
  });

  it("fails closed without a scanner and validates scanner metadata", async () => {
    const root = await createRepository();
    try {
      await writeFile(path.join(root, "candidate.mjs"), "export const candidate = true;\n");
      await expect(captureCandidateProvenance({ root })).rejects.toMatchObject({
        code: "PRIVACY_SCANNER_REQUIRED",
      });
      await expect(
        captureCandidateProvenance({
          root,
          privacyScanner: {
            ...scannerReturning("CLEARED"),
            configSha256: "arbitrary",
          },
        }),
      ).rejects.toMatchObject({ code: "PRIVACY_SCANNER_INVALID" });
    } finally {
      await removeTree(root);
    }
  });

  it("records scanner findings and unknown results only as privacy-safe exclusions", async () => {
    for (const [scannerStatus, receiptStatus, reason] of [
      ["FINDING", "FINDINGS", "PRIVACY_FINDING"],
      ["UNKNOWN", "UNKNOWN", "PRIVACY_UNKNOWN"],
    ]) {
      const root = await createRepository();
      try {
        const privateValue = `sk-${"private-fixture-value-1234567890"}`;
        const relativePath = "scratch/candidate.mjs";
        await mkdir(path.join(root, "scratch"), { recursive: true });
        await writeFile(path.join(root, relativePath), `export default "${privateValue}";\n`);

        const capture = await captureCandidateProvenance({
          root,
          privacyScanner: scannerReturning(scannerStatus),
        });
        const entry = capture.sanitizedUntrackedManifest.entries[0];
        expect(entry).toEqual({
          status: "EXCLUDED",
          pathSha256: sha256(relativePath),
          contentSha256: sha256(`export default "${privateValue}";\n`),
          size: Buffer.byteLength(`export default "${privateValue}";\n`),
          reason,
        });
        expect(entry).not.toHaveProperty("path");
        expect(capture.privacyScanReceipt.status).toBe(receiptStatus);
        expect(capture.runtimeCopy).toEqual({
          complete: false,
          closure: "BLOCKED",
          reasons: [reason],
        });
        expect(JSON.stringify(capture)).not.toContain(privateValue);
        expect(JSON.stringify(capture)).not.toContain(relativePath);
      } finally {
        await removeTree(root);
      }
    }
  });

  it("never exposes sensitive paths or scanner error contents in JSON or thrown errors", async () => {
    const root = await createRepository();
    const sensitiveSegment = `journal-${"private-person-marker"}`;
    const secretValue = `token-${"private-fixture-987654321"}`;
    const relativePath = `${sensitiveSegment}/draft.mjs`;
    try {
      await mkdir(path.join(root, sensitiveSegment), { recursive: true });
      await writeFile(path.join(root, relativePath), `export default "${secretValue}";\n`);
      const capture = await captureCandidateProvenance({
        root,
        privacyScanner: scannerThrowing(secretValue),
      });
      const serialized = JSON.stringify(capture);
      expect(serialized).not.toContain(sensitiveSegment);
      expect(serialized).not.toContain(secretValue);
      expect(capture.sanitizedUntrackedManifest.entries[0]).toMatchObject({
        status: "EXCLUDED",
        pathSha256: sha256(relativePath),
        reason: "PRIVACY_UNKNOWN",
      });

      let caught;
      try {
        await captureCandidateProvenance({
          root,
          privacyScanner: scannerReturning("CLEARED"),
          limits: { maxFileBytes: 3 },
          dependencyLockPath: relativePath,
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeTruthy();
      expect(caught.message).not.toContain(sensitiveSegment);
      expect(JSON.stringify(caught)).not.toContain(secretValue);
      expect(JSON.stringify(caught)).not.toContain(sensitiveSegment);
    } finally {
      await removeTree(root);
    }
  });

  it("hides cleared files with sensitive names and scanner-cleared unknown file types", async () => {
    const root = await createRepository();
    try {
      await Promise.all([
        writeFile(path.join(root, "journal-notes.mjs"), "export const note = true;\n"),
        writeFile(path.join(root, "opaque.unknownext"), "opaque\n"),
      ]);
      const capture = await captureCandidateProvenance({
        root,
        privacyScanner: scannerReturning("CLEARED"),
      });

      expect(capture.sanitizedUntrackedManifest).toMatchObject({
        entryCount: 2,
        clearedCount: 0,
        excludedCount: 2,
      });
      expect(capture.sanitizedUntrackedManifest.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: "EXCLUDED", reason: "SENSITIVE_PATH" }),
          expect.objectContaining({ status: "EXCLUDED", reason: "UNKNOWN_FILE_TYPE" }),
        ]),
      );
      for (const entry of capture.sanitizedUntrackedManifest.entries) {
        expect(entry).not.toHaveProperty("path");
      }
      expect(capture.runtimeCopy.closure).toBe("BLOCKED");
      expect(capture.runtimeCopy.complete).toBe(false);
    } finally {
      await removeTree(root);
    }
  });

  it("rejects arbitrary snapshot digests and subject-type interchange", async () => {
    const root = await createRepository();
    const productionRoot = await createRepository();
    const artifactRoot = await mkdtemp(path.join(os.tmpdir(), "product-coherence-artifact-"));
    try {
      await writeFile(path.join(root, "candidate.mjs"), "export const candidate = true;\n");
      await writeFile(path.join(artifactRoot, "candidate.mjs"), "export const candidate = true;\n");
      const candidate = await captureCandidateProvenance({
        root,
        privacyScanner: scannerReturning("CLEARED"),
      });
      const production = await captureProductionProvenance({ root: productionRoot });
      const tampered = { ...candidate, snapshotSha256: "f".repeat(64) };

      await expect(
        verifyCandidateArtifactSnapshot(tampered, { artifactRoot }),
      ).rejects.toMatchObject({ code: "DIGEST_MISMATCH" });
      await expect(
        verifyCandidateArtifactSnapshot(production, { artifactRoot }),
      ).rejects.toMatchObject({ code: "WRONG_SUBJECT" });
      await expect(
        verifyProductionProvenance(candidate, { root }),
      ).rejects.toMatchObject({ code: "WRONG_SUBJECT" });
    } finally {
      await Promise.all([removeTree(root), removeTree(productionRoot), removeTree(artifactRoot)]);
    }
  });

  it("enforces file-count, per-file, and aggregate untracked byte bounds", async () => {
    const root = await createRepository({ lockBody: "{}\n" });
    try {
      await Promise.all([
        writeFile(path.join(root, "candidate-a.mjs"), "12345"),
        writeFile(path.join(root, "candidate-b.mjs"), "67890"),
      ]);
      const privacyScanner = scannerReturning("CLEARED");
      await expect(
        captureCandidateProvenance({
          root,
          privacyScanner,
          limits: { maxUntrackedFiles: 1 },
        }),
      ).rejects.toMatchObject({ code: "FILE_COUNT_LIMIT_EXCEEDED" });
      await expect(
        captureCandidateProvenance({
          root,
          privacyScanner,
          limits: { maxFileBytes: 4 },
        }),
      ).rejects.toMatchObject({ code: "FILE_LIMIT_EXCEEDED" });
      await expect(
        captureCandidateProvenance({
          root,
          privacyScanner,
          limits: { maxTotalBytes: 9 },
        }),
      ).rejects.toMatchObject({ code: "TOTAL_LIMIT_EXCEEDED" });
    } finally {
      await removeTree(root);
    }
  });

  it("rehashes every reconstructed cleared artifact under the separate artifact root", async () => {
    const root = await createRepository();
    const artifactRoot = await mkdtemp(path.join(os.tmpdir(), "product-coherence-artifacts-"));
    try {
      const files = {
        "candidate-a.mjs": "export const a = 1;\n",
        "nested/candidate-b.mjs": "export const b = 2;\n",
      };
      await mkdir(path.join(root, "nested"), { recursive: true });
      await mkdir(path.join(artifactRoot, "nested"), { recursive: true });
      await Promise.all(
        Object.entries(files).flatMap(([relativePath, content]) => [
          writeFile(path.join(root, relativePath), content),
          writeFile(path.join(artifactRoot, relativePath), content),
        ]),
      );
      const capture = await captureCandidateProvenance({
        root,
        privacyScanner: scannerReturning("CLEARED"),
      });

      await expect(
        verifyCandidateArtifactSnapshot(capture, { artifactRoot }),
      ).resolves.toEqual({
        subjectId: "candidate",
        snapshotIntegrity: "VERIFIED",
        snapshotSha256: capture.snapshotSha256,
        verifiedClearedFileCount: 2,
        excludedFileCount: 0,
        runtimeCopyComplete: true,
        closure: "PASS",
      });

      await writeFile(path.join(artifactRoot, "nested", "candidate-b.mjs"), "export const b = 3;\n");
      await expect(
        verifyCandidateArtifactSnapshot(capture, { artifactRoot }),
      ).rejects.toMatchObject({ code: "ARTIFACT_MISMATCH" });
    } finally {
      await Promise.all([removeTree(root), removeTree(artifactRoot)]);
    }
  });

  it("verifies cleared artifacts but keeps excluded runtime-copy closure blocked", async () => {
    const root = await createRepository();
    const artifactRoot = await mkdtemp(path.join(os.tmpdir(), "product-coherence-artifacts-excluded-"));
    try {
      await Promise.all([
        writeFile(path.join(root, "candidate.mjs"), "export const candidate = true;\n"),
        writeFile(path.join(root, "journal-private.mjs"), "export const privateEntry = true;\n"),
        writeFile(path.join(artifactRoot, "candidate.mjs"), "export const candidate = true;\n"),
      ]);
      const capture = await captureCandidateProvenance({
        root,
        privacyScanner: scannerReturning("CLEARED"),
      });

      await expect(
        verifyCandidateArtifactSnapshot(capture, { artifactRoot }),
      ).resolves.toEqual({
        subjectId: "candidate",
        snapshotIntegrity: "VERIFIED",
        snapshotSha256: capture.snapshotSha256,
        verifiedClearedFileCount: 1,
        excludedFileCount: 1,
        runtimeCopyComplete: false,
        closure: "BLOCKED",
      });
    } finally {
      await Promise.all([removeTree(root), removeTree(artifactRoot)]);
    }
  });
});

async function createRepository(options) {
  const root = await mkdtemp(path.join(os.tmpdir(), "product-coherence-repository-"));
  await initializeRepository(root, options);
  return root;
}

async function initializeRepository(root, { lockBody = '{"lockfileVersion":3}\n' } = {}) {
  await mkdir(path.join(root, "src"), { recursive: true });
  await Promise.all([
    writeFile(path.join(root, "package-lock.json"), lockBody),
    writeFile(path.join(root, "src", "entry.mjs"), "export const ready = true;\n"),
  ]);
  expect(runGit(root, ["init", "--object-format=sha1"]).status).toBe(0);
  expect(runGit(root, ["config", "user.email", "audit@example.invalid"]).status).toBe(0);
  expect(runGit(root, ["config", "user.name", "Audit Test"]).status).toBe(0);
  expect(runGit(root, ["add", "."]).status).toBe(0);
  expect(runGit(root, ["commit", "-m", "fixture"], FIXED_GIT_ENV).status).toBe(0);
}

function runGit(cwd, args, extraEnv = {}) {
  return spawnSync("git", ["--no-optional-locks", ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
}

function scannerReturning(status) {
  const receiptStatus =
    status === "CLEARED" ? "PASS" : status === "FINDING" ? "FINDINGS" : "UNKNOWN";
  return {
    tool: "fixture-scanner",
    version: "1.0.0",
    configSha256: "c".repeat(64),
    scanFile: async () => ({
      tool: "fixture-scanner",
      version: "1.0.0",
      configSha256: "c".repeat(64),
      scannedFileCount: 1,
      findingCount: status === "FINDING" ? 1 : 0,
      status: receiptStatus,
    }),
  };
}

function scannerThrowing(message) {
  return {
    ...scannerReturning("UNKNOWN"),
    scanFile: async () => {
      throw new Error(message);
    },
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function removeTree(root) {
  return rm(root, { recursive: true, force: true });
}

function delay(milliseconds, value) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds, value);
  });
}
