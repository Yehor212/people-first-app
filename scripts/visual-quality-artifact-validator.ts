import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { extname, isAbsolute, resolve, sep } from "node:path";

import {
  type ArtifactRecord,
  HASH_PATTERN,
  makeVisualProofViolation,
  type VisualProofViolation,
} from "./visual-quality-proof-shared";
import { inspectTgsArtifact } from "./visual-quality-tgs-validator";

export interface ArtifactValidationResult {
  violations: VisualProofViolation[];
  artifactsByRole: Map<string, ArtifactRecord>;
}

function safePortablePath(rootDir: string, candidate: string): string | null {
  if (
    !candidate ||
    isAbsolute(candidate) ||
    candidate.includes("\0") ||
    candidate.split(/[\\/]/).includes("..")
  ) {
    return null;
  }
  const root = realpathSync(rootDir);
  const target = resolve(root, candidate);
  if (target !== root && !target.startsWith(`${root}${sep}`)) return null;
  return target;
}

export function validateProofArtifacts(
  rootDir: string,
  displayPath: string,
  packetType: unknown,
  rawArtifacts: unknown,
  target: Record<string, unknown> | undefined
): ArtifactValidationResult {
  const violations: VisualProofViolation[] = [];
  const artifacts = Array.isArray(rawArtifacts) ? (rawArtifacts as ArtifactRecord[]) : [];
  const artifactsByRole = new Map<string, ArtifactRecord>();
  for (const artifact of artifacts) {
    if (
      typeof artifact.role !== "string" ||
      artifactsByRole.has(artifact.role) ||
      typeof artifact.path !== "string" ||
      !HASH_PATTERN.test(String(artifact.sha256)) ||
      !Number.isInteger(artifact.bytes) ||
      Number(artifact.bytes) <= 0 ||
      typeof artifact.portable !== "boolean"
    ) {
      violations.push(
        makeVisualProofViolation(
          displayPath,
          "visual-proof-artifact",
          "Each artifact needs a unique role, path, SHA-256, byte size, and portability flag."
        )
      );
      continue;
    }
    artifactsByRole.set(artifact.role, artifact);
    if (artifact.portable === false) {
      if (packetType !== "approved-baseline" || artifact.role !== "master") {
        violations.push(
          makeVisualProofViolation(
            displayPath,
            "visual-proof-portability",
            "Only the immutable approved master may remain non-portable."
          )
        );
      } else if (existsSync(artifact.path)) {
        const externalStat = lstatSync(artifact.path);
        if (!externalStat.isFile() || externalStat.isSymbolicLink()) {
          violations.push(
            makeVisualProofViolation(
              displayPath,
              "visual-proof-integrity",
              "Available external approved master differs from its trust anchor."
            )
          );
        } else {
          const externalBytes = readFileSync(artifact.path);
          const externalHash = createHash("sha256").update(externalBytes).digest("hex");
          if (externalBytes.byteLength !== artifact.bytes || externalHash !== artifact.sha256) {
            violations.push(
              makeVisualProofViolation(
                displayPath,
                "visual-proof-integrity",
                "Available external approved master differs from its trust anchor."
              )
            );
          } else if (artifact.path.toLowerCase().endsWith(".tgs")) {
            violations.push(
              ...inspectTgsArtifact(externalBytes, target ?? {}).map((finding) =>
                makeVisualProofViolation(displayPath, finding.rule, finding.detail)
              )
            );
          }
        }
      }
      continue;
    }
    const artifactPath = safePortablePath(rootDir, artifact.path);
    if (!artifactPath) {
      violations.push(
        makeVisualProofViolation(
          displayPath,
          "visual-proof-path",
          `Portable artifact path is unsafe: ${artifact.path}`
        )
      );
      continue;
    }
    if (!existsSync(artifactPath)) {
      violations.push(
        makeVisualProofViolation(
          displayPath,
          "visual-proof-missing-file",
          `Missing portable artifact: ${artifact.path}`
        )
      );
      continue;
    }
    const stat = lstatSync(artifactPath);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      !realpathSync(artifactPath).startsWith(`${realpathSync(rootDir)}${sep}`)
    ) {
      violations.push(
        makeVisualProofViolation(
          displayPath,
          "visual-proof-path",
          `Artifact must be a regular non-symlink file inside the repository: ${artifact.path}`
        )
      );
      continue;
    }
    const bytes = readFileSync(artifactPath);
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (bytes.byteLength !== artifact.bytes || actualHash !== artifact.sha256) {
      violations.push(
        makeVisualProofViolation(
          displayPath,
          "visual-proof-integrity",
          `Artifact hash or size mismatch: ${artifact.path}`
        )
      );
    }
    if (extname(artifact.path).toLowerCase() === ".tgs") {
      violations.push(
        ...inspectTgsArtifact(bytes, target ?? {}).map((finding) =>
          makeVisualProofViolation(displayPath, finding.rule, finding.detail)
        )
      );
    }
  }

  for (const role of ["master", "preview", "frame-board", "critic-report"]) {
    if (!artifactsByRole.has(role)) {
      violations.push(
        makeVisualProofViolation(
          displayPath,
          "visual-proof-artifact",
          `Required artifact role is missing: ${role}`
        )
      );
    }
  }
  const previewPath = artifactsByRole.get("preview")?.path;
  const frameBoardPath = artifactsByRole.get("frame-board")?.path;
  if (
    typeof previewPath === "string" &&
    ![".mp4", ".webm"].includes(extname(previewPath).toLowerCase())
  ) {
    violations.push(
      makeVisualProofViolation(
        displayPath,
        "visual-proof-artifact",
        "Preview evidence must be MP4 or WebM."
      )
    );
  }
  if (
    typeof frameBoardPath === "string" &&
    ![".png", ".jpg", ".jpeg", ".webp"].includes(extname(frameBoardPath).toLowerCase())
  ) {
    violations.push(
      makeVisualProofViolation(
        displayPath,
        "visual-proof-artifact",
        "Frame-board evidence must be a portable raster image."
      )
    );
  }
  return { violations, artifactsByRole };
}
